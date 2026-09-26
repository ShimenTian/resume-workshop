import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as data from '../lib/resume.ts';

function memoryStorage(initial: data.ResumeDocument[] | string | null = null) {
  let raw = Array.isArray(initial) ? JSON.stringify({ version: 1, resumes: initial }) : initial;
  let readBlocked = false;
  let writeBlocked = false;
  let writes = 0;
  const keys: string[] = [];
  return {
    getItem(key: string) { keys.push(key); if (readBlocked) throw new Error('SecurityError'); return raw; },
    setItem(key: string, value: string) { keys.push(key); if (writeBlocked) throw new Error('QuotaExceededError'); writes++; raw = value; },
    blockReads(value = true) { readBlocked = value; },
    blockWrites(value = true) { writeBlocked = value; },
    raw: () => raw,
    writes: () => writes,
    keys,
  };
}

// Deterministic hook runner; React state is rendered explicitly. Any network call
// is counted and rejected, including calls a hook might catch internally.
function harness(storage = memoryStorage()) {
  const slots: any[] = [];
  const effects: (() => unknown)[] = [];
  let cursor = 0;
  let networkCalls = 0;
  const same = (a: unknown[] | undefined, b: unknown[]) => a?.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const react = {
    useState(value: unknown) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = value;
      return [slots[index], (next: unknown) => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
    },
    useRef(value: unknown) {
      const index = cursor++;
      return slots[index] ??= { current: value };
    },
    useCallback(fn: unknown, deps: unknown[]) {
      const index = cursor++;
      if (!same(slots[index]?.deps, deps)) slots[index] = { fn, deps };
      return slots[index].fn;
    },
    useEffect(fn: () => unknown, deps: unknown[]) {
      const index = cursor++;
      if (!same(slots[index]?.deps, deps)) { slots[index] = { deps }; effects.push(fn); }
    },
  };
  const source = ts.transpileModule(readFileSync(new URL('./useResumeStore.ts', import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports: Record<string, () => any> = {};
  runInNewContext(source, {
    exports, structuredClone,
    require: (name: string) => {
      if (name === 'react') return react;
      assert.equal(name, '../lib/resume', 'Local draft hook must not load a server store.');
      return { ...data, loadResumes: () => data.loadResumes(storage), saveResumes: (docs: data.ResumeDocument[]) => data.saveResumes(docs, storage) };
    },
    fetch: () => { networkCalls++; throw new Error('Local drafts must never access a server.'); },
  });
  function render() {
    cursor = 0;
    const result = exports.useResumeStore();
    effects.splice(0).forEach((effect) => effect());
    return result;
  }
  return { render, storage, networkCalls: () => networkCalls };
}

function start(app: ReturnType<typeof harness>) { app.render(); return app.render(); }

test('first visit stays empty, makes no server requests and writes no automatic sample', () => {
  const app = harness();
  const store = start(app);
  assert.equal(store.ready, true);
  assert.equal(store.docs.length, 0);
  assert.equal(app.storage.raw(), null);
  assert.equal(app.storage.writes(), 0);
  assert.equal(store.cacheAvailable, true);
  assert.equal(store.online, true);
  store.retry();
  assert.equal(app.networkCalls(), 0);
  assert.ok(app.storage.keys.every((key) => key === data.RESUME_STORAGE_KEY));
});

test('legacy cache supports editing, deep copying, deletion and reopening with no network', async () => {
  const seed = data.newResume();
  const storage = memoryStorage([seed]);
  const app = harness(storage);
  let store = start(app);
  assert.deepEqual(store.docs, [seed]);
  assert.equal(storage.writes(), 0);
  store.upsert({ ...seed, title: '我的最新简历', profile: { ...seed.profile, summary: '新简介\n第二行' } });
  const copyId = await store.duplicate(seed);
  store = app.render();
  const copy = store.docs.find((doc: data.ResumeDocument) => doc.id === copyId);
  assert.equal(copy.title, '我的最新简历（副本）');
  store.upsert({ ...copy, profile: { ...copy.profile, name: '另一份简历' } });
  store = app.render();
  assert.equal(store.docs.find((doc: data.ResumeDocument) => doc.id === seed.id).profile.name, seed.profile.name);
  await store.remove(seed.id);
  const reopened = harness(storage);
  let reloaded = start(reopened);
  assert.equal(reloaded.docs.length, 1);
  assert.equal(reloaded.docs[0].id, copyId);
  assert.equal(reloaded.docs[0].profile.name, '另一份简历');
  assert.equal(reloaded.docs[0].profile.summary, '新简介\n第二行');
  await reloaded.remove(copyId);
  const emptyAgain = harness(storage);
  reloaded = start(emptyAgain);
  assert.equal(reloaded.docs.length, 0, 'Removing the last draft must not recreate a sample on reload.');
  assert.equal(app.networkCalls() + reopened.networkCalls() + emptyAgain.networkCalls(), 0);
});

test('successive local edits persist the final version synchronously', () => {
  const app = harness();
  const store = start(app);
  const seed = data.newResume();
  store.upsert(seed);
  store.upsert({ ...seed, title: '第一版' });
  store.upsert({ ...seed, title: '最后一版' });
  const reopened = harness(app.storage);
  assert.equal(start(reopened).docs[0].title, '最后一版');
  assert.equal(app.networkCalls() + reopened.networkCalls(), 0);
});

test('failed cache writes preserve editing, copying and file export; failed deletion retains the draft', async () => {
  const seed = data.newResume();
  const storage = memoryStorage([seed]);
  const original = storage.raw();
  const app = harness(storage);
  let store = start(app);
  storage.blockWrites();
  store.upsert({ ...seed, title: '尚未写入草稿的编辑' });
  const copyId = await store.duplicate(seed);
  store = app.render();
  const copy = store.docs.find((doc: data.ResumeDocument) => doc.id === copyId);
  assert.equal(data.parseResumeJson(data.serializeResume(copy)).title, '尚未写入草稿的编辑（副本）');
  assert.match(store.status, /仅在当前页面/);
  assert.ok(store.storageError);
  assert.equal(store.cacheAvailable, false);
  await assert.rejects(store.remove(seed.id), /删除未完成/);
  store = app.render();
  assert.equal(store.docs.length, 2);
  assert.equal(storage.raw(), original);
  assert.match(store.status, /草稿已保留/);
  storage.blockWrites(false);
  store.retry(); store = app.render();
  assert.equal(store.storageError, '');
  assert.equal(store.cacheAvailable, true);
  assert.equal(JSON.parse(storage.raw()!).resumes.length, 2);
  assert.equal(app.networkCalls(), 0);
});

test('corrupt cache remains untouched while new in-memory documents can be edited and exported', async () => {
  const storage = memoryStorage('{broken');
  const app = harness(storage);
  let store = start(app);
  assert.equal(store.docs.length, 0);
  assert.match(store.storageError, /原有数据已保留/);
  const seed = data.newResume();
  store.upsert(seed);
  store.upsert({ ...seed, title: '可导出的新文件' });
  await store.duplicate(seed);
  store = app.render();
  assert.equal(store.docs.length, 2);
  assert.equal(data.parseResumeJson(data.serializeResume(store.docs[1])).title, '可导出的新文件');
  await assert.rejects(store.remove(seed.id), /原稿已保留/);
  store.retry(); store = app.render();
  assert.equal(store.docs.length, 2);
  assert.equal(storage.raw(), '{broken');
  assert.equal(storage.writes(), 0);
  assert.equal(app.networkCalls(), 0);
});

test('retry after read access recovers preserves previous drafts and current session edits', () => {
  const seed = data.newResume();
  const storage = memoryStorage([seed]);
  storage.blockReads();
  const app = harness(storage);
  let store = start(app);
  assert.equal(store.cacheAvailable, false);
  const fresh = data.newResume('modern', true);
  store.upsert(fresh);
  assert.equal(storage.writes(), 0);
  storage.blockReads(false);
  store.retry(); store = app.render();
  assert.equal(store.docs.length, 2);
  assert.ok(store.docs.some((doc: data.ResumeDocument) => doc.id === seed.id));
  assert.ok(store.docs.some((doc: data.ResumeDocument) => doc.id === fresh.id));
  assert.equal(store.storageError, '');
  assert.equal(app.networkCalls(), 0);
});
