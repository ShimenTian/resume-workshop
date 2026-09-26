import { useCallback, useEffect, useRef, useState } from 'react';
import { createId, loadResumes, saveResumes, validateResume, type ResumeDocument } from '../lib/resume';

/** Browser-only drafts. Editable files are imported and exported by the UI. */
export function useResumeStore() {
  const [docs, setDocs] = useState<ResumeDocument[]>([]);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('正在读取本地草稿');
  const [storageError, setStorageError] = useState('');
  const [cacheAvailable, setCacheAvailable] = useState(false);
  const docsRef = useRef<ResumeDocument[]>([]);
  const initialized = useRef(false);
  const cacheReadable = useRef(true);
  const readError = useRef('');

  const reportUnreadable = useCallback((error: string) => {
    cacheReadable.current = false;
    readError.current = `${error} 原有数据已保留，本次编辑请保存为简历文件。`;
    setStorageError(readError.current);
    setCacheAvailable(false);
    setStatus('浏览器草稿不可用，请保存简历文件');
  }, []);

  const persist = useCallback((next: ResumeDocument[]) => {
    if (!cacheReadable.current) {
      setStorageError(readError.current);
      setCacheAvailable(false);
      setStatus('本次更改仅在当前页面，请保存简历文件');
      return false;
    }
    const result = saveResumes(next);
    setCacheAvailable(result.ok);
    setStorageError(result.ok ? '' : result.error);
    setStatus(result.ok ? '草稿已保存到此浏览器' : '本次更改仅在当前页面，请保存简历文件');
    return result.ok;
  }, []);

  const commit = useCallback((next: ResumeDocument[]) => {
    // Keep edits available for file export even if browser storage is full or blocked.
    docsRef.current = next;
    setDocs(next);
    return persist(next);
  }, [persist]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const local = loadResumes();
    if (local.ok) {
      docsRef.current = local.resumes;
      setDocs(local.resumes);
      setCacheAvailable(true);
      setStatus(local.resumes.length ? '草稿已保存到此浏览器' : '尚无本地草稿');
    } else reportUnreadable(local.error);
    // Initialization never writes data or creates a sample resume.
    setReady(true);
  }, [reportUnreadable]);

  const upsert = (doc: ResumeDocument) => {
    const updated = validateResume({ ...doc, updatedAt: new Date().toISOString() });
    const existing = docsRef.current.some((item) => item.id === doc.id);
    if (!existing && docsRef.current.length >= 50) throw new Error('最多保留 50 份浏览器草稿，请先保存简历文件并移除暂时不用的草稿。');
    commit(existing ? docsRef.current.map((item) => item.id === doc.id ? updated : item) : [updated, ...docsRef.current]);
    return updated.id;
  };

  const duplicate = async (doc: ResumeDocument) => {
    const source = docsRef.current.find((item) => item.id === doc.id);
    if (!source) throw new Error('这份草稿已移除，无法创建副本。');
    return upsert({ ...structuredClone(source), id: createId(), title: `${source.title.slice(0, 94)}（副本）` });
  };

  const remove = async (id: string) => {
    if (!docsRef.current.some((doc) => doc.id === id)) return;
    const remaining = docsRef.current.filter((doc) => doc.id !== id);
    // Confirm the local write first. Failed deletion keeps both the editable draft
    // in memory and the prior stored copy available for recovery or file export.
    if (!persist(remaining)) {
      setStatus('删除未完成，草稿已保留');
      throw new Error('浏览器草稿无法更新，删除未完成。原稿已保留，可以先保存简历文件。');
    }
    docsRef.current = remaining;
    setDocs(remaining);
  };

  const retry = () => {
    if (!cacheReadable.current) {
      // Recheck access without replacing unreadable data. If the user has repaired
      // storage, preserve its recovered drafts alongside edits from this session.
      const local = loadResumes();
      if (!local.ok) { reportUnreadable(local.error); return; }
      const recovered = new Map(local.resumes.map((doc) => [doc.id, doc]));
      for (const doc of docsRef.current) {
        if (!recovered.has(doc.id) || doc.updatedAt >= recovered.get(doc.id)!.updatedAt) recovered.set(doc.id, doc);
      }
      cacheReadable.current = true;
      commit([...recovered.values()]);
      return;
    }
    persist(docsRef.current);
  };

  // `online` is retained only for existing callers; it represents local cache access.
  return { docs, ready, status, storageError, cacheAvailable, online: cacheAvailable, upsert, duplicate, remove, retry };
}
