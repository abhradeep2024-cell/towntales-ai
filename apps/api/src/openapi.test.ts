import {readFile} from 'node:fs/promises';
import {describe,expect,it} from 'vitest';
import {parse} from 'yaml';

describe('Phase 1 OpenAPI contract', () => {
  it('publishes a valid OpenAPI 3.1 JSON document contract', async () => {
    const source = await readFile(new URL('../../../openapi.yaml', import.meta.url), 'utf8');
    const document = parse(source) as {openapi?:string;paths?:Record<string,Record<string,unknown>>};
    expect(document.openapi).toBe('3.1.0');
    expect(document.paths?.['/openapi.json']?.get).toBeDefined();
  });

  it('documents the required Phase 1 infrastructure endpoints', async () => {
    const source = await readFile(new URL('../../../openapi.yaml', import.meta.url), 'utf8');
    const document = parse(source) as {paths?:Record<string,Record<string,unknown>>};
    const paths = document.paths ?? {};
    expect(paths['/health']?.get).toBeDefined();
    expect(paths['/v1/intake']?.post).toBeDefined();
    expect(paths['/v1/projects/{id}/plan']?.post).toBeDefined();
    expect(paths['/v1/assets']?.get).toBeDefined();
    expect(paths['/v1/assets']?.post).toBeDefined();
    expect(paths['/v1/jobs']?.post).toBeDefined();
    expect(paths['/v1/jobs/{id}']?.get).toBeDefined();
  });
});
