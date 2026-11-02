import {describe,expect,it} from 'vitest';
import {ProductionSpecSchema} from '@film-studio/contracts';

const valid = {
  schemaVersion:1 as const,title:'Smoke test',idea:'A short test film',styleId:'minimal-cinematic',
  durationSeconds:5,aspectRatio:'16:9' as const,fps:30,width:1280,height:720,
  scenes:[{id:'scene-1',title:'Opening',durationSeconds:5,visualDirection:'Slow cinematic title reveal',narration:'',onScreenText:['Film Studio'],background:'#101522'}]
};

describe('ProductionSpecSchema',() => {
  it('accepts a valid short landscape production',() => {expect(ProductionSpecSchema.safeParse(valid).success).toBe(true);});
  it('rejects scene totals that differ from requested duration',() => {
    expect(ProductionSpecSchema.safeParse({...valid,scenes:[{...valid.scenes[0],durationSeconds:2}]}).success).toBe(false);
  });
  it('rejects landscape dimensions for vertical video',() => {
    expect(ProductionSpecSchema.safeParse({...valid,aspectRatio:'9:16'}).success).toBe(false);
  });
});
