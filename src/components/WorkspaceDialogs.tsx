import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, Check, Download, FileText, FolderOpen, Save, X } from 'lucide-react';
import { previewResumes, type DesignTemplate } from '../lib/catalog';
import { resumeFilename } from '../lib/resumeFile';
import type { ResumeDocument } from '../lib/resume';
import { ResumePaper } from './ResumePaper';
import './WorkspaceDialogs.css';

export function Dialog({ title, children, onClose, busy = false }: {
  title: string; children: ReactNode; onClose: () => void; busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="workshop-dialog" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div className="workshop-dialog-heading"><h2 id={titleId}>{title}</h2><button className="icon-button" aria-label="关闭弹窗" disabled={busy} onClick={onClose}><X size={20}/></button></div>
    {children}
  </dialog>;
}

export function TemplatePreview({ template, onClose, onUse }: {
  template: DesignTemplate; onClose: () => void; onUse: (template: DesignTemplate) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [accent, setAccent] = useState(template.accent);
  useEffect(() => { ref.current?.showModal(); }, []);
  const resume = { ...previewResumes[template.key], accent };
  return <dialog ref={ref} className="template-dialog" aria-labelledby={titleId}
    onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="template-dialog-inner">
      <button className="dialog-close icon-button" aria-label="关闭模板预览" onClick={onClose}><X size={20}/></button>
      <div className="template-dialog-paper" style={{ background: template.background }}><div className="large-paper"><ResumePaper resume={resume}/></div></div>
      <div className="template-dialog-info">
        <span className="detail-label">简历模板 / {template.categories[0]}</span>
        <h2 id={titleId}>{template.name}</h2><p>{template.description}</p>
        <div className="detail-features"><span><Check size={16}/>内容随时编辑</span><span><Check size={16}/>高清 PDF 导出</span><span><Check size={16}/>一键更换版式</span></div>
        <div className="detail-colors"><h3>选一个喜欢的颜色</h3><div>{[...new Set([template.accent, '#167d67', '#303d39', '#3e5970', '#a17b45', '#985e61'])].map(color =>
          <button key={color} aria-label={`选择配色 ${color}`} aria-pressed={accent === color} className={accent === color ? 'selected' : ''} style={{ background: color }} onClick={() => setAccent(color)}>{accent === color && <Check size={15}/>}</button>)}</div></div>
        <button className="btn btn-primary" onClick={() => onUse({ ...template, accent })}>使用这个模板<ArrowRight size={18}/></button>
        <small className="sample-note">预览中的姓名与经历为虚构示例。</small>
      </div>
    </div>
  </dialog>;
}

export function SaveDialog({ resume, saving, error, onSave, onClose }: {
  resume: ResumeDocument; saving: boolean; error: string; onSave: (method: 'download' | 'picker') => void; onClose: () => void;
}) {
  return <Dialog title="保存你的下一程" onClose={onClose} busy={saving}>
    <p className="dialog-description">把可编辑的简历文件留在自己的电脑上。内容、模板和配色都会一起保存。</p>
    <div className="resume-file-card"><span><FileText size={25}/></span><div><strong>{resumeFilename(resume.title)}</strong><small>可编辑简历文件 · JSON 格式</small></div></div>
    <div className="file-flow"><span><Save size={16}/>保存文件</span><ArrowRight size={15}/><span><FolderOpen size={16}/>下次打开，继续编辑</span></div>
    <p className="dialog-hint">浏览器暂存不会自动更新电脑上的文件，每次修改后请重新保存。普通下载将使用浏览器设置的下载位置。</p>
    {error && <p className="dialog-error" role="alert">{error}</p>}
    <div className="workshop-dialog-actions">{'showSaveFilePicker' in window && <button className="btn btn-secondary" disabled={saving} onClick={() => onSave('picker')}>选择保存位置</button>}<button className="btn btn-primary" disabled={saving} onClick={() => onSave('download')}><Download size={16}/>{saving ? '正在保存…' : '普通下载'}</button></div>
  </Dialog>;
}

export function GuideDialog({ mode, onClose }: { mode: 'guide' | 'files'; onClose: () => void }) {
  const steps = mode === 'guide' ? [
    ['01', '选一个适合你的版式', '先预览模板和配色，确认喜欢后再开始。模板中的内容是虚构示例，请替换为自己的信息。'],
    ['02', '写清贡献，也写出成果', '经历按时间倒序填写。每个要点可以依次交代你负责什么、采取了什么行动，以及取得什么结果。'],
    ['03', '检查预览，准备投递', '逐项检查联系方式和日期，通过实时预览确认排版。投递时导出 PDF，同时保存可编辑文件，方便下次修改。'],
  ] : [
    ['01', '编辑内容，自动暂存', '网页会把草稿暂存于当前浏览器。更换浏览器、设备或清除网站数据后，草稿可能不再显示。'],
    ['02', '保存到自己的电脑', '在编辑器点击“保存到电脑”，选择“普通下载”或“选择保存位置”。生成的 .resume.json 文件包含全部内容、模板和配色。'],
    ['03', '打开文件，接着编辑', '下次访问网站，点击“打开简历文件”并选择保存的文件。修改完成后请再次保存；打开文件会创建一份新草稿，保留原有草稿。'],
  ];
  return <Dialog title={mode === 'guide' ? '认真表达，从这三步开始' : '简历在自己手里，随时接着写'} onClose={onClose}>
    <div className="workshop-guide-steps">{steps.map(([number, title, description]) => <section key={number}><span>{number}</span><div><h3>{title}</h3><p>{description}</p></div></section>)}</div>
    <p className="dialog-hint">简历内容不上传服务器。可编辑文件支持本站 JSON 格式及旧版备份，PDF 用于投递和分享，暂不支持从 Word 或 PDF 恢复编辑。</p>
    <button className="btn btn-primary dialog-wide" onClick={onClose}>明白了<Check size={16}/></button>
  </Dialog>;
}
