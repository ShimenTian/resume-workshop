import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronRight, Copy, Download, Eye, FileText, FolderOpen, LockKeyhole, PencilLine, Plus, RotateCw, Save, Search, ShieldCheck, Trash2, Upload, X } from 'lucide-react';
import { createId, newResume, templates, type ResumeDocument, type TemplateId } from './lib/resume';
import { downloadResumeFile, readResumeFile, resumeFilename, saveResumeFile } from './lib/resumeFile';
import { useResumeStore } from './hooks/useResumeStore';
import { ResumePaper } from './components/ResumePaper';
import { EditorForm } from './components/EditorForm';

function Brand({ onClick, icon = true }: {onClick:()=>void;icon?:boolean}) { return <button className="brand" onClick={onClick}>{icon&&<FileText size={28}/>}<span>简历工坊</span></button>; }
function Modal({ title, onClose, children }: {title:string;onClose:()=>void;children:ReactNode}) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{dialog.current?.showModal();},[]);
  return <dialog ref={dialog} onCancel={onClose} onClick={e=>{if(e.target===dialog.current) onClose();}}><div className="modal-heading"><h2>{title}</h2><button aria-label="关闭" className="icon-button" onClick={onClose}><X/></button></div>{children}</dialog>;
}
function ScaledPaper({resume,className=''}:{resume:ResumeDocument;className?:string}) {
  const host=useRef<HTMLDivElement>(null);
  const [scale,setScale]=useState(.44);
  useEffect(()=>{const observer=new ResizeObserver(entries=>setScale(entries[0].contentRect.width/794));if(host.current)observer.observe(host.current);return()=>observer.disconnect();},[]);
  return <div className={`thumbnail-paper ${className}`} ref={host} aria-hidden="true"><div style={{zoom:scale} as CSSProperties}><ResumePaper resume={resume} compact/></div></div>;
}

export default function App() {
  const store=useResumeStore();
  const [route,setRoute]=useState(window.location.hash.slice(1)||'templates');
  const [category,setCategory]=useState('全部模板');
  const [search,setSearch]=useState('');
  const [appearance,setAppearance]=useState(false);
  const [showPreview,setShowPreview]=useState(false);
  const [zoom,setZoom]=useState('75');
  const [modal,setModal]=useState<'guide'|'export'|'delete'|'save'|null>(null);
  const [deleteDoc,setDeleteDoc]=useState<ResumeDocument|null>(null);
  const [busy,setBusy]=useState(false);
  const [savingFile,setSavingFile]=useState(false);
  const [fileError,setFileError]=useState('');
  const [notice,setNotice]=useState('');
  const [undo,setUndo]=useState<ResumeDocument|null>(null);
  const upload=useRef<HTMLInputElement>(null);
  const [previewWidth,setPreviewWidth]=useState(900);
  const canvas=useRef<HTMLDivElement>(null);
  const active=route.startsWith('edit/')?store.docs.find(doc=>doc.id===route.slice(5)):undefined;
  const recent=[...store.docs].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
  const isMine=route==='resumes';
  const navigate=(path:string)=>{window.location.hash=path;setRoute(path);setShowPreview(false);};
  useEffect(()=>{const listener=()=>setRoute(window.location.hash.slice(1)||'templates');window.addEventListener('hashchange',listener);return()=>window.removeEventListener('hashchange',listener);},[]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>{setNotice('');setUndo(null);},6500);return()=>clearTimeout(timer);},[notice]);
  useEffect(()=>{window.scrollTo(0,0);},[route]);
  useEffect(()=>{document.title=active?`${active.title||'未命名简历'} · 简历工坊`:'简历工坊 · 写下你的下一程';},[active?.title]);
  useEffect(()=>{const el=canvas.current;if(!el)return;const observer=new ResizeObserver(entries=>setPreviewWidth(entries[0].contentRect.width));observer.observe(el);return()=>observer.disconnect();},[active?.id,showPreview]);
  useEffect(()=>{
    if(!store.storageError||!store.docs.length)return;
    const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',warn);
    return()=>window.removeEventListener('beforeunload',warn);
  },[store.storageError,store.docs.length]);
  const inform=(message:string)=>setNotice(message);
  const openSave=()=>{setFileError('');setModal('save');};
  const create=(templateId:TemplateId='classic',blank=false)=>{try{const doc=newResume(templateId,blank);store.upsert(doc);setAppearance(false);navigate(`edit/${doc.id}`);if(!blank)inform('已使用示例内容，请替换为你的真实经历。');}catch(e){inform((e as Error).message);}};
  const saveToComputer=async(method:'download'|'picker')=>{
    if(!active||savingFile)return;
    setSavingFile(true);
    setFileError('');
    try{
      const result=await (method==='picker'?saveResumeFile(active):downloadResumeFile(active));
      if(result){
        setModal(null);
        inform(result.method==='file-picker'
          ? `已保存 ${result.filename}。下次通过“打开文件”继续编辑。`
          : `已发起下载：${result.filename}。请在浏览器下载列表中确认文件已保存。`);
      }
    }catch(e){setFileError(e instanceof Error?e.message:'文件保存未完成，请重试。');}
    finally{setSavingFile(false);}
  };
  const importFile=async(file:File)=>{
    try{
      const doc=await readResumeFile(file);
      doc.id=createId();
      store.upsert(doc);
      setAppearance(false);
      navigate(`edit/${doc.id}`);
      inform('文件已打开，可以继续编辑。修改后请再次保存到电脑。');
    }catch(e){inform(e instanceof Error?e.message:'文件无法打开，请选择本站生成的简历文件。');}
    finally{if(upload.current)upload.current.value='';}
  };
  const deleteResume=async()=>{if(!deleteDoc)return;setBusy(true);try{await store.remove(deleteDoc.id);setUndo(deleteDoc);setNotice('简历已删除');setModal(null);}catch(e){inform(e instanceof Error ? e.message : '删除未完成，请稍后重试。');}finally{setBusy(false);}};
  const usedTemplates=templates.filter(t=>(category==='全部模板'||t.categories.includes(category))&&`${t.name}${t.description}${t.categories.join('')}`.includes(search.trim()));

  if(!store.ready)return <div className="loading-screen"><FileText size={42}/><h1>简历工坊</h1><p>正在读取你的简历…</p></div>;
  return <><input ref={upload} type="file" accept=".json,application/json" className="hidden-input" tabIndex={-1} aria-label="选择可编辑简历文件" onChange={e=>{if(e.target.files?.[0])void importFile(e.target.files[0]);}}/>
  {active ? <div className={`editor ${showPreview?'mobile-preview':''}`}>
    <header className="editor-header"><button className="icon-button back-button" aria-label="返回模板列表" onClick={()=>navigate('templates')}><ArrowLeft size={22}/></button><Brand onClick={()=>navigate('templates')} icon={false}/><span className="header-divider"/><div className="title-field"><input aria-label="简历名称" maxLength={100} value={active.title} onChange={e=>store.upsert({...active,title:e.target.value})}/><PencilLine size={16}/></div><div className="editor-actions"><span className="save-state"><Check size={15}/>{store.storageError?'浏览器缓存失败':store.status}</span>{!store.cacheAvailable&&<button className="icon-button cache-retry" aria-label="重试浏览器暂存" onClick={store.retry}><RotateCw size={17}/></button>}<button className="button primary save-file-button" disabled={savingFile} onClick={openSave}><Save size={17}/>{savingFile?'正在保存…':'保存到电脑'}</button><button className="button pdf-button" onClick={()=>setModal('export')}><Download size={17}/>导出 PDF</button></div></header>
    <div className="editor-toolbar"><div className="editor-tabs"><button className={!appearance?'active':''} onClick={()=>{setAppearance(false);setShowPreview(false);}}>内容编辑</button><button className={appearance?'active':''} onClick={()=>{setAppearance(true);setShowPreview(false);}}>外观设置</button></div><div className="preview-controls"><button className={`button preview-switch ${showPreview?'selected':''}`} onClick={()=>setShowPreview(!showPreview)}><Eye size={18}/><span>{showPreview?'返回编辑':'实时预览'}</span></button><label className="zoom-select"><span className="sr-only">预览缩放</span><select value={zoom} onChange={e=>setZoom(e.target.value)}><option value="60">60%</option><option value="75">75%</option><option value="90">90%</option><option value="100">100%</option><option value="fit">适应宽度</option></select></label></div></div>
    <div className="file-notice"><p>{store.storageError?'浏览器暂存暂不可用，请保存文件保留本次编辑。':'浏览器自动暂存草稿。完成编辑后，请保存到电脑，下次打开文件继续编辑。'}</p><button className="text-button" onClick={()=>upload.current?.click()}><FolderOpen size={16}/>打开文件</button></div>
    {store.storageError&&<div className="storage-warning" role="alert">{store.storageError} 请及时保存到电脑。</div>}
    <main className="editor-main"><aside className="edit-panel"><EditorForm resume={active} onChange={store.upsert} appearance={appearance}/><div className="mobile-save-state" role="status">{store.status}{!store.cacheAvailable&&<button onClick={store.retry}>重试暂存</button>}</div></aside><div ref={canvas} className="preview-canvas"><div className="preview-page" style={{zoom:Math.min(zoom==='fit'?1:Number(zoom)/100,Math.max(.2,(previewWidth-48)/794))} as CSSProperties}><ResumePaper resume={active}/></div><p className="paper-note">A4 纸张 · 内容较长时，导出自动分页</p></div></main>
    <div className="print-surface"><ResumePaper resume={active}/></div>
  </div> : <div className="workspace"><header className="site-header"><div className="header-inner"><Brand onClick={()=>navigate('templates')}/><nav aria-label="主导航"><button className={!isMine?'active':''} onClick={()=>navigate('templates')}>简历模板</button><button className={isMine?'active':''} onClick={()=>navigate('resumes')}>我的简历</button><button onClick={()=>setModal('guide')}>使用指南</button></nav><div className="header-actions"><button className="button" aria-label="打开简历文件" onClick={()=>upload.current?.click()}><Upload size={16}/><span>打开文件</span></button><button className="button primary" onClick={()=>create('classic',true)}><Plus size={18}/><span>新建简历</span></button></div></div></header>
    <main className="home-main"><div className="welcome"><div><h1>{isMine?'每一份努力，都有迹可循。':'让你的经历，值得被看见。'}</h1><p>{isMine?'这里是当前浏览器的草稿，也可以打开电脑上的简历文件。':'从一份好模板开始，写下你的下一程。'}</p></div><span className="privacy-label"><ShieldCheck size={19}/>文件存于自己电脑 · 无需登录</span></div>
    {!isMine&&recent&&<section className="continue-banner"><div className="document-symbol"><FileText size={28}/></div><div><h2>{recent.title||'未命名简历'}</h2><p>此浏览器暂存的草稿，可继续编辑</p></div><button className="button primary" onClick={()=>navigate(`edit/${recent.id}`)}>继续编辑<ArrowRight size={18}/></button></section>}
    <p className="local-file-intro"><FolderOpen size={17}/><span>保存可编辑的简历文件到电脑。下次访问网站，点击“打开文件”即可继续。</span></p>
    <section className="template-section"><div className="section-heading"><h2>{isMine?'我的简历':'挑选适合你的简历模板'}</h2><span>{isMine?`${store.docs.length} 份浏览器草稿`:'3 款精选模板'}</span></div>
    {!isMine&&<div className="filter-bar"><div className="category-tabs" role="group" aria-label="模板分类">{['全部模板','简约专业','校园求职','设计创意'].map(c=><button key={c} className={category===c?'selected':''} aria-pressed={category===c} onClick={()=>setCategory(c)}>{c}</button>)}</div><label className="search-box"><Search size={18}/><input aria-label="搜索模板" placeholder="搜索模板" value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button className="icon-button" aria-label="清空搜索" onClick={()=>setSearch('')}><X size={15}/></button>}</label></div>}
    {!isMine ? <div className="template-grid">{usedTemplates.map(t=><button className="template-card" key={t.id} onClick={()=>create(t.id)} aria-label={`使用${t.name}模板`}><ScaledPaper resume={newResume(t.id)}/><div className="template-info"><div><h3>{t.name}</h3><p>{t.description}</p></div><ArrowRight size={19}/></div><span className="template-hover-action">使用此模板<ArrowRight size={16}/></span></button>)}{!usedTemplates.length&&<div className="empty-state"><Search size={36}/><h3>没有找到匹配的模板</h3><p>试试“简约”，或者查看全部模板。</p><button className="button" onClick={()=>{setSearch('');setCategory('全部模板');}}>查看全部模板</button></div>}</div> : <div className="template-grid saved-grid">{store.docs.map(doc=><article className="saved-card" key={doc.id}><button className="saved-preview" onClick={()=>navigate(`edit/${doc.id}`)} aria-label={`编辑${doc.title}`}><ScaledPaper resume={doc}/></button><div className="saved-details"><h3>{doc.title||'未命名简历'}</h3><p>更新于 {new Date(doc.updatedAt).toLocaleString('zh-CN',{month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'})}</p><div><button className="text-button" onClick={()=>navigate(`edit/${doc.id}`)}>继续编辑<ChevronRight size={16}/></button><button className="icon-button" aria-label={`复制${doc.title}`} onClick={async()=>{try{await store.duplicate(doc);inform('已创建简历副本');}catch(e){inform((e as Error).message);}}}><Copy size={16}/></button><button className="icon-button danger" aria-label={`删除${doc.title}`} onClick={()=>{setDeleteDoc(doc);setModal('delete');}}><Trash2 size={16}/></button></div></div></article>)}{!store.docs.length&&<div className="empty-state"><FolderOpen size={38}/><h3>你的第一份简历，从这里开始</h3><p>已有文件？点击右上方“打开文件”继续编辑。</p><button className="button primary" onClick={()=>navigate('templates')}>挑选模板<ArrowRight size={16}/></button></div>}</div>}
    </section><footer className="home-footer"><LockKeyhole size={13}/><span>简历在浏览器中编辑，不上传服务器。请将简历文件保存到自己的电脑。</span>{store.storageError&&<button className="service-state offline" onClick={store.retry}><span/>重试浏览器暂存</button>}</footer>{store.storageError&&<p className="storage-warning" role="alert">{store.storageError}</p>}</main></div>}
  {modal==='guide'&&<Modal title="写好简历，从这三步开始" onClose={()=>setModal(null)}><div className="guide-steps">{[['01','挑一款适合你的模板','模板中的内容是虚构示例。选择模板后，将信息替换为你的真实经历；也可以点击“新建简历”从空白开始。'],['02','写清楚经历，也写出成果','逐项填写基本信息、工作、教育和项目经历。每行一个要点，用真实数据说明你的贡献。外观设置可随时切换模板与颜色。'],['03','保存文件，下次接着写','点击“保存到电脑”，保留 .resume.json 简历文件。下次访问网站，点击“打开文件”选择它，即可恢复内容、模板和配色。修改后再次保存文件。']].map(([n,t,p])=><div key={n}><span>{n}</span><section><h3>{t}</h3><p>{p}</p></section></div>)}</div><p className="guide-note">浏览器暂存不会自动更新电脑里的文件；清除浏览器数据会移除草稿。投递简历时使用“导出 PDF”。可继续编辑的文件为本站 JSON 格式，兼容旧版备份，暂不支持打开 Word 或 PDF 编辑。</p><button className="button primary wide" onClick={()=>setModal(null)}>开始制作<ArrowRight size={17}/></button></Modal>}
  {modal==='save'&&active&&<Modal title="保存可编辑简历" onClose={()=>!savingFile&&setModal(null)}><p className="save-description">文件包含全部简历内容、模板和配色。下次在网站点击“打开文件”，就能继续编辑。</p><div className="save-filename"><FileText size={22}/><span>{resumeFilename(active.title)}</span></div><p className="save-description">普通下载会按浏览器设置保存。每次修改后请重新保存文件；浏览器暂存不会自动更新电脑里的文件。</p>{fileError&&<p className="save-error" role="alert">{fileError}</p>}<div className="modal-buttons">{'showSaveFilePicker' in window&&<button className="button" disabled={savingFile} onClick={()=>void saveToComputer('picker')}>选择保存位置</button>}<button className="button primary" disabled={savingFile} onClick={()=>void saveToComputer('download')}><Download size={17}/>{savingFile?'正在保存…':'普通下载'}</button></div></Modal>}
  {modal==='export'&&<Modal title="导出你的简历" onClose={()=>setModal(null)}><div className="export-icon"><FileText size={38}/></div><h3 className="export-title">{active?.title||'未命名简历'}</h3><p className="export-description">将打开浏览器打印窗口。选择“另存为 PDF”即可保存清晰、可选中文字的简历。</p><ul className="export-tips"><li>纸张：A4，缩放：100%</li><li>关闭“页眉和页脚”，开启“背景图形”</li><li>确认分页与联系方式后再保存</li></ul><div className="modal-buttons"><button className="button" disabled={savingFile} onClick={openSave}>保存可编辑文件</button><button className="button primary" onClick={()=>{setModal(null);window.setTimeout(()=>window.print(),100);}}><Download size={17}/>打开打印窗口</button></div></Modal>}
  {modal==='delete'&&<Modal title="删除这份简历？" onClose={()=>!busy&&setModal(null)}><p className="delete-description">“{deleteDoc?.title}”将从当前浏览器的草稿中移除。电脑上已保存的简历文件会保留。</p><div className="modal-buttons"><button className="button" disabled={busy} onClick={()=>setModal(null)}>保留简历</button><button className="button danger-button" disabled={busy} onClick={()=>void deleteResume()}>{busy?'正在删除…':'删除简历'}</button></div></Modal>}
  {notice&&<div className="toast" role="status"><Check size={17}/><span>{notice}</span>{undo&&<button onClick={()=>{try{store.upsert(undo);setUndo(null);setNotice('简历已恢复');}catch(e){setNotice((e as Error).message);}}}>撤销</button>}<button aria-label="关闭提示" onClick={()=>setNotice('')}><X size={16}/></button></div>}
  </>;
}
