import { ArrowRight, ArrowUpRight, BookOpen, Check, CheckCheck, FilePenLine, FolderOpen, LayoutTemplate } from 'lucide-react';
import { ResumePaper } from './ResumePaper';
import { TemplateGallery } from './TemplateGallery';
import { previewResumes, type DesignTemplate } from '../lib/catalog';

export type ToolName = 'create' | 'open' | 'templates' | 'guide';

export const toolItems = [
  { id: 'create' as const, title: '开始制作', description: '从一份简历，认真介绍自己', Icon: FilePenLine },
  { id: 'open' as const, title: '打开简历', description: '打开电脑文件，继续上次编辑', Icon: FolderOpen },
  { id: 'templates' as const, title: '挑选模板', description: '清晰的版式，呈现真实的实力', Icon: LayoutTemplate },
  { id: 'guide' as const, title: '制作指南', description: '从填写到导出，每一步都清楚', Icon: BookOpen },
];

interface HomeProps {
  onCreate: () => void;
  onTemplates: () => void;
  onTool: (tool: ToolName) => void;
  onSelect: (template: DesignTemplate) => void;
  favorites: string[];
  onFavorite: (key: string) => void;
}

export function Home({ onCreate, onTemplates, onTool, onSelect, favorites, onFavorite }: HomeProps) {
  return <>
    <section className="hero">
      <div className="hero-inner section-width">
        <div className="hero-copy">
          <h1>让每一份经历，<br /><span>都有闪光的表达。</span></h1>
          <p>从第一份简历，到下一次职业跃迁。<br />专业模板与本地文件，陪你认真准备每一个机会。</p>
          <div className="hero-actions">
            <button className="btn btn-primary btn-large" onClick={onCreate}>免费制作简历 <ArrowRight size={18} /></button>
            <button className="btn btn-secondary btn-large" onClick={onTemplates}>浏览简历模板</button>
          </div>
          <div className="hero-checks">
            {['实时预览', '本地保存', 'PDF 高清导出'].map((text) => <span key={text}><Check size={14} />{text}</span>)}
          </div>
        </div>
        <div className="hero-art" role="img" aria-label="绿色经典简历模板效果预览">
          <div className="hero-orbit" />
          <div className="paper-back"><div /><div /><div /></div>
          <div className="hero-paper"><ResumePaper resume={previewResumes.fresh} /></div>
          <div className="paper-note">
            <span><CheckCheck size={20} /></span>
            <div><strong>你的经历，值得被看见</strong><small>用专业的表达，开启下一程</small></div>
          </div>
          <span className="paper-caption">DESIGNED FOR YOUR NEXT CHAPTER</span>
        </div>
      </div>
    </section>

    <section className="tools-rail section-width" aria-label="简历工具">
      {toolItems.map(({ id, title, description, Icon }) => <button key={id} className="tool-shortcut" onClick={() => onTool(id)}>
        <span className="tool-shortcut-icon"><Icon size={23} strokeWidth={1.65} /></span>
        <span><strong>{title}</strong><small>{description}</small></span>
        <ArrowUpRight className="shortcut-arrow" size={15} />
      </button>)}
    </section>

    <TemplateGallery onSelect={onSelect} onAll={onTemplates} favorites={favorites} onFavorite={onFavorite} />

    <section className="closing-strip section-width">
      <div>
        <span className="closing-symbol"><FilePenLine size={26} strokeWidth={1.5} /></span>
        <div><h2>下一次机会，从这里开始。</h2><p>把时间留给准备，让我们帮你整理好表达。</p></div>
      </div>
      <button className="text-button" onClick={onCreate}>开始我的简历 <ArrowRight size={18} /></button>
    </section>
  </>;
}
