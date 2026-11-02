import {describe,expect,it} from 'vitest';
import {ProductionSpecSchema} from '@film-studio/contracts';
import {createSupabaseApiKeyFetch} from './supabase-api-key-fetch.js';

const valid = {
  schemaVersion:1 as const,title:'Smoke test',idea:'A short test film',styleId:'swiss-motion',
  durationSeconds:5,aspectRatio:'16:9' as const,fps:30,width:1280,height:720,
  scenes:[{id:'scene-1',title:'Opening',durationSeconds:5,visualDirection:'Slow cinematic title reveal',narration:'',onScreenText:['Film Studio'],background:'#101522'}]
};
const lemoPage = {
  'index.html':'<!doctype html><script>window.DUR=5;window.render=(t)=>{};window.READY=true;</script>',
  'main.js':'window.render = (t) => {};'
};

describe('ProductionSpecSchema',() => {
  it('accepts a valid short landscape production',() => {
    expect(ProductionSpecSchema.safeParse(valid).success).toBe(true);
  });
  it('rejects scene totals that differ from requested duration',() => {
    expect(ProductionSpecSchema.safeParse({...valid,scenes:[{...valid.scenes[0],durationSeconds:2}]}).success).toBe(false);
  });
  it('rejects landscape dimensions for vertical video',() => {
    expect(ProductionSpecSchema.safeParse({...valid,aspectRatio:'9:16'}).success).toBe(false);
  });
  it('accepts a valid portrait production',() => {
    expect(ProductionSpecSchema.safeParse({...valid,aspectRatio:'9:16',width:720,height:1280}).success).toBe(true);
  });
  it('defaults an omitted portrait canvas to 720×1280',() => {
    const {width,height,...base} = valid;
    const result = ProductionSpecSchema.safeParse({...base,aspectRatio:'9:16'});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.width).toBe(720);
      expect(result.data.height).toBe(1280);
    }
  });
  it('defaults an omitted square canvas to 1080×1080',() => {
    const {width,height,...base} = valid;
    const result = ProductionSpecSchema.safeParse({...base,aspectRatio:'1:1'});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.width).toBe(1080);
      expect(result.data.height).toBe(1080);
    }
  });
  it('derives a missing portrait dimension from the supplied one',() => {
    const {height,...base} = valid;
    const result = ProductionSpecSchema.safeParse({...base,width:720,aspectRatio:'9:16'});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.width).toBe(720);
      expect(result.data.height).toBe(1280);
    }
  });
  it('normalizes the default music and voice settings',() => {
    const result = ProductionSpecSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.audio.musicEnabled).toBe(true);
      expect(result.data.audio.voiceEnabled).toBe(true);
      expect(result.data.audio.musicVolume).toBe(0.12);
    }
  });
  it('accepts a Lemo project page implementing the frame contract',() => {
    expect(ProductionSpecSchema.safeParse({...valid,projectFiles:lemoPage}).success).toBe(true);
  });
  it('accepts the Lemo page contract when its globals live in a local module',() => {
    const modular = {
      'index.html':'<!doctype html><script type="module" src="./main.js"></script>',
      'main.js':'window.DUR=5; window.render=(t)=>{}; window.READY=true;'
    };
    expect(ProductionSpecSchema.safeParse({...valid,projectFiles:modular}).success).toBe(true);
  });
  it('rejects remote scripts and remote media dependencies',() => {
    const unsafe = {
      'index.html':'<!doctype html><script src="https://example.com/remote.js"></script>',
      'main.js':'window.DUR=5; window.render=(t)=>{}; window.READY=true;'
    };
    expect(ProductionSpecSchema.safeParse({...valid,projectFiles:unsafe}).success).toBe(false);
  });
  it('rejects Lemo project paths that traverse outside the project directory',() => {
    expect(ProductionSpecSchema.safeParse({...valid,projectFiles:{...lemoPage,'../secret.js':'nope'}}).success).toBe(false);
  });
  it('rejects Lemo projects without the required page contract',() => {
    expect(ProductionSpecSchema.safeParse({...valid,projectFiles:{'index.html':'<html></html>'}}).success).toBe(false);
  });
  it('rejects Lemo project packages that exceed the 1.8 MB text budget',() => {
    expect(ProductionSpecSchema.safeParse({...valid,projectFiles:{'index.html':lemoPage['index.html'],'large.js':'x'.repeat(1_850_000)}}).success).toBe(false);
  });
  it('keeps the Lemo project source optional for structured Remotion scenes',() => {
    expect(ProductionSpecSchema.safeParse(valid).success).toBe(true);
  });
});


describe('Supabase API key transport', () => {
  it('keeps the apikey header and removes Authorization for opaque secret keys', async () => {
    let captured: Headers | undefined;
    const wrapped = createSupabaseApiKeyFetch(async (_input, init) => {
      captured = new Headers(init?.headers);
      return new Response('ok');
    });
    await wrapped('https://example.supabase.co/rest/v1/test', {
      headers: { apikey: 'sb_secret_test', Authorization: 'Bearer sb_secret_test' }
    });
    expect(captured?.get('apikey')).toBe('sb_secret_test');
    expect(captured?.has('Authorization')).toBe(false);
  });
});
