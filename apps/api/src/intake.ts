import mammoth from 'mammoth';

export type IntakeFormat = 'docx' | 'txt' | 'json';

export interface ExtractedProductionInput {
  format: IntakeFormat;
  text: string;
  structuredData?: unknown;
  warnings: string[];
}

const MAX_SOURCE_BYTES = 5 * 1024 * 1024;

export async function extractProductionInput(filename: string, bytes: Buffer): Promise<ExtractedProductionInput> {
  if (!filename || filename.length > 180 || /[\\/\\\\]/.test(filename) || filename.includes('..')) {
    throw new Error('Invalid source filename.');
  }
  if (bytes.byteLength === 0) throw new Error('The uploaded source file is empty.');
  if (bytes.byteLength > MAX_SOURCE_BYTES) throw new Error('Source files must be 5 MB or smaller.');

  const extension = filename.split('.').pop()?.toLowerCase();
  if (extension === 'txt') {
    const text = new TextDecoder('utf-8', {fatal:true}).decode(bytes).replace(/^\\uFEFF/, '').trim();
    if (!text) throw new Error('The text file contains no readable content.');
    return {format:'txt',text,warnings:[]};
  }
  if (extension === 'json') {
    const raw = new TextDecoder('utf-8', {fatal:true}).decode(bytes);
    let structuredData: unknown;
    try { structuredData = JSON.parse(raw); }
    catch { throw new Error('The JSON source is malformed.'); }
    const text = JSON.stringify(structuredData, null, 2);
    if (!text || text === 'null') throw new Error('The JSON source must contain a production brief or script.');
    return {format:'json',text,structuredData,warnings:[]};
  }
  if (extension === 'docx') {
    const result = await mammoth.extractRawText({buffer:bytes});
    const text = result.value.replace(/\\r/g, '').trim();
    if (!text) throw new Error('The DOCX file contains no extractable text.');
    return {
      format:'docx',
      text,
      warnings:result.messages.map(message => message.message).slice(0,20)
    };
  }
  throw new Error('Unsupported source format. Upload a DOCX, TXT, or JSON file.');
}
