import { describe, expect, it } from 'vitest';
import { ProductionSpecSchema } from './index.js';

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

  it('rejects unordered camera keyframes', () => {
    const invalid = structuredClone(base);
    invalid.scenes[0].camera.keyframes.reverse();
    expect(ProductionSpecSchema.safeParse(invalid).success).toBe(false);
  });
});
