import { describe, expect, it } from 'vitest';
import { migrateProductionSpec, ProductionSpecSchema } from './index.js';

const base = {
  schemaVersion: 1,
  title: 'Reusable animation test',
  idea: 'Two actors perform independent actions.',
  styleId: 'roblox-cinematic',
  durationSeconds: 6,
  aspectRatio: '16:9',
  fps: 30,
  width: 1280,
  height: 720,
  characters: [
    { id: 'ALEX', name: 'Alex', rig: 'block-humanoid', appearance: { bodyColor: '#2369a8' } },
    { id: 'SHADOW', name: 'Shadow', rig: 'block-humanoid', appearance: { bodyColor: '#050505' } }
  ],
  scenes: [{
    id: 'scene-1',
    title: 'Independent action',
    durationSeconds: 6,
    visualDirection: 'Alex remains still while the shadow waves.',
    narration: '',
    actors: [
      { characterId: 'ALEX', position: [0, 0, 0], actions: [{ type: 'idle', startSeconds: 0, durationSeconds: 6 }] },
      { characterId: 'SHADOW', position: [1, 0, 0], actions: [{ type: 'wave', startSeconds: 2, durationSeconds: 3, arm: 'left', repeat: 3 }] }
    ],
    camera: { keyframes: [
      { atSeconds: 0, position: [0, 3, 9], target: [0, 1, 0] },
      { atSeconds: 6, position: [1, 3, 7], target: [0, 1, 0] }
    ] }
  }]
};

describe('declarative animation production contract', () => {

  it('accepts a complete provider-neutral manifest with assets, shots, dialogue, audio and captions', () => {
    const rich = structuredClone(base);
    Object.assign(rich, {
      assets: [{ id: 'bedroom-set', type: 'environment', uri: 'supabase://assets/bedroom.glb', version: '1', required: true }, {id:'door-creak',type:'sound-effect',libraryAssetKey:'door-creak',libraryVersion:1,required:true}],
      environments: [{ id: 'bedroom', name: 'Alex bedroom', assetId: 'bedroom-set', locationDescription: 'A small bedroom at dawn' }],
      shots: [{ id: 'shot-1', sceneId: 'scene-1', title: 'Wide reveal', startSeconds: 0, durationSeconds: 6, assetIds: ['bedroom-set'], transitionIn: 'cut', transitionOut: 'fade' }],
      tracks: [{ id: 'camera-main', name: 'Main camera', kind: 'camera', targetId: 'scene-1' }],
      voiceProfiles: [{id:'alex-en',name:'Alex Voice',provider:'edge-tts',voice:'en-US-AriaNeural'}],
      dialogue: [{ id: 'line-1', sceneId: 'scene-1', characterId: 'ALEX', speaker: 'Alex', text: 'Did you see that?', startSeconds: 1, endSeconds: 2.5, voiceProfileId: 'alex-en' }],
      audioCues: [{ id: 'cue-1', sceneId: 'scene-1', type: 'sound-effect', assetId: 'door-creak', label: 'Door creak', startSeconds: 2, durationSeconds: 1, fadeInSeconds: 0.1, fadeOutSeconds: 0.2 }],
      captionCues: [{ id: 'caption-1', sceneId: 'scene-1', text: 'Did you see that?', startSeconds: 1, endSeconds: 2.5, kind: 'dialogue', speaker: 'Alex' }],
      outputProfiles: [{ id: 'vertical-master', width: 1280, height: 720, fps: 30, codec: 'h264', container: 'mp4', quality: 'master' }],
      qaRules: [{ id: 'caption-safe-area', category: 'caption', severity: 'blocking', description: 'Captions must remain inside mobile safe areas.' }],
      projectMetadata: { language: 'en', targetPlatform: 'instagram-reels' }
    });
    expect(ProductionSpecSchema.safeParse(rich).success).toBe(true);
  });

  it('rejects dangling asset, shot, dialogue and audio references', () => {
    const invalid = structuredClone(base);
    Object.assign(invalid, {
      assets: [],
      shots: [{ id: 'shot-1', sceneId: 'missing-scene', startSeconds: 0, durationSeconds: 6, assetIds: ['missing-asset'] }],
      dialogue: [{ id: 'line-1', sceneId: 'missing-scene', speaker: 'Narrator', text: 'Hello' }],
      audioCues: [{ id: 'cue-1', sceneId: 'scene-1', type: 'music', assetId: 'missing-audio', label: 'Score', startSeconds: 0, durationSeconds: 6 }]
    });
    expect(ProductionSpecSchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects caption and dialogue timings outside the production timeline', () => {
    const invalid = structuredClone(base);
    Object.assign(invalid, {
      dialogue: [{ id: 'line-1', sceneId: 'scene-1', speaker: 'Narrator', text: 'Late line', startSeconds: 5, endSeconds: 7 }],
      captionCues: [{ id: 'caption-1', sceneId: 'scene-1', text: 'Late caption', startSeconds: 5, endSeconds: 7 }]
    });
    expect(ProductionSpecSchema.safeParse(invalid).success).toBe(false);
  });

  it('accepts reusable character assets and independently timed actors', () => {
    const result = ProductionSpecSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.scenes[0].actors).toHaveLength(2);
      expect(result.data.scenes[0].actors?.[1].actions[0].type).toBe('wave');
    }
  });

  it('accepts a second unrelated story without changing the production schema', () => {
    const unrelated = structuredClone(base);
    Object.assign(unrelated, {
      title: 'The Clock That Forgot Tomorrow',
      idea: 'A museum curator discovers a clock that removes one hour from the town each midnight.',
      styleId: 'stylized-mystery',
      durationSeconds: 6,
      aspectRatio: '9:16',
      width: 720,
      height: 1280,
      characters: [
        { id: 'CURATOR', name: 'Mara', rig: 'block-humanoid' },
        { id: 'CLOCK_SPIRIT', name: 'Clock Spirit', rig: 'block-humanoid' }
      ],
      scenes: [{
        id: 'museum-midnight',
        title: 'The missing hour',
        durationSeconds: 6,
        visualDirection: 'A giant clock skips backwards while the curator watches.',
        actors: [
          { characterId: 'CURATOR', actions: [{ type: 'recoil', startSeconds: 1, durationSeconds: 2 }] },
          { characterId: 'CLOCK_SPIRIT', actions: [{ type: 'appear', startSeconds: 3, durationSeconds: 2 }] }
        ],
        camera: { keyframes: [{ atSeconds: 0, position: [0, 4, 10], target: [0, 1, 0] }] }
      }]
    });
    expect(ProductionSpecSchema.safeParse(unrelated).success).toBe(true);
  });

  it('validates explicit scene windows and preserves transition and continuity data', () => {
    const production = structuredClone(base);
    production.scenes[0].startSeconds = 0;
    production.scenes[0].endSeconds = 6;
    production.scenes[0].transitionIn = 'fade';
    production.scenes[0].continuityNotes = ['The clock remains on the north wall.'];
    expect(ProductionSpecSchema.safeParse(production).success).toBe(true);
    production.scenes[0].startSeconds = 1;
    expect(ProductionSpecSchema.safeParse(production).success).toBe(false);
  });

  it('accepts a complete version manifest for renderer, assets, plan, audio and render settings', () => {
    const production = structuredClone(base);
    Object.assign(production, {
      schemaVersion: 2,
      versionManifest: {
        schema: '2.0.0',
        renderer: '1.4.0',
        asset: '3.1.0',
        productionPlan: '2.2.0',
        audio: '1.3.0',
        renderSettings: '1.1.0'
      }
    });
    expect(ProductionSpecSchema.safeParse(production).success).toBe(true);
  });

  it('rejects incomplete version manifests', () => {
    const production = structuredClone(base);
    Object.assign(production, {
      versionManifest: { schema: '2.0.0', renderer: '1.0.0' }
    });
    expect(ProductionSpecSchema.safeParse(production).success).toBe(false);
  });

  it('rejects duplicate scene IDs because scene references must be unambiguous', () => {
    const invalid = structuredClone(base);
    invalid.scenes.push({ ...invalid.scenes[0] });
    invalid.durationSeconds = 12;
    expect(ProductionSpecSchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects subtitles with reversed or out-of-range timecodes', () => {
    const invalid: any = structuredClone(base);
    invalid.subtitles = [
      { start: 3, end: 2, text: 'Reversed' },
      { start: 5, end: 7, text: 'Beyond runtime' }
    ];
    expect(ProductionSpecSchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects actors that reference undeclared character assets', () => {
    const invalid = structuredClone(base);
    invalid.scenes[0].actors[1].characterId = 'MISSING';
    expect(ProductionSpecSchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects actions that extend beyond the scene timeline', () => {
    const invalid = structuredClone(base);
    invalid.scenes[0].actors[1].actions[0].durationSeconds = 8;
    expect(ProductionSpecSchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects move actions without a destination', () => {
    const invalid = structuredClone(base);
    invalid.scenes[0].actors[1].actions = [{ type: 'move', startSeconds: 1, durationSeconds: 2 }];
    expect(ProductionSpecSchema.safeParse(invalid).success).toBe(false);
  });

  it('migrates a v1 production to v2 without losing scene content', () => {
    const migrated = migrateProductionSpec(base);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.title).toBe(base.title);
    expect(migrated.scenes).toEqual(ProductionSpecSchema.parse(base).scenes);
    expect(migrated.projectMetadata?.targetPlatform).toBe('instagram-reels');
    expect(migrated.projectMetadata?.language).toBe('en');
    expect(migrated.projectMetadata?.notes).toEqual([]);
  });

  it('accepts v2 manifests and keeps migration idempotent', () => {
    const v2 = {...base, schemaVersion: 2 as const};
    expect(ProductionSpecSchema.safeParse(v2).success).toBe(true);
    expect(migrateProductionSpec(migrateProductionSpec(v2))).toEqual(migrateProductionSpec(v2));
  });

  it('rejects unsupported future manifest versions', () => {
    expect(ProductionSpecSchema.safeParse({...base, schemaVersion: 3}).success).toBe(false);
  });

  it('rejects unordered camera keyframes', () => {
    const invalid = structuredClone(base);
    invalid.scenes[0].camera.keyframes.reverse();
    expect(ProductionSpecSchema.safeParse(invalid).success).toBe(false);
  });

  it('accepts reusable environment sets with stable scene references and props', () => {
    const production = structuredClone(base);
    Object.assign(production.scenes[0], {environmentId:'bedroom'});
    Object.assign(production, {
      environments: [{
        id:'bedroom',name:'Bedroom',locationDescription:'A compact bedroom at night',
        background:'#111827',groundColor:'#30343b',groundSize:120,
        fog:{color:'#111827',near:10,far:90},
        props:[{id:'bed',type:'box',position:[0,0.3,-1],scale:[2,0.6,1],color:'#343b50'}],
        continuityNotes:['Window remains on the left wall.']
      }]
    });
    expect(ProductionSpecSchema.safeParse(production).success).toBe(true);
  });

  it('rejects scenes that reference undeclared environments', () => {
    const invalid = structuredClone(base);
    Object.assign(invalid.scenes[0], {environmentId:'missing-environment'});
    expect(ProductionSpecSchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects invalid environment fog ranges and ground scales', () => {
    const invalid = structuredClone(base);
    Object.assign(invalid, {
      environments:[{
        id:'bad-set',name:'Invalid set',groundSize:80,
        fog:{color:'#111827',near:90,far:10}
      }]
    });
    expect(ProductionSpecSchema.safeParse(invalid).success).toBe(false);
  });


  it('accepts expanded performance actions including gaze, speech, dance and recovery poses', () => {
    const production: any = structuredClone(base);
    production.scenes[0].actors[0].actions = [
      {type:'look-at',startSeconds:0,durationSeconds:2,targetPosition:[1,1,0]},
      {type:'talk',startSeconds:2,durationSeconds:2},
      {type:'crouch',startSeconds:4,durationSeconds:1}
    ];
    production.scenes[0].actors[1].actions = [
      {type:'clap',startSeconds:0,durationSeconds:2},
      {type:'dance',startSeconds:2,durationSeconds:2},
      {type:'fall',startSeconds:4,durationSeconds:2}
    ];
    expect(ProductionSpecSchema.safeParse(production).success).toBe(true);
  });

  it('rejects look-at actions without a target', () => {
    const invalid = structuredClone(base);
    invalid.scenes[0].actors[0].actions = [{type:'look-at',startSeconds:0,durationSeconds:2}];
    expect(ProductionSpecSchema.safeParse(invalid).success).toBe(false);
  });


  it('accepts explicit immutable library asset versions', () => {
    const production = structuredClone(base);
    Object.assign(production, {
      assets:[{id:'hero-rig',type:'rig',libraryAssetKey:'hero-rig',libraryVersion:3,required:true}]
    });
    expect(ProductionSpecSchema.safeParse(production).success).toBe(true);
  });

  it('rejects incomplete reusable library asset references', () => {
    const production = structuredClone(base);
    Object.assign(production, {
      assets:[{id:'hero-rig',type:'rig',libraryAssetKey:'hero-rig',required:true}]
    });
    expect(ProductionSpecSchema.safeParse(production).success).toBe(false);
  });


  it('rejects environment ground sizes below the supported minimum', () => {
    const invalid = structuredClone(base);
    Object.assign(invalid, {
      environments:[{id:'small-set',name:'Small set',groundSize:5}]
    });
    expect(ProductionSpecSchema.safeParse(invalid).success).toBe(false);
  });


  it('rejects dialogue lines that reference undeclared voice profiles', () => {
    const production = structuredClone(base);
    Object.assign(production, {
      dialogue:[{id:'line-voice',sceneId:'scene-1',speaker:'Alex',text:'Hello',voiceProfileId:'missing-voice'}],
      voiceProfiles:[]
    });
    expect(ProductionSpecSchema.safeParse(production).success).toBe(false);
  });

  it('accepts reusable voice profiles with bounded delivery presets', () => {
    const production = structuredClone(base);
    Object.assign(production, {
      voiceProfiles:[{id:'narrator',name:'Narrator',provider:'edge-tts',voice:'en-US-AriaNeural',rate:'+10%',pitch:'+0Hz',volume:'+0%'}],
      dialogue:[{id:'line-voice',sceneId:'scene-1',speaker:'Narrator',text:'A new story begins.',voiceProfileId:'narrator',startSeconds:1,endSeconds:3}]
    });
    expect(ProductionSpecSchema.safeParse(production).success).toBe(true);
  });


  it('rejects dialogue that falls outside its referenced scene window', () => {
    const production = structuredClone(base);
    production.scenes = [
      {...production.scenes[0],id:'scene-1',durationSeconds:3,actors:[],camera:{keyframes:[{atSeconds:0,position:[0,3,9],target:[0,1,0]}]}},
      {...production.scenes[0],id:'scene-2',durationSeconds:3,actors:[],camera:{keyframes:[{atSeconds:0,position:[0,3,9],target:[0,1,0]}]}}
    ];
    Object.assign(production,{voiceProfiles:[{id:'narrator',name:'Narrator',provider:'edge-tts',voice:'en-US-AriaNeural'}],dialogue:[{id:'line-1',sceneId:'scene-2',speaker:'Narrator',text:'Hello there.',startSeconds:1,endSeconds:2,voiceProfileId:'narrator'}]});
    expect(ProductionSpecSchema.safeParse(production).success).toBe(false);
  });

  it('rejects actor actions that exceed scene duration or omit required targets', () => {
    const production = structuredClone(base);
    production.scenes[0].actors[0].actions = [{type:'move',startSeconds:0,durationSeconds:2}];
    expect(ProductionSpecSchema.safeParse(production).success).toBe(false);
    production.scenes[0].actors[0].actions = [{type:'wave',startSeconds:5,durationSeconds:2}];
    expect(ProductionSpecSchema.safeParse(production).success).toBe(false);
  });


  it('rejects audio cue asset references with incompatible asset types', () => {
    const production = structuredClone(base);
    Object.assign(production,{
      assets:[{id:'bedroom-set',type:'environment',required:true}],
      audioCues:[{id:'bad-cue',sceneId:'scene-1',type:'sound-effect',assetId:'bedroom-set',label:'Wrong type',startSeconds:1,durationSeconds:1}]
    });
    expect(ProductionSpecSchema.safeParse(production).success).toBe(false);
  });


  it('accepts model props backed by reusable prop assets', () => {
    const production: any = structuredClone(base);
    production.assets = [{id:'tree-model',type:'prop',libraryAssetKey:'tree-model',libraryVersion:1,required:true}];
    production.scenes[0].props = [{id:'tree',type:'model',assetId:'tree-model',position:[0,0,0],scale:[1,1,1],color:'#ffffff',rotation:[0,0,0],castShadow:true}];
    expect(ProductionSpecSchema.safeParse(production).success).toBe(true);
  });

  it('rejects model props without a reusable asset reference', () => {
    const production: any = structuredClone(base);
    production.scenes[0].props = [{id:'tree',type:'model',position:[0,0,0],scale:[1,1,1],color:'#ffffff',rotation:[0,0,0],castShadow:true}];
    expect(ProductionSpecSchema.safeParse(production).success).toBe(false);
  });


  it('accepts reusable GLTF humanoid rigs with explicit animation maps', () => {
    const production: any = structuredClone(base);
    production.assets = [{id:'hero-rig',type:'rig',libraryAssetKey:'hero-rig',libraryVersion:2,required:true}];
    production.characters[0].rig = 'gltf-humanoid';
    production.characters[0].assetId = 'hero-rig';
    production.characters[0].animationMap = {idle:'Idle',walk:'Walk',run:'Run',talk:'Talk'};
    expect(ProductionSpecSchema.safeParse(production).success).toBe(true);
  });

  it('rejects GLTF humanoid characters without a declared rig asset', () => {
    const production: any = structuredClone(base);
    production.characters[0].rig = 'gltf-humanoid';
    expect(ProductionSpecSchema.safeParse(production).success).toBe(false);
  });

});
