// Legacy server mode. The default local-draft application does not import this hook.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createId, loadResumes, newResume, saveResumes, validateResume, type ResumeDocument } from '../lib/resume';

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`/api${path}`, { ...init, signal: AbortSignal.timeout(5000), headers: { 'Content-Type': 'application/json', ...init?.headers } });
  if (!response.ok) {
    let message = '本机服务暂时不可用';
    try { const data = await response.json(); if (typeof data.error === 'string') message = data.error; else if (typeof data.message === 'string') message = data.message; } catch { /* keep fallback */ }
    throw new Error(message);
  }
  return response;
}

export function useServerResumeStore() {
  const [docs, setDocs] = useState<ResumeDocument[]>([]);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('正在连接本机服务');
  const [storageError, setStorageError] = useState('');
  const [online, setOnline] = useState(false);
  const docsRef = useRef<ResumeDocument[]>([]);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const revision = useRef(0);
  const initialized = useRef(false);
  const mounted = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const deleting = useRef(new Set<string>());
  const dirty = useRef(new Set<string>());
  const cacheReadable = useRef(true);
  const cacheSaved = useRef(false);
  const cacheReadError = useRef('');

  // Every server mutation joins this queue, including deletion and duplication.
  const enqueue = useCallback(<T,>(operation: () => Promise<T>): Promise<T> => {
    const result = queue.current.catch(() => {}).then(operation);
    queue.current = result.catch(() => {});
    return result;
  }, []);

  const persist = useCallback((next: ResumeDocument[]) => {
    if (!cacheReadable.current) {
      cacheSaved.current = false;
      setStorageError(cacheReadError.current);
      return false;
    }
    // A pending deletion must stay absent from cache while other documents change.
    const result = saveResumes(next.filter((doc) => !deleting.current.has(doc.id)));
    cacheSaved.current = result.ok;
    setStorageError(result.ok ? '' : result.error);
    return result.ok;
  }, []);

  const commit = useCallback((next: ResumeDocument[]) => {
    docsRef.current = next;
    setDocs(next);
    return persist(next);
  }, [persist]);

  const clearTimer = useCallback(() => {
    if (timer.current !== undefined) clearTimeout(timer.current);
    timer.current = undefined;
  }, []);

  const sync = useCallback(() => {
    clearTimer();
    const expectedRevision = revision.current;
    setStatus('正在保存');
    return enqueue(async () => {
      try {
        // Read current documents when the queued job starts, not when it was scheduled.
        // A document already being deleted is never included in a queued PUT.
        const ids = docsRef.current.map((doc) => doc.id);
        for (const id of ids) {
          const doc = docsRef.current.find((item) => item.id === id);
          if (doc && !deleting.current.has(id)) {
            await request(`/resumes/${id}`, { method: 'PUT', body: JSON.stringify(doc) });
            if (docsRef.current.find((item) => item.id === id) === doc) dirty.current.delete(id);
          }
        }
        setOnline(true);
        if (revision.current === expectedRevision && dirty.current.size === 0 && deleting.current.size === 0) setStatus('已保存到本机服务');
      } catch {
        setOnline(false);
        if (revision.current === expectedRevision) {
          setStatus(cacheSaved.current ? '已缓存到浏览器，待同步' : '尚未持久保存，请导出备份');
        }
      }
    });
  }, [clearTimer, enqueue]);

  const scheduleSync = useCallback(() => {
    clearTimer();
    setStatus('正在保存');
    timer.current = setTimeout(() => { timer.current = undefined; void sync(); }, 650);
  }, [clearTimer, sync]);

  useEffect(() => {
    mounted.current = true;
    if (!initialized.current) {
      initialized.current = true;
      const local = loadResumes();
      const cached = local.ok ? local.resumes : [];
      cacheReadable.current = local.ok;
      if (!local.ok) {
        cacheReadError.current = `${local.error} 原有缓存已保留，本次内容请保存到本机服务或导出备份。`;
        setStorageError(cacheReadError.current);
      }
      void (async () => {
        let next = cached;
        let serviceAvailable = false;
        let needsSync = false;
        try {
          const data: unknown = await (await request('/resumes')).json();
          if (!Array.isArray(data)) throw new Error('服务返回格式无效');
          const remote = data.map(validateResume);
          if (new Set(remote.map((doc) => doc.id)).size !== remote.length) throw new Error('服务返回重复简历');
          const map = new Map(remote.map((doc) => [doc.id, doc]));
          for (const doc of cached) {
            if (!map.has(doc.id) || doc.updatedAt > map.get(doc.id)!.updatedAt) {
              map.set(doc.id, doc);
              dirty.current.add(doc.id);
              needsSync = true;
            }
          }
          next = [...map.values()];
          serviceAvailable = true;
        } catch { /* Keep the readable local copy available while offline. */ }
        if (!mounted.current) return;
        if (!next.length) { next = [newResume()]; dirty.current.add(next[0].id); needsSync = true; }
        if (!serviceAvailable) cached.forEach((doc) => dirty.current.add(doc.id));
        commit(next);
        setOnline(serviceAvailable);
        setReady(true);
        if (serviceAvailable && needsSync) void sync();
        else if (serviceAvailable) setStatus('已保存到本机服务');
        else setStatus(cacheSaved.current ? '已缓存到浏览器，待同步' : '尚未持久保存，请导出备份');
      })();
    }
    return () => { mounted.current = false; clearTimer(); };
  }, [clearTimer, commit, sync]);

  const upsert = (doc: ResumeDocument) => {
    if (deleting.current.has(doc.id)) throw new Error('这份简历正在删除，请稍后再试。');
    const updated = validateResume({ ...doc, updatedAt: new Date().toISOString() });
    const existing = docsRef.current.some((item) => item.id === doc.id);
    if (!existing && docsRef.current.length >= 50) throw new Error('最多保存 50 份简历，请先备份并移除不需要的简历。');
    revision.current += 1;
    dirty.current.add(updated.id);
    commit(existing ? docsRef.current.map((item) => item.id === doc.id ? updated : item) : [updated, ...docsRef.current]);
    scheduleSync();
    return updated.id;
  };

  const duplicate = async (doc: ResumeDocument) => {
    if (deleting.current.has(doc.id)) throw new Error('这份简历正在删除，请稍后再试。');
    if (docsRef.current.length >= 50) throw new Error('最多保存 50 份简历。');
    if (!online) {
      const source = docsRef.current.find((item) => item.id === doc.id) ?? doc;
      return upsert({ ...structuredClone(source), id: createId(), title: `${source.title.slice(0, 94)}（副本）` });
    }
    return enqueue(async () => {
      if (docsRef.current.length >= 50) throw new Error('最多保存 50 份简历。');
      const source = docsRef.current.find((item) => item.id === doc.id);
      if (!source || deleting.current.has(doc.id)) throw new Error('简历已删除，无法创建副本。');
      try {
        // Persist the latest local source before the server copies it.
        await request(`/resumes/${source.id}`, { method: 'PUT', body: JSON.stringify(source) });
        if (docsRef.current.find((item) => item.id === source.id) === source) dirty.current.delete(source.id);
        const copied = validateResume(await (await request(`/resumes/${source.id}/duplicate`, { method: 'POST' })).json());
        commit([copied, ...docsRef.current]);
        setOnline(true);
        // Other edits may still be waiting for their debounce; preserve their save status.
        if (dirty.current.size === 0 && deleting.current.size === 0) setStatus('已保存到本机服务');
        return copied.id;
      } catch (error) {
        setOnline(false);
        setStatus(cacheSaved.current ? '已缓存到浏览器，待同步' : '尚未持久保存，请导出备份');
        throw error;
      }
    });
  };

  const remove = async (id: string) => {
    if (deleting.current.has(id)) throw new Error('这份简历正在删除，请稍后再试。');
    if (!docsRef.current.some((doc) => doc.id === id)) return;
    deleting.current.add(id);
    revision.current += 1;
    setStatus('正在删除');
    return enqueue(async () => {
      let requestedDelete = false;
      try {
        // Update cache before DELETE, so a stale browser copy cannot recreate the document.
        // If cache cannot be changed, leave the durable server copy intact.
        if (!persist(docsRef.current)) throw new Error('浏览器缓存无法更新，删除未执行。请先导出备份并检查浏览器存储设置。');
        requestedDelete = true;
        await request(`/resumes/${id}`, { method: 'DELETE' });
        dirty.current.delete(id);
        commit(docsRef.current.filter((doc) => doc.id !== id));
        setOnline(true);
        if (dirty.current.size === 0 && deleting.current.size <= 1) setStatus('已保存到本机服务');
      } catch (error) {
        if (requestedDelete) setOnline(false);
        deleting.current.delete(id);
        persist(docsRef.current);
        setStatus(cacheSaved.current ? '删除未完成，简历已保留' : '删除未完成，请导出备份');
        throw error;
      } finally {
        deleting.current.delete(id);
      }
    });
  };

  const retry = () => { persist(docsRef.current); void sync(); };
  return { docs, ready, status, storageError, online, upsert, duplicate, remove, retry };
}
