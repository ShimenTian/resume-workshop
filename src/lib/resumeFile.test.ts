import assert from 'node:assert/strict';
import test from 'node:test';
import { newResume, RESUME_LIMITS, serializeResume } from './resume.ts';
import {
  downloadResumeFile, readResumeFile, resumeFilename, ResumeFileError, saveResumeFile,
  type ResumeFileEnvironment, type ResumeFileWritable,
} from './resumeFile.ts';

function namedError(name: string): Error {
  return Object.assign(new Error('simulated browser failure'), { name });
}

function file(contents: string, name = '简历.resume.json') {
  return { name, size: new TextEncoder().encode(contents).byteLength, text: async () => contents };
}

function pickerEnvironment(writable: ResumeFileWritable): ResumeFileEnvironment {
  return {
    showSaveFilePicker: async () => ({ name: '自定义名称.resume.json', createWritable: async () => writable }),
    download: () => assert.fail('Picker errors must never start a fallback download'),
  };
}

test('filenames sanitize paths, reserved names, empty titles and existing extensions', () => {
  assert.equal(resumeFilename('  林知夏的简历  '), '林知夏的简历.resume.json');
  assert.equal(resumeFilename('林知夏.resume.json'), '林知夏.resume.json');
  assert.equal(resumeFilename('林知夏.JSON'), '林知夏.resume.json');
  assert.equal(resumeFilename('  ..  '), '未命名简历.resume.json');
  assert.equal(resumeFilename(''), '未命名简历.resume.json');
  assert.equal(resumeFilename('CON'), '简历-CON.resume.json');
  assert.equal(resumeFilename('aux.work'), '简历-aux.work.resume.json');
  assert.equal(resumeFilename('C:\\简历/设计:*?"<>|\u0000'), 'C-简历-设计-.resume.json');
  assert.equal(resumeFilename('姓名\u202ejson'), '姓名json.resume.json');
  const long = resumeFilename('简历🙂'.repeat(100));
  assert.ok(new TextEncoder().encode(long).byteLength <= 240);
  assert.ok(long.endsWith('.resume.json'));
  assert.ok(!long.includes('\uFFFD'));
});

test('file-picker save waits for write and close, returns the selected name and round-trips every field', async () => {
  const resume = newResume('modern');
  resume.profile.summary += '\n第二段个人介绍。';
  let saved = '';
  const events: string[] = [];
  let finishWrite!: () => void;
  const written = new Promise<void>((resolve) => { finishWrite = resolve; });
  let reachedWrite!: () => void;
  const writing = new Promise<void>((resolve) => { reachedWrite = resolve; });
  let finishClose!: () => void;
  const closed = new Promise<void>((resolve) => { finishClose = resolve; });
  let reachedClose!: () => void;
  const closing = new Promise<void>((resolve) => { reachedClose = resolve; });
  const environment: ResumeFileEnvironment = {
    showSaveFilePicker: async (options) => {
      events.push('pick');
      assert.equal(options.suggestedName, resumeFilename(resume.title));
      assert.deepEqual(options.types[0].accept, { 'application/json': ['.json'] });
      return {
        name: '用户选择.resume.json',
        createWritable: async (options) => {
          assert.deepEqual(options, { keepExistingData: false });
          events.push('open');
          return {
            write: async (contents) => { saved = contents; events.push('write'); reachedWrite(); await written; events.push('written'); },
            close: async () => { events.push('close'); reachedClose(); await closed; events.push('closed'); },
            abort: async () => { events.push('abort'); },
          };
        },
      };
    },
    download: () => assert.fail('Expected the file picker'),
  };
  let completed = false;
  const saving = saveResumeFile(resume, environment).then((result) => { completed = true; return result; });
  await writing;
  assert.equal(completed, false);
  assert.deepEqual(events, ['pick', 'open', 'write']);
  finishWrite();
  await closing;
  assert.equal(completed, false);
  assert.deepEqual(events, ['pick', 'open', 'write', 'written', 'close']);
  finishClose();
  assert.deepEqual(await saving, { method: 'file-picker', filename: '用户选择.resume.json' });
  assert.deepEqual(await readResumeFile(file(saved)), resume);
  assert.deepEqual(events, ['pick', 'open', 'write', 'written', 'close', 'closed']);
});

test('canceling the file picker returns null without writing or downloading', async () => {
  assert.equal(await saveResumeFile(newResume(), {
    showSaveFilePicker: async () => { throw namedError('AbortError'); },
    download: () => assert.fail('Canceled save must stay canceled'),
  }), null);
});

test('permission refusal and browser restrictions are clear failures with no fallback download', async () => {
  for (const [name, message] of [['NotAllowedError', /未获得文件保存权限/], ['SecurityError', /浏览器阻止/], ['TypeError', /无法打开文件保存窗口/]] as const) {
    await assert.rejects(saveResumeFile(newResume(), {
      showSaveFilePicker: async () => { throw namedError(name); },
      download: () => assert.fail('Refused save must never become a download'),
    }), message);
  }
  await assert.rejects(saveResumeFile(newResume(), {
    showSaveFilePicker: async () => ({ name: '原简历.json', createWritable: async () => { throw namedError('NotAllowedError'); } }),
    download: () => assert.fail('Refused write must never become a download'),
  }), /未获得文件保存权限/);
});

test('write failures abort the staged change without closing or replacing the original file', async () => {
  let original = 'original file contents';
  let staged = '';
  let aborted = false;
  let closed = false;
  const error = namedError('QuotaExceededError');
  await assert.rejects(saveResumeFile(newResume(), pickerEnvironment({
    write: async (contents) => { staged = contents; throw error; },
    close: async () => { closed = true; original = staged; },
    abort: async () => { aborted = true; staged = ''; },
  })), (failure) => failure instanceof ResumeFileError && /存储空间不足/.test(failure.message) && failure.cause === error);
  assert.equal(aborted, true);
  assert.equal(closed, false);
  assert.equal(staged, '');
  assert.equal(original, 'original file contents');
});

test('close failures abort and preserve the original failure even when cleanup also fails', async () => {
  let abortCalls = 0;
  const originalError = namedError('NoModificationAllowedError');
  await assert.rejects(saveResumeFile(newResume(), pickerEnvironment({
    write: async () => {},
    close: async () => { throw originalError; },
    abort: async () => { abortCalls++; throw new Error('cleanup also failed'); },
  })), (failure) => failure instanceof ResumeFileError && /文件可能正在被占用/.test(failure.message) && failure.cause === originalError);
  assert.equal(abortCalls, 1);
});

test('an AbortError during writing is a failure, distinct from canceling the picker', async () => {
  let aborted = false;
  await assert.rejects(saveResumeFile(newResume(), pickerEnvironment({
    write: async () => { throw namedError('AbortError'); },
    close: async () => assert.fail('A failed write must not be committed'),
    abort: async () => { aborted = true; },
  })), /简历文件保存失败/);
  assert.equal(aborted, true);
});

test('unsupported file pickers initiate a JSON download with all editable data', async () => {
  const resume = newResume('sidebar');
  let downloaded: Blob | undefined;
  let suggested = '';
  const result = await saveResumeFile(resume, {
    download: (blob, filename) => { downloaded = blob; suggested = filename; },
  });
  assert.deepEqual(result, { method: 'download', filename: resumeFilename(resume.title) });
  assert.ok(downloaded);
  assert.equal(downloaded.type, 'application/json;charset=utf-8');
  assert.deepEqual(await readResumeFile({ name: suggested, size: downloaded.size, text: () => downloaded!.text() }), resume);
  await assert.rejects(saveResumeFile(resume, { download: () => { throw new Error('blocked'); } }), /无法发起简历下载/);
});

test('explicit download bypasses an available picker and preserves the editable document', async () => {
  const resume = newResume('modern');
  resume.title = '设计/研发:简历';
  let downloaded: Blob | undefined;
  let filename = '';
  const result = await downloadResumeFile(resume, {
    showSaveFilePicker: () => assert.fail('An explicit download must not open a picker'),
    download: (blob, name) => { downloaded = blob; filename = name; },
  });
  assert.deepEqual(result, { method: 'download', filename: '设计-研发-简历.resume.json' });
  assert.ok(downloaded);
  assert.equal(downloaded.type, 'application/json;charset=utf-8');
  assert.deepEqual(await readResumeFile({ name: filename, size: downloaded.size, text: () => downloaded!.text() }), resume);
});

test('a blocked picker offers ordinary download but waits for an explicit download action', async () => {
  const resume = newResume();
  let pickerCalls = 0;
  let downloadCalls = 0;
  const blocked = namedError('SecurityError');
  const environment: ResumeFileEnvironment = {
    showSaveFilePicker: async () => { pickerCalls++; throw blocked; },
    download: () => { downloadCalls++; },
  };
  await assert.rejects(saveResumeFile(resume, environment), (error) => error instanceof ResumeFileError
    && error.message.includes('普通下载') && error.cause === blocked);
  assert.equal(pickerCalls, 1);
  assert.equal(downloadCalls, 0);
  assert.equal((await downloadResumeFile(resume, environment)).method, 'download');
  assert.equal(pickerCalls, 1);
  assert.equal(downloadCalls, 1);
});

test('explicit download reports synchronous and asynchronous failures without claiming success', async () => {
  const blocked = namedError('SecurityError');
  await assert.rejects(downloadResumeFile(newResume(), {
    download: () => { throw blocked; },
  }), (error) => error instanceof ResumeFileError && /浏览器阻止了下载/.test(error.message) && error.cause === blocked);
  await assert.rejects(downloadResumeFile(newResume(), {
    download: async () => { throw new Error('download unavailable'); },
  }), /无法发起简历下载/);
});

test('saving invalid data fails before any browser operation', async () => {
  const noBrowser: ResumeFileEnvironment = {
    showSaveFilePicker: () => assert.fail('Invalid data must not open a picker'),
    download: () => assert.fail('Invalid data must not create a download'),
  };
  await assert.rejects(saveResumeFile({ ...newResume(), accent: 'invalid' }, noBrowser), /主题颜色/);
  await assert.rejects(downloadResumeFile({ ...newResume(), accent: 'invalid' }, noBrowser), /主题颜色/);
});

test('valid resumes above the former 256 KB limit can be saved, downloaded and reopened', async () => {
  const large = newResume();
  large.experiences = Array.from({ length: RESUME_LIMITS.sectionEntries }, (_, index) => ({ ...large.experiences[0], id: `job-${index}`, description: '字'.repeat(RESUME_LIMITS.description) }));
  large.projects = Array.from({ length: RESUME_LIMITS.sectionEntries }, (_, index) => ({ ...large.projects[0], id: `project-${index}`, description: '字'.repeat(RESUME_LIMITS.description) }));
  const expectedBytes = new TextEncoder().encode(serializeResume(large)).byteLength;
  assert.ok(expectedBytes > 256_000);
  assert.ok(expectedBytes < RESUME_LIMITS.importBytes);

  let saved = '';
  const result = await saveResumeFile(large, pickerEnvironment({
    write: async (contents) => { saved = contents; },
    close: async () => {},
    abort: async () => assert.fail('A valid large document must not abort'),
  }));
  assert.equal(result?.method, 'file-picker');
  assert.deepEqual(await readResumeFile(file(saved)), large);

  let downloaded: Blob | undefined;
  assert.equal((await downloadResumeFile(large, {
    download: (blob) => { downloaded = blob; },
  })).method, 'download');
  assert.ok(downloaded);
  assert.equal(downloaded.size, expectedBytes);
  assert.deepEqual(await readResumeFile({ name: '大简历.resume.json', size: downloaded.size, text: () => downloaded!.text() }), large);
});

test('reading accepts old JSON exports and a UTF-8 BOM, with schema validation', async () => {
  const resume = newResume();
  const json = serializeResume(resume);
  assert.deepEqual(await readResumeFile(file(json, '旧备份.JSON')), resume);
  assert.deepEqual(await readResumeFile(file(`\uFEFF${json}`)), resume);
  await assert.rejects(readResumeFile(file(json, '简历.pdf')), /请选择 .resume.json 或 .json/);
  await assert.rejects(readResumeFile(file('{malformed')), /有效的 JSON/);
  await assert.rejects(readResumeFile(file('{}')), /缺少字段/);
});

test('file-size checks happen before reading, allow the byte boundary and reject lying metadata', async () => {
  let read = false;
  await assert.rejects(readResumeFile({ name: 'large.json', size: RESUME_LIMITS.importBytes + 1, text: async () => { read = true; return ''; } }), /不超过 2 MB/);
  assert.equal(read, false);
  const resume = newResume();
  const json = serializeResume(resume);
  const padding = ' '.repeat(RESUME_LIMITS.importBytes - new TextEncoder().encode(json).byteLength);
  assert.deepEqual(await readResumeFile(file(json + padding)), resume);
  await assert.rejects(readResumeFile({ name: 'large.json', size: 1, text: async () => '字'.repeat(RESUME_LIMITS.importBytes) }), /文件过大/);
  await assert.rejects(readResumeFile({ name: 'missing.json', size: 100, text: async () => { throw namedError('NotReadableError'); } }), /无法读取这个文件/);
});
