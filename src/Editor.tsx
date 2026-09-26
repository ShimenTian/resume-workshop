import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { AlertTriangle, ArrowLeft, ArrowUpRight, BookOpen, Check, ChevronDown, Download, FileText, FolderOpen, LayoutTemplate, LoaderCircle, Maximize2, Minus, Palette, PencilLine, Plus, RotateCw, Save, ShieldCheck, X } from 'lucide-react';
import { EditorForm } from './components/EditorForm';
import { ResumePaper } from './components/ResumePaper';
import { RESUME_LIMITS, type ResumeDocument } from './lib/resume';
import './Editor.css';

export interface EditorProps {
  resume: ResumeDocument;
  onChange: (doc: ResumeDocument) => void;
  onBack: () => void;
  onSave: () => void;
  status: string;
  onTool: () => void;
  onOpen: () => void;
  storageError?: string;
  onRetry: () => void;
  saving?: boolean;
}

export function Editor({ resume, onChange, onBack, onSave, status, onTool, onOpen, storageError, onRetry, saving = false }: EditorProps) {
  const [appearance, setAppearance] = useState(false);
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit');
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  const [canvasWidth, setCanvasWidth] = useState(900);
  const [exportOpen, setExportOpen] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const formPanelRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setCanvasWidth(entry.contentRect.width);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (exportOpen && !dialogRef.current?.open) dialogRef.current?.showModal();
  }, [exportOpen]);

  const fitScale = Math.max(.25, Math.min(.84, (canvasWidth - (canvasWidth < 500 ? 32 : 88)) / 794));
  const paperScale = zoom === 'fit' ? fitScale : zoom / 100;
  const changeZoom = (amount: number) => setZoom(Math.max(35, Math.min(125, Math.round(paperScale * 100 / 5) * 5 + amount)));
  const selectPanel = (value: boolean) => {
    setAppearance(value);
    setMobileView('edit');
    formPanelRef.current?.scrollTo({ top: 0 });
  };
  const closeExport = () => {
    dialogRef.current?.close();
    setExportOpen(false);
  };
  const saveFromExport = () => {
    closeExport();
    onSave();
  };
  const print = () => {
    closeExport();
    window.setTimeout(() => window.print(), 100);
  };

  return <div className="editor-app">
    <header className="editor-topbar">
      <button className="editor-back" onClick={onBack} aria-label="返回工作台"><ArrowLeft size={19} /></button>
      <button className="editor-wordmark" onClick={onBack} aria-label="简历工坊工作台"><span className="editor-logo"><FileText size={20} /></span><span>简历工坊</span></button>
      <span className="editor-header-line" />
      <label className="editor-title"><input aria-label="简历名称" value={resume.title} maxLength={RESUME_LIMITS.title} onChange={(event) => onChange({ ...resume, title: event.target.value })} /><PencilLine size={13} /></label>
      <div className="editor-top-actions">
        <span className={`editor-save-state ${storageError ? 'has-error' : ''}`} role="status">{storageError ? <AlertTriangle size={14} /> : <Check size={14} />}{storageError ? '浏览器暂存失败' : status}</span>
        <button className="btn btn-primary editor-save" disabled={saving} onClick={onSave}>{saving ? <LoaderCircle size={15} /> : <Save size={15} />}<span>{saving ? '正在保存…' : '保存到电脑'}</span></button>
        <button className="btn btn-secondary editor-export" disabled={saving} onClick={() => setExportOpen(true)}><Download size={15} /><span>导出 PDF</span><ChevronDown size={13} /></button>
      </div>
    </header>

    <div className="editor-file-notice"><p>浏览器暂存不会更新电脑上的文件，修改完成后请再次保存。</p><button onClick={onOpen} disabled={saving}><FolderOpen size={15} /><span>打开文件</span></button></div>
    {storageError && <div className="editor-storage-alert" role="alert"><AlertTriangle size={17} /><p>{storageError} 请保存到电脑，保留本次编辑。</p><button onClick={onRetry}><RotateCw size={14} />重试暂存</button></div>}

    <div className="editor-mobile-tabs" role="tablist" aria-label="编辑视图">
      <button role="tab" aria-selected={mobileView === 'edit'} className={mobileView === 'edit' ? 'active' : ''} onClick={() => setMobileView('edit')}>编辑简历</button>
      <button role="tab" aria-selected={mobileView === 'preview'} className={mobileView === 'preview' ? 'active' : ''} onClick={() => setMobileView('preview')}>实时预览</button>
    </div>

    <div className={`editor-workspace editor-mobile-${mobileView}`}>
      <nav className="editor-rail" aria-label="编辑工具">
        <button className={!appearance ? 'active' : ''} onClick={() => selectPanel(false)} aria-pressed={!appearance}><PencilLine size={21} /><span>内容</span></button>
        <button className={appearance ? 'active' : ''} onClick={() => selectPanel(true)} aria-pressed={appearance}><Palette size={21} /><span>样式</span></button>
        <div className="editor-rail-divider" />
        <button onClick={onTool}><BookOpen size={21} /><span>指南</span></button>
        <span className="editor-rail-bottom"><ShieldCheck size={19} /></span>
      </nav>

      <aside ref={formPanelRef} className="editor-form-panel" aria-label={appearance ? '简历样式设置' : '简历内容编辑'}>
        <div className="editor-panel-heading"><div><h1>{appearance ? '让风格，恰如其分。' : '每一段经历，都值得被看见。'}</h1></div><span className="editor-step-mark">{appearance ? <LayoutTemplate size={18} /> : '01'}</span></div>
        <p className="editor-panel-description">{appearance ? '选择适合你的版式，展现清晰的个人风格。' : '从基本信息开始，右侧会实时呈现你的修改。'}</p>
        {!appearance && <button className="editor-guide-card" onClick={onTool}><span className="editor-guide-icon"><BookOpen size={18} /></span><span><strong>写清贡献，写出成果</strong><small>查看经历表达建议</small></span><ArrowUpRight size={18} /></button>}
        <EditorForm key={resume.id} resume={resume} onChange={onChange} appearance={appearance} />
        <div className={`editor-local-status ${storageError ? 'has-error' : ''}`} role="status"><span className="editor-status-dot" /><span>{storageError ? '浏览器暂存未成功，请保存文件保留修改。' : status}</span>{storageError && <button onClick={onRetry}>重试</button>}</div>
        <p className="editor-local-hint">保存到电脑后，下次打开简历文件即可继续编辑。</p>
      </aside>

      <section className="editor-preview" aria-label="简历实时预览">
        <div className="editor-preview-toolbar"><span className="editor-preview-label"><span />实时预览<small>A4 · 210 × 297 mm</small></span><button className="editor-fit-button" onClick={() => setZoom('fit')}><Maximize2 size={14} />适应画布</button></div>
        <div className="editor-preview-canvas" ref={canvasRef}>
          <div className="editor-paper" style={{ zoom: paperScale } as CSSProperties}><ResumePaper resume={resume} /></div>
          <p className="editor-paper-note"><ShieldCheck size={12} />简历在浏览器中编辑 · 保存文件以便下次继续</p>
        </div>
        <div className="editor-zoom-control" aria-label="预览缩放"><button onClick={() => changeZoom(-10)} disabled={zoom !== 'fit' && zoom <= 35} aria-label="缩小预览"><Minus size={15} /></button><label><span className="editor-sr-only">缩放比例</span><select value={zoom} onChange={(event) => setZoom(event.target.value === 'fit' ? 'fit' : Number(event.target.value))}><option value="fit">适应宽度</option>{[...new Set([50, 65, 75, 85, 100, 125, ...(zoom === 'fit' ? [] : [zoom])])].sort((a, b) => a - b).map((value) => <option key={value} value={value}>{value}%</option>)}</select></label><button onClick={() => changeZoom(10)} disabled={zoom !== 'fit' && zoom >= 125} aria-label="放大预览"><Plus size={15} /></button></div>
      </section>
    </div>

    <div className="print-surface"><ResumePaper resume={resume} /></div>

    {exportOpen && <dialog className="editor-export-dialog" ref={dialogRef} aria-labelledby="editor-export-title" aria-describedby="editor-export-description" onClose={() => setExportOpen(false)} onCancel={closeExport} onClick={(event) => {
      if (event.target !== dialogRef.current) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeExport();
    }}>
      <button className="editor-dialog-close" aria-label="关闭导出说明" onClick={closeExport}><X size={20} /></button>
      <span className="editor-export-symbol"><Download size={27} /></span>

      <h2 id="editor-export-title">一份好简历，准备就绪。</h2>
      <p id="editor-export-description">通过浏览器打印窗口，保存清晰、可选中文字的 PDF 简历。</p>
      <div className="editor-print-settings"><span><Check size={14} />纸张选择 A4，缩放 100%</span><span><Check size={14} />关闭页眉页脚，开启背景图形</span><span><Check size={14} />预览分页，确认联系方式</span></div>
      <p className="editor-export-reminder">可编辑文件能保留全部内容和样式，方便下次继续修改。</p>
      <div className="editor-dialog-actions"><button className="btn btn-secondary" disabled={saving} onClick={saveFromExport}><Save size={15} />保存可编辑文件</button><button className="btn btn-primary" onClick={print}><Download size={15} />继续导出 PDF</button></div>
    </dialog>}
  </div>;
}

export default Editor;
