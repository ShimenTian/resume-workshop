import assert from 'node:assert/strict';
import test from 'node:test';
import {
  newResume, parseResumeJson, serializeResume, validateResume, loadResumes, saveResumes,
  RESUME_LIMITS, RESUME_STORAGE_KEY, type ResumeDocument, type ResumeStorage,
} from './resume.ts';

function memoryStorage(initial: string | null = null): ResumeStorage {
  let saved = initial;
  return { getItem: () => saved, setItem: (_key, value) => { saved = value; } };
}

/** Fill every free-text field to its legal limit; constrained fields stay valid. */
function maximalResume(character: string): ResumeDocument {
  const value = (length: number) => character.repeat(length);
  const short = value(RESUME_LIMITS.shortText);
  const description = value(RESUME_LIMITS.description);
  const rowId = (section: string, index: number) => `${section}-${index}`.padEnd(80, 'x');
  return {
    ...newResume('sidebar', true),
    id: 'x'.repeat(80),
    title: value(RESUME_LIMITS.title),
    profile: {
      name: value(80), role: short, phone: value(80), email: value(254),
      city: short, website: value(500), summary: value(RESUME_LIMITS.summary),
    },
    experiences: Array.from({ length: RESUME_LIMITS.sectionEntries }, (_, index) => ({
      id: rowId('experience', index), company: short, role: short, period: short, description,
    })),
    education: Array.from({ length: RESUME_LIMITS.sectionEntries }, (_, index) => ({
      id: rowId('education', index), school: short, degree: short, period: short, description,
    })),
    projects: Array.from({ length: RESUME_LIMITS.sectionEntries }, (_, index) => ({
      id: rowId('project', index), name: short, role: short, period: short, description,
    })),
    skills: value(RESUME_LIMITS.skills),
  };
}

for (const [name, character] of [['Chinese text', '字'], ['six-character JSON escapes', '\u0000']]) {
  test(`all fields and three sections at maximum size round-trip with ${name}`, () => {
    const resume = maximalResume(character);
    const json = serializeResume(resume);
    const byteLength = new TextEncoder().encode(json).byteLength;
    assert.ok(byteLength > 256_000, 'The former file-size limit would reject this valid document.');
    assert.ok(byteLength <= RESUME_LIMITS.importBytes);
    assert.ok(json.length <= RESUME_LIMITS.importCharacters);
    assert.deepEqual(parseResumeJson(json), resume);
  });
}

test('starter documents are independent and exported documents round-trip all editable fields', () => {
  const first = newResume('sidebar');
  const second = newResume('sidebar');
  assert.notEqual(first.id, second.id);
  assert.equal(first.title, '产品经理 · 求职简历');
  assert.equal(first.accent, '#304867');
  assert.equal(newResume('classic').accent, '#25375a');
  assert.equal(newResume('modern').accent, '#465fe9');
  assert.notEqual(first.experiences[0].id, second.experiences[0].id);
  first.profile.name = '测试姓名';
  first.experiences[0].description = '第一行\n第二行';
  assert.equal(second.profile.name, '林知夏');
  assert.deepEqual(parseResumeJson(serializeResume(first)), first);
  assert.deepEqual(validateResume(newResume('modern', true)).experiences, []);
});

test('import rejects malformed JSON, missing fields, wrong types and unsupported fields', () => {
  assert.throws(() => parseResumeJson('{'), /有效的 JSON/);
  assert.throws(() => parseResumeJson('null'), /需要是对象/);
  const valid = newResume();
  assert.throws(() => validateResume({ ...valid, profile: {} }), /缺少字段/);
  assert.throws(() => validateResume({ ...valid, skills: ['SQL'] }), /需要是文字/);
  assert.throws(() => validateResume({ ...valid, surprise: 'unknown' }), /不支持的字段/);
  assert.throws(() => parseResumeJson(serializeResume(valid).replace('"classic"', '"unknown"')), /模板无效/);
});

test('import rejects invalid colors, impossible timestamps and duplicate row identifiers', () => {
  const valid = newResume();
  assert.throws(() => validateResume({ ...valid, accent: 'red' }), /主题颜色/);
  assert.throws(() => validateResume({ ...valid, accent: 'url(x)' }), /主题颜色/);
  assert.throws(() => validateResume({ ...valid, updatedAt: '2026-02-30T00:00:00.000Z' }), /有效的 ISO/);
  assert.throws(() => validateResume({ ...valid, experiences: [valid.experiences[0], valid.experiences[0]] }), /重复/);
});

test('text and collection limits allow the exact boundary and reject one beyond it', () => {
  const valid = newResume();
  valid.profile.summary = '字'.repeat(RESUME_LIMITS.summary);
  assert.equal(validateResume(valid).profile.summary.length, RESUME_LIMITS.summary);
  assert.throws(() => validateResume({ ...valid, profile: { ...valid.profile, summary: `${valid.profile.summary}字` } }), /最多支持/);
  const rows = Array.from({ length: RESUME_LIMITS.sectionEntries }, (_, index) => ({ ...valid.projects[0], id: `project-${index}` }));
  assert.equal(validateResume({ ...valid, projects: rows }).projects.length, RESUME_LIMITS.sectionEntries);
  assert.throws(() => validateResume({ ...valid, projects: [...rows, { ...rows[0], id: 'extra' }] }), /最多支持/);
  assert.throws(() => parseResumeJson(' '.repeat(RESUME_LIMITS.importCharacters + 1)), /文件过大/);
  assert.throws(() => parseResumeJson('字'.repeat(Math.ceil(RESUME_LIMITS.importBytes / 3) + 1)), /文件过大/);
});

test('the 2 MB import boundary accepts the exact UTF-8 size and rejects one extra byte', () => {
  assert.equal(RESUME_LIMITS.importBytes, 2 * 1024 * 1024);
  assert.equal(RESUME_LIMITS.importCharacters, RESUME_LIMITS.importBytes);
  const resume = newResume();
  const json = serializeResume(resume);
  const padded = json + ' '.repeat(RESUME_LIMITS.importBytes - new TextEncoder().encode(json).byteLength);
  assert.deepEqual(parseResumeJson(padded), resume);
  assert.throws(() => parseResumeJson(`${padded} `), /不超过 2 MB/);
});

test('storage distinguishes a first visit from damaged or unavailable saved data', () => {
  assert.deepEqual(loadResumes(memoryStorage()), { ok: true, resumes: [] });
  const corrupted = memoryStorage('{broken');
  assert.equal(loadResumes(corrupted).ok, false);
  assert.equal(corrupted.getItem(RESUME_STORAGE_KEY), '{broken');
  assert.equal(loadResumes(memoryStorage('{"version":2,"resumes":[]}')).ok, false);
  const blocked = { getItem: () => { throw new Error('SecurityError'); }, setItem: () => {} };
  assert.equal(loadResumes(blocked).ok, false);
});

test('saving returns explicit quota failures and validates before touching existing data', () => {
  const resume = newResume();
  const storage = memoryStorage();
  assert.deepEqual(saveResumes([resume], storage), { ok: true });
  assert.deepEqual(loadResumes(storage), { ok: true, resumes: [resume] });
  const original = storage.getItem(RESUME_STORAGE_KEY);
  assert.equal(saveResumes([resume, resume], storage).ok, false);
  assert.equal(storage.getItem(RESUME_STORAGE_KEY), original);
  assert.equal(saveResumes(Array.from({ length: 51 }, () => newResume()), storage).ok, false);
  assert.equal(storage.getItem(RESUME_STORAGE_KEY), original);
  const full = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };
  const failed = saveResumes([resume], full);
  assert.equal(failed.ok, false);
  if (!failed.ok) assert.match(failed.error, /保存失败/);
});
