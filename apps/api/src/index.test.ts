import {afterAll,beforeAll,describe,expect,it} from 'vitest';

let app: typeof import('./index.js').app;
let previousNodeEnv: string | undefined;
let previousApiToken: string | undefined;

beforeAll(async () => {
  previousNodeEnv = process.env.NODE_ENV;
  previousApiToken = process.env.API_TOKEN;
  process.env.NODE_ENV = 'test';
  process.env.API_TOKEN = 'real-factory-test-token';
  const api = await import('./index.js');
  app = api.app;
});

afterAll(async () => {
  await app?.close();
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  if (previousApiToken === undefined) delete process.env.API_TOKEN;
  else process.env.API_TOKEN = previousApiToken;
});

describe('Real Factory API authentication boundary', () => {
  it('rejects unauthenticated asset-library reads', async () => {
    const response = await app.inject({method:'GET',url:'/v1/assets'});
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({error:'unauthorized'});
  });

  it('rejects unauthenticated asset-library uploads', async () => {
    const response = await app.inject({method:'POST',url:'/v1/assets',payload:{}});
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({error:'unauthorized'});
  });

  it('rejects unauthenticated source intake', async () => {
    const response = await app.inject({method:'POST',url:'/v1/intake',payload:{}});
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({error:'unauthorized'});
  });

  it('rejects unauthenticated story planning', async () => {
    const response = await app.inject({method:'POST',url:'/v1/projects/00000000-0000-4000-8000-000000000001/plan',payload:{}});
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({error:'unauthorized'});
  });
});
