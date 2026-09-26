import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Copy, FileText, FolderOpen, Menu, Plus, ShieldCheck, Trash2, Upload, X } from 'lucide-react';
import { Home, type ToolName } from './components/Home';
import { TemplateGallery } from './components/TemplateGallery';
import { ResumePaper } from './components/ResumePaper';
import { Dialog, GuideDialog, SaveDialog, TemplatePreview } from './components/WorkspaceDialogs';
import { Editor } from './Editor';
import { catalog, makeExample, type DesignTemplate } from './lib/catalog';
import { createId, newResume, type ResumeDocument } from './lib/resume';
import { downloadResumeFile, readResumeFile, saveResumeFile } from './lib/resumeFile';
import { useResumeStore } from './hooks/useResumeStore';

const FAVORITES_KEY = 'resume-workshop:template-favorites:v1';
const templateKeys = new Set(catalog.map(template => template.key));
function loadFavorites(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY) || 'null');
    return saved?.version === 1 && Array.isArray(saved.keys)
      ? [...new Set<string>(saved.keys.filter((key: unknown) => typeof key === 'string' && templateKeys.has(key)))] : [];
  } catch { return []; }
}

function useRoute() {
  const [route, setRoute] = useState(() => location.hash.slice(1) || 'home');
  useEffect(() => {
    const change = () => { setRoute(location.hash.slice(1) || 'home'); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  return route;
}

export default function App() {
  const route = useRoute();
  const store = useResumeStore();
  const [selected, setSelected] = useState<DesignTemplate | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [favorites, setFavorites] = useState(loadFavorites);
  const [modal, setModal] = useState<'guide' | 'files' | 'save' | 'delete' | null>(null);
  const [notice, setNotice] = useState('');
  const [removed, setRemoved] = useState<ResumeDocument | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<ResumeDocument | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fileError, setFileError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const current = route.startsWith('edit/') ? store.docs.find(doc => doc.id === route.slice(5)) : undefined;
  const go = (page: string) => { location.hash = page; setMobileMenu(false); };
  const notify = (message: string) => { setRemoved(null); setNotice(message); };
  const openFile = () => fileInput.current?.click();
  const openSave = () => { setFileError(''); setModal('save'); };
  const showGuide = (mode: 'guide' | 'files') => { setModal(mode); setMobileMenu(false); };

  useEffect(() => { document.title = current ? `${current.title || '未命名简历'} · 简历工坊` : '简历工坊 · 让好机会，看见你'; }, [current?.title]);
  useEffect(() => {
    if (!store.storageError || !store.docs.length) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [store.storageError, store.docs.length]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => { setNotice(''); setRemoved(null); }, 7000);
    return () => clearTimeout(timer);
  }, [notice]);

  const create = (template: DesignTemplate = catalog[0], blank = false) => {
    try {
      const doc = blank ? newResume(template.templateId, true) : makeExample(template);
      doc.accent = template.accent;
      store.upsert(doc);
      setSelected(null);
      go(`edit/${doc.id}`);
      if (!blank) notify('已使用模板示例，请替换为自己的信息与真实经历。');
    } catch (error) { notify((error as Error).message); }
  };
  const favorite = (key: string) => {
    const next = favorites.includes(key) ? favorites.filter(item => item !== key) : [...favorites, key];
    setFavorites(next);
    try { localStorage.setItem(FAVORITES_KEY, JSON.stringify({ version: 1, keys: next })); }
    catch { notify('收藏暂存在当前页面，浏览器存储不可用。'); }
  };
  const save = async (method: 'download' | 'picker') => {
    if (!current || saving) return;
    setSaving(true);
    setFileError('');
    try {
      const result = await (method === 'picker' ? saveResumeFile(current) : downloadResumeFile(current));
      if (result) {
        setModal(null);
        notify(result.method === 'download'
          ? `已发起下载：${result.filename}。请在浏览器下载列表确认文件已保存。`
          : `已保存 ${result.filename}。下次打开文件即可继续编辑。`);
      }
    } catch (error) { setFileError(error instanceof Error ? error.message : '文件保存未完成，请重试。'); }
    finally { setSaving(false); }
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      const doc = await readResumeFile(file);
      doc.id = createId();
      store.upsert(doc);
      setModal(null);
      setSelected(null);
      go(`edit/${doc.id}`);
      notify('文件已打开，可以继续编辑。修改后请重新保存到电脑。');
    } catch (error) { notify(error instanceof Error ? error.message : '文件无法打开，请选择本站简历文件。'); }
    finally { if (fileInput.current) fileInput.current.value = ''; }
  };
  const remove = async () => {
    if (!deleteDoc || deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await store.remove(deleteDoc.id);
      setRemoved(deleteDoc);
      setNotice('浏览器草稿已移除');
      setModal(null);
    } catch (error) { setDeleteError((error as Error).message); }
    finally { setDeleting(false); }
  };
  const toolAction = (tool: ToolName) => {
    if (tool === 'create') create();
    else if (tool === 'open') openFile();
    else if (tool === 'templates') go('templates');
    else showGuide('guide');
  };

  const extras = <>
    <input ref={fileInput} className="visually-hidden" tabIndex={-1} type="file" accept=".json,application/json" aria-label="选择可编辑简历文件" onChange={event => void importFile(event.target.files?.[0])}/>
    {selected && <TemplatePreview key={selected.key} template={selected} onClose={() => setSelected(null)} onUse={create}/>}
    {(modal === 'guide' || modal === 'files') && <GuideDialog mode={modal} onClose={() => setModal(null)}/>}
    {modal === 'save' && current && <SaveDialog resume={current} saving={saving} error={fileError} onSave={method => void save(method)} onClose={() => setModal(null)}/>}
    {modal === 'delete' && deleteDoc && <Dialog title="移除这份浏览器草稿？" onClose={() => setModal(null)} busy={deleting}>
      <p className="dialog-description">“{deleteDoc.title || '未命名简历'}”将从当前浏览器中移除。电脑上已保存的简历文件会保留。</p>
      {deleteError && <p className="dialog-error" role="alert">{deleteError}</p>}
      <div className="workshop-dialog-actions"><button className="btn btn-secondary" disabled={deleting} onClick={() => setModal(null)}>保留草稿</button><button className="btn btn-danger" disabled={deleting} onClick={() => void remove()}>{deleting ? '正在移除…' : '移除草稿'}</button></div>
    </Dialog>}
    {notice && <div className="toast" role="status"><Check size={17}/><span>{notice}</span>{removed && <button onClick={() => { try { store.upsert(removed); notify('简历已恢复。'); } catch (error) { notify((error as Error).message); } }}>撤销</button>}<button aria-label="关闭提示" onClick={() => setNotice('')}><X size={15}/></button></div>}
  </>;

  if (!store.ready) return <div className="resume-loading"><FileText size={38}/><h1>简历工坊</h1><p>正在读取浏览器草稿…</p></div>;
  if (current) return <><Editor key={current.id} resume={current}
    onChange={doc => { try { store.upsert(doc); } catch (error) { notify((error as Error).message); } }}
    onBack={() => go('resumes')} onSave={openSave} onOpen={openFile} saving={saving}
    status={store.status} storageError={store.storageError} onRetry={store.retry} onTool={() => showGuide('guide')}/>{extras}</>;

  return <>
    <header className="site-header"><div className="header-inner section-width">
      <a className="brand" href="#home" aria-label="简历工坊首页"><span className="brand-mark"><FileText size={25} strokeWidth={1.7}/><span/></span><strong>简历工坊<span>让好机会，看见你</span></strong></a>
      <nav className={`main-nav ${mobileMenu ? 'is-open' : ''}`} aria-label="主导航">
        <a href="#home" className={route === 'home' ? 'active' : ''} onClick={() => setMobileMenu(false)}>首页</a>
        <a href="#templates" className={route === 'templates' ? 'active' : ''} onClick={() => setMobileMenu(false)}>简历模板</a>
        <button onClick={() => showGuide('files')}>文件使用</button><button onClick={() => showGuide('guide')}>制作指南</button>
      </nav>
      <div className="header-actions"><a href="#resumes" className={`my-resumes-link ${route === 'resumes' ? 'active' : ''}`} onClick={() => setMobileMenu(false)}><FolderOpen size={17}/>我的简历</a><button className="btn btn-primary" onClick={() => create(catalog[0], true)}><Plus size={16}/>新建简历</button><button className="menu-toggle icon-button" aria-label={mobileMenu ? '关闭导航' : '打开导航'} aria-expanded={mobileMenu} onClick={() => setMobileMenu(!mobileMenu)}>{mobileMenu ? <X/> : <Menu/>}</button></div>
    </div></header>
    {store.storageError && <div className="section-width site-cache-error" role="alert"><span>{store.storageError}</span><button className="text-button" onClick={store.retry}>重试暂存</button></div>}
    <main>
      {route === 'templates' ? <TemplateGallery full onSelect={setSelected} onAll={() => go('templates')} favorites={favorites} onFavorite={favorite}/>
        : route === 'resumes' ? <section className="draft-page section-width">
          <div className="section-heading"><div><h1>我的简历</h1><p>认真记录每一次成长，为下一次机会做好准备。</p></div><button className="btn btn-secondary" onClick={openFile}><Upload size={16}/>打开简历文件</button></div>
          <div className="privacy-note"><ShieldCheck size={17}/><span>这里是当前浏览器暂存的草稿。保存为简历文件后，可在其他设备打开继续编辑。</span></div>
          <div className="draft-grid"><button className="new-draft" onClick={() => create(catalog[0], true)}><span><Plus size={27}/></span><strong>开始一份新简历</strong><small>每一个新的可能，都值得认真准备</small></button>
            {[...store.docs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(doc => <article className="draft-card" key={doc.id}>
              <button className="draft-paper-wrap" aria-label={`编辑${doc.title}`} onClick={() => go(`edit/${doc.id}`)}><div className="mini-paper" aria-hidden="true"><ResumePaper resume={doc} compact/></div><span>继续编辑<ArrowUpRight size={17}/></span></button>
              <div className="draft-info"><h3>{doc.title || '未命名简历'}</h3><p>{new Date(doc.updatedAt).toLocaleDateString('zh-CN')} 更新</p><div>
                <button className="text-button" onClick={() => go(`edit/${doc.id}`)}>继续编辑<ArrowRight size={15}/></button>
                <button className="icon-button" aria-label={`复制${doc.title}`} onClick={() => void store.duplicate(doc).then(id => { go(`edit/${id}`); notify('已创建简历副本。'); }).catch(error => notify(error.message))}><Copy size={16}/></button>
                <button className="icon-button" aria-label={`移除${doc.title}`} onClick={() => { setDeleteDoc(doc); setDeleteError(''); setModal('delete'); }}><Trash2 size={16}/></button>
              </div></div>
            </article>)}
          </div>
          {!store.docs.length && <p className="draft-empty-note">还没有草稿？<button className="text-button" onClick={() => go('templates')}>从喜欢的模板开始<ArrowRight size={14}/></button></p>}
        </section>
          : route.startsWith('edit/') ? <section className="missing-page section-width"><FileText size={44}/><h1>暂未找到这份简历</h1><p>可以打开电脑上的简历文件继续编辑，或在“我的简历”中选择浏览器草稿。</p><button className="btn btn-primary" onClick={openFile}><FolderOpen size={16}/>打开简历文件</button><button className="text-button" onClick={() => go('resumes')}><ArrowLeft size={16}/>返回我的简历</button></section>
            : <Home onCreate={() => create()} onTemplates={() => go('templates')} onTool={toolAction} onSelect={setSelected} favorites={favorites} onFavorite={favorite}/>}
    </main>
    <footer className="site-footer section-width"><a className="footer-brand" href="#home"><FileText size={19}/>简历工坊<span>让好机会，看见你。</span></a><div><button onClick={() => showGuide('guide')}>制作指南</button><button onClick={openFile}>打开简历文件</button><span>本地保存 · 无需登录 © {new Date().getFullYear()}</span></div></footer>
    {extras}
  </>;
}
