export type TemplateId = 'classic' | 'sidebar' | 'modern';

export interface ResumeProfile {
  name: string;
  role: string;
  phone: string;
  email: string;
  city: string;
  website: string;
  summary: string;
}

export interface Experience {
  id: string;
  company: string;
  role: string;
  period: string;
  description: string;
}

export interface Education {
  id: string;
  school: string;
  degree: string;
  period: string;
  description: string;
}

export interface Project {
  id: string;
  name: string;
  role: string;
  period: string;
  description: string;
}

export interface ResumeDocument {
  id: string;
  title: string;
  updatedAt: string;
  templateId: TemplateId;
  accent: string;
  profile: ResumeProfile;
  experiences: Experience[];
  education: Education[];
  projects: Project[];
  skills: string;
}

export interface ResumeTemplate {
  id: TemplateId;
  name: string;
  description: string;
  categories: string[];
}

export const templates: ResumeTemplate[] = [
  { id: 'classic', name: '经典简约', description: '清晰的层次，让经历一目了然', categories: ['简约专业', '校园求职'] },
  { id: 'sidebar', name: '左右分栏', description: '信息分区，突出你的专业优势', categories: ['简约专业', '设计创意'] },
  { id: 'modern', name: '现代线条', description: '利落线条，呈现独特的个人风格', categories: ['校园求职', '设计创意'] },
];

export const RESUME_STORAGE_KEY = 'resume-workshop:documents:v1';
export const RESUME_LIMITS = {
  documents: 50,
  sectionEntries: 20,
  // Accommodates every valid document, including JSON's six-character escapes.
  importCharacters: 2 * 1024 * 1024,
  importBytes: 2 * 1024 * 1024,
  storageCharacters: 4_000_000,
  title: 100,
  shortText: 160,
  summary: 4_000,
  description: 4_000,
  skills: 2_000,
} as const;

export type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

/** Minimal interface also allows deterministic storage tests without a browser. */
export interface ResumeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export class ResumeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResumeValidationError';
  }
}

export function createId(): string {
  return globalThis.crypto?.randomUUID?.()
    ?? `resume-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** All people, organizations and accomplishments in this starter are fictional. */
export function newResume(templateId: TemplateId = 'classic', blank = false): ResumeDocument {
  const resume: ResumeDocument = {
    id: createId(),
    title: blank ? '未命名简历' : '产品经理 · 求职简历',
    updatedAt: new Date().toISOString(),
    templateId,
    accent: { classic: '#25375a', sidebar: '#304867', modern: '#465fe9' }[templateId],
    profile: { name: '', role: '', phone: '', email: '', city: '', website: '', summary: '' },
    experiences: [],
    education: [],
    projects: [],
    skills: '',
  };
  if (blank) return resume;
  resume.profile = {
    name: '林知夏',
    role: '产品经理',
    phone: '138 0000 0000',
    email: 'zhixia.lin@example.com',
    city: '上海',
    website: 'portfolio.example.com',
    summary: '4 年互联网产品经验，专注用户增长与体验优化。擅长从用户研究中发现需求，结合数据分析推进产品迭代，与设计、研发团队协作，让想法成为有价值的产品。',
  };
  resume.experiences = [
    {
      id: createId(), company: '拾光科技（示例）', role: '产品经理', period: '2023.07 — 至今',
      description: '负责学习平台的核心产品规划，完成用户访谈与需求优先级梳理。\n主导新用户引导流程改版，通过分组实验将首周激活率提升 18%。\n协调设计、研发与运营团队，建立产品复盘机制，持续跟踪关键指标。',
    },
    {
      id: createId(), company: '青屿数字（示例）', role: '产品助理', period: '2022.07 — 2023.06',
      description: '参与企业协作工具的需求分析与原型设计，支持 6 个版本顺利上线。\n整理客户反馈并建立需求库，协助优化信息架构与核心操作路径。',
    },
  ];
  resume.education = [{
    id: createId(), school: '江南城市大学（示例）', degree: '信息管理与信息系统 · 本科', period: '2018.09 — 2022.06',
    description: '主修：管理信息系统、统计学、数据库原理、用户体验设计。',
  }];
  resume.projects = [{
    id: createId(), name: '学习平台新用户体验优化', role: '项目负责人', period: '2024.03 — 2024.06',
    description: '围绕新用户首次使用场景，开展 20 场访谈并分析关键行为数据。\n设计分阶段引导与个性化推荐方案，推动跨部门落地，缩短用户首次完成学习的时间。',
  }];
  resume.skills = '产品规划 / 用户研究 / 数据分析 / Figma / SQL / 跨团队协作';
  return resume;
}

function fail(message: string): never {
  throw new ResumeValidationError(message);
}

function object(value: unknown, label: string, keys: readonly string[]): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(`${label}需要是对象。`);
  const result = value as Record<string, unknown>;
  for (const key of Object.keys(result)) {
    if (!keys.includes(key)) fail(`${label}包含不支持的字段：${key.slice(0, 60)}。`);
  }
  for (const key of keys) {
    if (!Object.hasOwn(result, key)) fail(`${label}缺少字段：${key}。`);
  }
  return result;
}

function string(value: unknown, label: string, max: number = RESUME_LIMITS.shortText): string {
  if (typeof value !== 'string') fail(`${label}需要是文字。`);
  if (value.length > max) fail(`${label}最多支持 ${max} 个字符。`);
  return value;
}

function id(value: unknown, label: string): string {
  const result = string(value, label, 80);
  if (!/^[A-Za-z0-9_-]+$/.test(result)) fail(`${label}格式无效。`);
  return result;
}

function entries<T extends { id: string }>(
  value: unknown, label: string, parse: (item: unknown, label: string) => T,
): T[] {
  if (!Array.isArray(value)) fail(`${label}需要是列表。`);
  if (value.length > RESUME_LIMITS.sectionEntries) fail(`${label}最多支持 ${RESUME_LIMITS.sectionEntries} 条。`);
  const result = value.map((item, index) => parse(item, `${label}第 ${index + 1} 条`));
  if (new Set(result.map((item) => item.id)).size !== result.length) fail(`${label}存在重复的条目标识。`);
  return result;
}

export function validateResume(value: unknown): ResumeDocument {
  const doc = object(value, '简历', ['id', 'title', 'updatedAt', 'templateId', 'accent', 'profile', 'experiences', 'education', 'projects', 'skills']);
  if (!templates.some((template) => template.id === doc.templateId)) fail('简历模板无效，请选择现有模板。');
  const updatedAt = string(doc.updatedAt, '更新时间', 40);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(updatedAt)
    || !Number.isFinite(Date.parse(updatedAt)) || new Date(updatedAt).toISOString() !== updatedAt) {
    fail('更新时间需要是有效的 ISO 日期。');
  }
  const accent = string(doc.accent, '主题颜色', 7);
  if (!/^#[0-9a-fA-F]{6}$/.test(accent)) fail('主题颜色需要是六位十六进制颜色，例如 #59745d。');
  const profile = object(doc.profile, '个人信息', ['name', 'role', 'phone', 'email', 'city', 'website', 'summary']);
  return {
    id: id(doc.id, '简历标识'),
    title: string(doc.title, '简历名称', RESUME_LIMITS.title),
    updatedAt,
    templateId: doc.templateId as TemplateId,
    accent,
    profile: {
      name: string(profile.name, '姓名', 80), role: string(profile.role, '求职意向'),
      phone: string(profile.phone, '电话', 80), email: string(profile.email, '邮箱', 254),
      city: string(profile.city, '城市'), website: string(profile.website, '个人网站', 500),
      summary: string(profile.summary, '个人简介', RESUME_LIMITS.summary),
    },
    experiences: entries(doc.experiences, '工作经历', (value, label) => {
      const row = object(value, label, ['id', 'company', 'role', 'period', 'description']);
      return {
        id: id(row.id, `${label}标识`), company: string(row.company, `${label}公司`),
        role: string(row.role, `${label}职位`), period: string(row.period, `${label}时间`),
        description: string(row.description, `${label}描述`, RESUME_LIMITS.description),
      };
    }),
    education: entries(doc.education, '教育经历', (value, label) => {
      const row = object(value, label, ['id', 'school', 'degree', 'period', 'description']);
      return {
        id: id(row.id, `${label}标识`), school: string(row.school, `${label}学校`),
        degree: string(row.degree, `${label}学历专业`), period: string(row.period, `${label}时间`),
        description: string(row.description, `${label}描述`, RESUME_LIMITS.description),
      };
    }),
    projects: entries(doc.projects, '项目经历', (value, label) => {
      const row = object(value, label, ['id', 'name', 'role', 'period', 'description']);
      return {
        id: id(row.id, `${label}标识`), name: string(row.name, `${label}名称`),
        role: string(row.role, `${label}角色`), period: string(row.period, `${label}时间`),
        description: string(row.description, `${label}描述`, RESUME_LIMITS.description),
      };
    }),
    skills: string(doc.skills, '专业技能', RESUME_LIMITS.skills),
  };
}

/** Throws a human-readable ResumeValidationError; callers can display its message. */
export function parseResumeJson(text: string): ResumeDocument {
  if (text.length > RESUME_LIMITS.importCharacters || new TextEncoder().encode(text).byteLength > RESUME_LIMITS.importBytes) {
    fail('文件过大，请导入不超过 2 MB 的简历 JSON。');
  }
  let value: unknown;
  try { value = JSON.parse(text); } catch { fail('文件不是有效的 JSON，请选择从简历工坊导出的文件。'); }
  return validateResume(value);
}

export function serializeResume(resume: ResumeDocument): string {
  return JSON.stringify(validateResume(resume), null, 2);
}

function getStorage(provided?: ResumeStorage): ResumeStorage {
  if (provided) return provided;
  if (!globalThis.localStorage) throw new Error('浏览器本地存储不可用');
  return globalThis.localStorage;
}

function validateCollection(value: unknown): ResumeDocument[] {
  if (!Array.isArray(value)) fail('已保存的简历需要是列表。');
  if (value.length > RESUME_LIMITS.documents) fail(`最多可保存 ${RESUME_LIMITS.documents} 份简历，请先导出并删除暂时不用的简历。`);
  const resumes = value.map(validateResume);
  if (new Set(resumes.map((resume) => resume.id)).size !== resumes.length) fail('简历列表包含重复标识。');
  return resumes;
}

export function loadResumes(storage?: ResumeStorage): Result<{ resumes: ResumeDocument[] }> {
  try {
    const raw = getStorage(storage).getItem(RESUME_STORAGE_KEY);
    if (raw === null) return { ok: true, resumes: [] };
    if (raw.length > RESUME_LIMITS.storageCharacters) fail('已保存的数据过大，无法读取。');
    let value: unknown;
    try { value = JSON.parse(raw); } catch { fail('已保存的数据损坏，无法读取。'); }
    const saved = object(value, '存储数据', ['version', 'resumes']);
    if (saved.version !== 1) fail('已保存的数据版本暂不支持。');
    return { ok: true, resumes: validateCollection(saved.resumes) };
  } catch (error) {
    return { ok: false, error: error instanceof ResumeValidationError
      ? error.message : '无法读取浏览器本地存储，请检查浏览器的隐私与存储设置。' };
  }
}

export function saveResumes(resumes: ResumeDocument[], storage?: ResumeStorage): Result<Record<never, never>> {
  try {
    const value = JSON.stringify({ version: 1, resumes: validateCollection(resumes) });
    if (value.length > RESUME_LIMITS.storageCharacters) fail('简历数据过大，请先导出并删除暂时不用的简历。');
    getStorage(storage).setItem(RESUME_STORAGE_KEY, value);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof ResumeValidationError
      ? error.message : '保存失败，浏览器存储空间可能已满或不可用。请导出 JSON 备份当前内容。' };
  }
}
