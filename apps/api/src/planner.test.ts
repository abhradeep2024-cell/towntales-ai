import {describe,expect,it,vi} from 'vitest';
import {planProductionFromSource} from './planner.js';

const validPlan = {
  schemaVersion:2,title:'Test Story',idea:'A short test story',styleId:'cinematic-roblox',
  durationSeconds:10,aspectRatio:'9:16',fps:30,width:720,height:1280,
  scenes:[{id:'scene-1',title:'Opening',durationSeconds:10,visualDirection:'A character enters a moonlit room; slow push-in camera, expressive blocking and motivated blue rim light.',narration:'',onScreenText:[],background:'#101522'}]
};
const config = (content:unknown, status=200) => ({
  apiKey:'test-key',baseUrl:'https://api.example.test/v1',model:'test-model',
  fetchImpl:vi.fn(async () => new Response(JSON.stringify({
    choices:[{message:{content:typeof content === 'string' ? content : JSON.stringify(content)}}]
  }),{status}))
});

describe('AI production planner', () => {
  it('requests a structured plan and validates the returned manifest', async () => {
    const cfg=config(validPlan);
    const result=await planProductionFromSource('A character enters a room.',cfg);
    expect(result.schemaVersion).toBe(2);
    expect(result.scenes).toHaveLength(1);
    expect(cfg.fetchImpl).toHaveBeenCalledOnce();
  });
  it('accepts a JSON code fence but parses only the JSON payload', async () => {
    const result=await planProductionFromSource('Story',config('```json\\n'+JSON.stringify(validPlan)+'\\n```'));
    expect(result.title).toBe('Test Story');
  });
  it('rejects malformed model output', async () => {
    await expect(planProductionFromSource('Story',config('{not json'))).rejects.toThrow('malformed JSON');
  });
  it('rejects structurally invalid production manifests', async () => {
    await expect(planProductionFromSource('Story',config({...validPlan,scenes:[]}))).rejects.toThrow('contract validation');
  });
  it('rejects empty or oversized source text before provider calls', async () => {
    const cfg=config(validPlan);
    await expect(planProductionFromSource(' ',cfg)).rejects.toThrow('empty');
    await expect(planProductionFromSource('x'.repeat(60_001),cfg)).rejects.toThrow('60,000');
    expect(cfg.fetchImpl).not.toHaveBeenCalled();
  });
  it('rejects missing provider configuration', async () => {
    await expect(planProductionFromSource('Story',{apiKey:'',baseUrl:'',model:''})).rejects.toThrow('not configured');
  });
  it('surfaces provider errors without accepting a fake plan', async () => {
    const failed={apiKey:'key',baseUrl:'https://api.example.test/v1',model:'model',fetchImpl:vi.fn(async()=>new Response('unavailable',{status:503}))};
    await expect(planProductionFromSource('Story',failed)).rejects.toThrow('503');
  });
});
