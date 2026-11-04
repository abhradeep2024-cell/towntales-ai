import mammoth from 'mammoth';

export type IntakeFormat = 'docx' | 'txt' | 'json';

export interface ExtractedProductionInput {
  format: IntakeFormat;
  text: string;
  structuredData?: unknown;
  warnings: string[];
}

const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
const MAX_EXTRACTED_CHARACTERS = 60_000;

export function deriveProjectTitle(filename: string, suppliedTitle?: unknown): string | null {
  if (suppliedTitle !== undefined && typeof suppliedTitle !== 'string') return null;
  const candidate = typeof suppliedTitle === 'string'
    ? suppliedTitle
    : filename.replace(/\\.[^.]+$/, '');
  const title = candidate.trim().slice(0, 160);
  return title || null;
}

export async function extractProductionInput(filename: string, bytes: Buffer): Promise<ExtractedProductionInput> {
  if (!filename || filename.length > 180 || /[\\/\\\\]/.test(filename) || filename.includes('..')) {
    throw new Error('Invalid source filename.');
  }
  if (bytes.byteLength === 0) throw new Error('The uploaded source file is empty.');
  if (bytes.byteLength > MAX_SOURCE_BYTES) throw new Error('Source files must be 5 MB or smaller.');

  const extension = filename.split('.').pop()?.toLowerCase();
  if (extension === 'txt') {
    const decoded = new TextDecoder('utf-8', {fatal:true}).decode(bytes);
    const text = (decoded.charCodeAt(0) === 0xFEFF ? decoded.slice(1) : decoded).trim();
    if (!text) throw new Error('The text file contains no readable content.');
    if (text.length > MAX_EXTRACTED_CHARACTERS) throw new Error('Extracted text exceeds the 60,000-character planning limit.');
    return {format:'txt',text,warnings:[]};
  }
  if (extension === 'json') {
    const raw = new TextDecoder('utf-8', {fatal:true}).decode(bytes);
    let structuredData: unknown;
    try { structuredData = JSON.parse(raw); }
    catch { throw new Error('The JSON source is malformed.'); }
    const text = JSON.stringify(structuredData, null, 2);
    if (!text || text === 'null') throw new Error('The JSON source must contain a production brief or script.');
    if (text.length > MAX_EXTRACTED_CHARACTERS) throw new Error('Extracted JSON exceeds the 60,000-character planning limit.');
    return {format:'json',text,structuredData,warnings:[]};
  }
  if (extension === 'docx') {
    const result = await mammoth.extractRawText({buffer:bytes});
    const text = result.value.replaceAll(String.fromCharCode(13), '').trim();
    if (!text) throw new Error('The DOCX file contains no extractable text.');
    if (text.length > MAX_EXTRACTED_CHARACTERS) throw new Error('Extracted DOCX text exceeds the 60,000-character planning limit.');
    return {
      format:'docx',
      text,
      warnings:result.messages.map(message => message.message).slice(0,20)
    };
  }
  throw new Error('Unsupported source format. Upload a DOCX, TXT, or JSON file.');
}
