import {describe,expect,it,vi} from 'vitest';
import {reviewProductionCreatively} from './creative-review.js';

const validReview = {
  overallScore:92,
  storyCoherenceScore:94,
  visualContinuityScore:90,
  compositionScore:91,
  performanceScore:89,
  captionScore:95,
  audioPlanScore:92,
  summary:'The story reads clearly and the sampled frames follow the intended visual progression.',
  strengths:['Consistent character identity','Clear subject framing'],
  findings:[]
};

function providerResponse(payload:unknown,status=200) {
  return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(payload)}}]}),{status});
}

describe('multimodal creative QA',()=>{
  it('returns a passing review when the evidence meets the release threshold',async()=>{
    const fetchImpl=vi.fn(async()=>providerResponse(validReview));
    const review=await reviewProductionCreatively(
      {title:'Test story',scenes:[{id:'scene-1',durationSeconds:4}]},
      [{sceneId:'scene-1',timeSeconds:2,imageBase64:'aGVsbG8='}],
      {passed:true},
      {apiKey:'test',baseUrl:'https://api.example.test/v1',model:'vision-model',fetchImpl:fetchImpl as typeof fetch}
    );
    expect(review.status).toBe('pass');
    expect(review.releaseApproved).toBe(true);
    expect(review.limitations.length).toBe(2);
    const requestBody=JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(requestBody.messages[0].content.some((item:any)=>item.type==='image_url')).toBe(true);
  });

  it('blocks release when a critical creative defect is found even with a high score',async()=>{
    const fetchImpl=vi.fn(async()=>providerResponse({...validReview,findings:[{
      severity:'critical',category:'continuity',sceneId:'scene-2',
      issue:'The protagonist changes identity between consecutive scenes.',
      recommendation:'Use the same approved character asset and appearance settings.',
      confidence:0.98
    }]}));
    const review=await reviewProductionCreatively(
      {title:'Test story',scenes:[{id:'scene-1'}]},
      [{sceneId:'scene-1',timeSeconds:1,imageBase64:'aGVsbG8='}],
      {},
      {apiKey:'test',baseUrl:'https://api.example.test/v1',model:'vision-model',fetchImpl:fetchImpl as typeof fetch}
    );
    expect(review.status).toBe('fail');
    expect(review.releaseApproved).toBe(false);
  });

  it('rejects malformed model review output',async()=>{
    const fetchImpl=vi.fn(async()=>new Response(JSON.stringify({choices:[{message:{content:'not json'}}]}),{status:200}));
    await expect(reviewProductionCreatively(
      {},[{sceneId:'scene-1',timeSeconds:1,imageBase64:'aGVsbG8='}],{},
      {apiKey:'test',baseUrl:'https://api.example.test/v1',model:'vision-model',fetchImpl:fetchImpl as typeof fetch}
    )).rejects.toThrow('malformed JSON');
  });
});
