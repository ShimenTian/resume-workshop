import { useState } from 'react';
import { ArrowRight, ArrowUpRight, Heart, Search, SlidersHorizontal, X } from 'lucide-react';
import { catalog, categories, previewResumes, type DesignTemplate } from '../lib/catalog';
import { ResumePaper } from './ResumePaper';

interface TemplateGalleryProps {
  full?: boolean;
  onSelect: (template: DesignTemplate) => void;
  onAll: () => void;
  favorites: string[];
  onFavorite: (key: string) => void;
}

export function TemplateGallery({ full = false, onSelect, onAll, favorites, onFavorite }: TemplateGalleryProps) {
  const [category, setCategory] = useState('全部模板');
  const [query, setQuery] = useState('');
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = catalog.filter((template) =>
    (category === '全部模板' || template.categories.includes(category))
    && (!favoriteOnly || favorites.includes(template.key))
    && [template.name, template.label, template.description, ...template.categories].join(' ').toLocaleLowerCase().includes(normalizedQuery));
  const shown = full || category !== '全部模板' || normalizedQuery || favoriteOnly ? filtered : filtered.slice(0, 4);

  function resetFilters() {
    setQuery('');
    setCategory('全部模板');
    setFavoriteOnly(false);
  }

  return <section className={`template-section section-width ${full ? 'template-section-full' : ''}`} id="templates">
    <div className="section-heading">
      <div>
        <h2>{full ? '找到适合你的表达方式' : '好简历，从适合你的模板开始'}</h2>
        <p>{full ? '选一个喜欢的版式，把自己的故事写进去。' : '用清晰的设计，呈现真实的实力。'}</p>
      </div>
      {!full && <button className="text-button" onClick={onAll}>查看全部模板 <ArrowRight size={16} /></button>}
    </div>

    <div className="gallery-toolbar">
      <div className="category-tabs" aria-label="模板分类">
        {categories.map((item) => <button key={item} className={category === item ? 'active' : ''} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}
      </div>
      {full
        ? <button className={`text-button favorite-filter ${favoriteOnly ? 'selected' : ''}`} aria-pressed={favoriteOnly} onClick={() => setFavoriteOnly((current) => !current)}><Heart size={16} /> 我的收藏</button>
        : <span className="gallery-hint"><SlidersHorizontal size={14} /> 颜色与内容均可定制</span>}
    </div>

    {full && <div className="template-search">
      <Search size={18} />
      <input aria-label="搜索模板" placeholder="搜索模板名称、风格或求职阶段" value={query} onChange={(event) => setQuery(event.target.value)} />
      {query && <button aria-label="清空搜索" onClick={() => setQuery('')}><X size={16} /></button>}
      <span role="status" aria-live="polite">{filtered.length} 款模板</span>
    </div>}

    <div className="template-grid">
      {shown.map((template) => {
        const favorite = favorites.includes(template.key);
        return <article className="template-card" key={template.key}>
          <div className="template-media" style={{ background: template.background }}>
            <button className={`favorite-button ${favorite ? 'is-favorite' : ''}`} aria-label={`${favorite ? '取消收藏' : '收藏'}${template.name}`} aria-pressed={favorite} onClick={() => onFavorite(template.key)}>
              <Heart size={17} fill={favorite ? 'currentColor' : 'none'} />
            </button>
            <button className="template-open" aria-label={`预览${template.name}`} onClick={() => onSelect(template)}>
              <div className="mini-paper" aria-hidden="true"><ResumePaper resume={previewResumes[template.key]} compact /></div>
              <span className="preview-cta">预览模板 <ArrowUpRight size={16} /></span>
            </button>
          </div>
          <button className="template-caption" onClick={() => onSelect(template)}>
            <span><strong>{template.name}</strong><small>{template.label}</small></span>
            <ArrowUpRight size={19} />
          </button>
        </article>;
      })}
    </div>

    {shown.length === 0 && <div className="empty-results">
      <Search size={30} />
      <h3>{favoriteOnly && favorites.length === 0 ? '还没有收藏模板' : '暂时没有找到匹配的模板'}</h3>
      <p>{favoriteOnly && favorites.length === 0 ? '点击模板右上角的爱心，把喜欢的款式留在这里。' : '试试其他关键词，或浏览全部模板。'}</p>
      <button className="btn btn-secondary" onClick={resetFilters}>查看全部模板</button>
    </div>}
  </section>;
}
