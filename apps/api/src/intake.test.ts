import {describe,expect,it} from 'vitest';
import {extractProductionInput} from './intake.js';

describe('production source intake extraction', () => {
  it('extracts plain text without altering its content', async () => {
    const result = await extractProductionInput('story.txt', Buffer.from('Opening scene\\nA character enters.'));
    expect(result.format).toBe('txt');
    expect(result.text).toContain('A character enters.');
  });
  it('rejects malformed DOCX packages instead of storing them as extracted text', async () => {
    await expect(extractProductionInput('story.docx', Buffer.from('not-a-docx-package'))).rejects.toThrow();
  });
  it('strips a UTF-8 BOM from text source files', async () => {
    const result = await extractProductionInput('story.txt', Buffer.from('\uFEFFA story begins here.', 'utf8'));
    expect(result.text).toBe('A story begins here.');
  });
  it('parses JSON and preserves its structured data', async () => {
    const result = await extractProductionInput('brief.json', Buffer.from(JSON.stringify({title:'Test',scenes:[{id:'one'}]})));
    expect(result.format).toBe('json');
    expect(result.structuredData).toEqual({title:'Test',scenes:[{id:'one'}]});
  });
  it('rejects malformed JSON', async () => {
    await expect(extractProductionInput('brief.json', Buffer.from('{bad'))).rejects.toThrow('malformed');
  });
  it('rejects unsupported formats', async () => {
    await expect(extractProductionInput('story.pdf', Buffer.from('pdf'))).rejects.toThrow('Unsupported');
  });
  it('rejects empty and oversized inputs', async () => {
    await expect(extractProductionInput('story.txt', Buffer.alloc(0))).rejects.toThrow('empty');
    await expect(extractProductionInput('story.txt', Buffer.alloc(5 * 1024 * 1024 + 1))).rejects.toThrow('5 MB');
  });
  it('rejects unsafe filenames', async () => {
    await expect(extractProductionInput('../story.txt', Buffer.from('text'))).rejects.toThrow('filename');
  });
});
