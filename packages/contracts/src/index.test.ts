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
      assets: [{ id: 'bedroom-set', type: 'environment', uri: 'supabase://assets/bedroom.glb', version: '1', required: true }],
      environments: [{ id: 'bedroom', name: 'Alex bedroom', assetId: 'bedroom-set', locationDescription: 'A small bedroom at dawn' }],
      shots: [{ id: 'shot-1', sceneId: 'scene-1', title: 'Wide reveal', startSeconds: 0, durationSeconds: 6, assetIds: ['bedroom-set'], transitionIn: 'cut', transitionOut: 'fade' }],
      tracks: [{ id: 'camera-main', name: 'Main camera', kind: 'camera', targetId: 'scene-1' }],
      dialogue: [{ id: 'line-1', sceneId: 'scene-1', characterId: 'ALEX', speaker: 'Alex', text: 'Did you see that?', startSeconds: 1, endSeconds: 2.5, voiceProfileId: 'alex-en' }],
      audioCues: [{ id: 'cue-1', sceneId: 'scene-1', type: 'sound-effect', assetId: 'bedroom-set', label: 'Door creak', startSeconds: 2, durationSeconds: 1, fadeInSeconds: 0.1, fadeOutSeconds: 0.2 }],
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
        id:'bad-set',name:'Invalid set',groundSize:5,
        fog:{color:'#111827',near:90,far:10}
      }]
    });
    expect(ProductionSpecSchema.safeParse(invalid).success).toBe(false);
  });

});
