import { newResume, type ResumeDocument, type TemplateId } from './resume';

export interface DesignTemplate {
  key: string; name: string; label: string; templateId: TemplateId;
  accent: string; background: string; categories: string[]; description: string;
}
export const catalog: DesignTemplate[] = [
  { key:'fresh', name:'清新 · 经典', label:'清晰有序，专业从容', templateId:'classic', accent:'#167d67', background:'#edf4f0', categories:['简约专业','应届生'], description:'用清晰的层级与舒适的留白，认真呈现每一段经历。适合初次求职与日常投递。' },
  { key:'minimal', name:'留白 · 极简', label:'少一点装饰，多一分专注', templateId:'classic', accent:'#303d39', background:'#f0f0ed', categories:['简约专业','商务精英'], description:'克制的黑白配色，让阅读者专注于你的能力、经验与成果。' },
  { key:'business', name:'秩序 · 商务', label:'分栏布局，重点一目了然', templateId:'sidebar', accent:'#3e5970', background:'#edf1f5', categories:['商务精英'], description:'独立的信息侧栏与完整的经历正文，让丰富的履历保持清晰。' },
  { key:'creative', name:'灵感 · 创意', label:'利落线条，表达个人风格', templateId:'modern', accent:'#a17b45', background:'#f5f1e9', categories:['创意设计'], description:'细致的线条与柔和的暖色，适合需要展现个人风格的创意岗位。' },
  { key:'campus', name:'初光 · 校园', label:'从第一份经历开始', templateId:'modern', accent:'#387b73', background:'#ecf4f2', categories:['应届生','简约专业'], description:'用有条理的布局展示教育背景、课程项目与实践经历。' },
  { key:'design', name:'青屿 · 双栏', label:'让内容与设计相得益彰', templateId:'sidebar', accent:'#427167', background:'#eef3ed', categories:['创意设计','商务精英'], description:'沉稳的绿色侧栏与简洁正文结合，让个性与专业感并存。' },
];
export const categories = ['全部模板','简约专业','应届生','商务精英','创意设计'];
export function makeExample(t:DesignTemplate = catalog[0]):ResumeDocument {
  const doc = newResume(t.templateId);
  doc.accent=t.accent;
  doc.profile.name='林晓';
  doc.profile.role='产品设计师';
  doc.profile.email='linxiao@example.com';
  doc.profile.website='portfolio.example.com';
  doc.title='林晓 · 产品设计师';
  doc.profile.summary='4 年互联网产品设计经验，关注用户体验与业务价值。擅长从用户研究中发现问题，以清晰的设计推动产品迭代，让每一次体验更简单。';
  doc.experiences[0].company='知行科技（示例）';
  doc.experiences[0].role='高级产品设计师';
  doc.experiences[1].company='拾光设计（示例）';
  doc.experiences[1].role='用户体验设计师';
  doc.skills='用户研究 / 交互设计 / 视觉设计 / Figma / 设计系统 / 跨团队协作';
  return doc;
}
export const previewResumes=Object.fromEntries(catalog.map(t=>[t.key,makeExample(t)]));
