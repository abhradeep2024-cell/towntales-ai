import {describe,expect,it} from 'vitest';
import {ProductionSpecSchema} from '@film-studio/contracts';

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
