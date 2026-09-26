import {
  parseResumeJson, RESUME_LIMITS, serializeResume, type ResumeDocument,
} from './resume.ts';

export interface ResumeFileWritable {
  write(contents: string): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
}

export interface ResumeFileHandle {
  readonly name: string;
  createWritable(options?: { keepExistingData: boolean }): Promise<ResumeFileWritable>;
}

export interface ResumeSavePickerOptions {
  suggestedName: string;
  types: { description: string; accept: Record<string, string[]> }[];
  excludeAcceptAllOption: boolean;
}

/** Small browser boundary so tests never open a real file dialog or download. */
export interface ResumeFileEnvironment {
  showSaveFilePicker?: (options: ResumeSavePickerOptions) => Promise<ResumeFileHandle>;
  download: (contents: Blob, filename: string) => void | Promise<void>;
}

export interface ReadableResumeFile {
  readonly name: string;
  readonly size: number;
  text(): Promise<string>;
}

export interface SaveResumeFileResult {
  method: 'file-picker' | 'download';
  filename: string;
}

export class ResumeFileError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'ResumeFileError';
  }
}

const FILE_EXTENSION = '.resume.json';
const MAX_FILENAME_BYTES = 240;

/** Keeps names portable across Windows/macOS, including long Chinese titles. */
export function resumeFilename(title: string): string {
  let stem = title.trim()
    .replace(/(?:\.resume)?\.json$/i, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '-')
    .replace(/[\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/-+/g, '-')
    .replace(/^[.\s]+|[.\s]+$/g, '');
  if (!stem || /^-+$/.test(stem)) stem = '未命名简历';
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(stem)) stem = `简历-${stem}`;

  const encoder = new TextEncoder();
  const byteLimit = MAX_FILENAME_BYTES - encoder.encode(FILE_EXTENSION).byteLength;
  let bounded = '';
  let bytes = 0;
  for (const character of stem) {
    const length = encoder.encode(character).byteLength;
    if (bytes + length > byteLimit) break;
    bounded += character;
    bytes += length;
  }
  return `${bounded.replace(/[.\s]+$/g, '') || '未命名简历'}${FILE_EXTENSION}`;
}

function errorName(error: unknown): string {
  return typeof error === 'object' && error !== null && 'name' in error
    && typeof error.name === 'string' ? error.name : '';
}

function saveError(error: unknown, stage: 'picker' | 'write' | 'download'): ResumeFileError {
  if (stage === 'download') {
    return new ResumeFileError(['NotAllowedError', 'SecurityError'].includes(errorName(error))
      ? '浏览器阻止了下载，请允许此网站下载文件后重试。'
      : '无法发起简历下载，请检查浏览器的下载设置后重试。', error);
  }
  switch (errorName(error)) {
    case 'NotAllowedError':
      return new ResumeFileError('未获得文件保存权限，请重新选择保存位置并允许写入。', error);
    case 'SecurityError':
      return new ResumeFileError('浏览器阻止了文件保存，请重新点击保存按钮重试，也可以选择“普通下载”。', error);
    case 'QuotaExceededError':
      return new ResumeFileError('存储空间不足，请释放一些空间或选择其他保存位置后重试。', error);
    case 'NoModificationAllowedError':
      return new ResumeFileError('无法写入该文件，文件可能正在被占用，请关闭占用程序或选择其他保存位置。', error);
    case 'NotFoundError':
      return new ResumeFileError('保存位置已失效，请重新选择文件位置。', error);
    default:
      return new ResumeFileError(stage === 'picker'
        ? '无法打开文件保存窗口，请重新点击保存按钮重试，也可以选择“普通下载”。'
        : '简历文件保存失败，请检查保存位置的写入权限和可用空间后重试。', error);
  }
}

function downloadInBrowser(contents: Blob, filename: string): void {
  if (typeof document === 'undefined' || !document.body) {
    throw new ResumeFileError('请在浏览器中打开简历工坊后保存文件。');
  }
  const url = URL.createObjectURL(contents);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  let started = false;
  try {
    document.body.append(anchor);
    anchor.click();
    started = true;
  } finally {
    anchor.remove();
    // Give the browser time to consume the Blob before releasing its URL.
    if (started) setTimeout(() => URL.revokeObjectURL(url), 30_000);
    else URL.revokeObjectURL(url);
  }
}

function browserEnvironment(): ResumeFileEnvironment {
  const browser = typeof window === 'undefined' ? undefined : window as Window & {
    showSaveFilePicker?: ResumeFileEnvironment['showSaveFilePicker'];
  };
  return {
    showSaveFilePicker: typeof browser?.showSaveFilePicker === 'function'
      ? browser.showSaveFilePicker.bind(browser) : undefined,
    download: downloadInBrowser,
  };
}

function prepareResumeFile(resume: ResumeDocument) {
  const contents = serializeResume(resume);
  const blob = new Blob([contents], { type: 'application/json;charset=utf-8' });
  if (contents.length > RESUME_LIMITS.importCharacters || blob.size > RESUME_LIMITS.importBytes) {
    throw new ResumeFileError('简历文件超过 2 MB，请精简内容后保存，以便下次完整打开。');
  }
  const filename = resumeFilename(resume.title);
  return { contents, blob, filename };
}

async function downloadPreparedFile(
  file: ReturnType<typeof prepareResumeFile>,
  environment: ResumeFileEnvironment,
): Promise<{ method: 'download'; filename: string }> {
  try {
    await environment.download(file.blob, file.filename);
  } catch (error) {
    throw error instanceof ResumeFileError ? error : saveError(error, 'download');
  }
  // Browsers cannot confirm that an anchor download was written to disk.
  return { method: 'download', filename: file.filename };
}

/** Explicit browser download, including when an available file picker is blocked. */
export async function downloadResumeFile(
  resume: ResumeDocument,
  environment: ResumeFileEnvironment = browserEnvironment(),
): Promise<{ method: 'download'; filename: string }> {
  return downloadPreparedFile(prepareResumeFile(resume), environment);
}

/** Call directly from a user click to preserve the browser's user activation. */
export async function saveResumeFile(
  resume: ResumeDocument,
  environment: ResumeFileEnvironment = browserEnvironment(),
): Promise<SaveResumeFileResult | null> {
  const file = prepareResumeFile(resume);
  const { contents, filename } = file;

  if (!environment.showSaveFilePicker) {
    return downloadPreparedFile(file, environment);
  }

  let handle: ResumeFileHandle;
  try {
    handle = await environment.showSaveFilePicker({
      suggestedName: filename,
      types: [{ description: '可编辑简历文件', accept: { 'application/json': ['.json'] } }],
      excludeAcceptAllOption: true,
    });
  } catch (error) {
    if (errorName(error) === 'AbortError') return null;
    throw saveError(error, 'picker');
  }

  let writable: ResumeFileWritable | undefined;
  try {
    // createWritable stages changes; the existing file is replaced only on close.
    writable = await handle.createWritable({ keepExistingData: false });
    await writable.write(contents);
    await writable.close();
  } catch (error) {
    if (writable) {
      try { await writable.abort(); } catch { /* Preserve the original write failure. */ }
    }
    throw saveError(error, 'write');
  }
  return { method: 'file-picker', filename: handle.name || filename };
}

/** Reads only the explicitly selected local file; JSON schema stays unchanged. */
export async function readResumeFile(file: ReadableResumeFile): Promise<ResumeDocument> {
  if (!/\.json$/i.test(file.name)) {
    throw new ResumeFileError('请选择 .resume.json 或 .json 格式的简历文件。');
  }
  if (!Number.isFinite(file.size) || file.size < 0 || file.size > RESUME_LIMITS.importBytes) {
    throw new ResumeFileError('文件过大，请选择不超过 2 MB 的简历文件。');
  }
  let contents: string;
  try {
    contents = await file.text();
  } catch (error) {
    throw new ResumeFileError('无法读取这个文件，请确认文件仍在电脑上且可访问后重试。', error);
  }
  return parseResumeJson(contents.replace(/^\uFEFF/, ''));
}
