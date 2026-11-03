import React from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import type { ProductionSpec } from '@film-studio/contracts';

export type WordAlignmentCue = { text: string; start: number; end: number; sceneIndex: number; source?: string };
import { RobloxStoryScene } from './RobloxStoryScene';
import { DeclarativeScene } from './DeclarativeScene';

export const FilmComposition: React.FC<{ production: ProductionSpec; wordAlignments?: WordAlignmentCue[] }> = ({ production, wordAlignments = [] }) => {
  const fps = useVideoConfig().fps;
  let cursor = 0;
  return <AbsoluteFill style={{ background: '#090c13', color: '#fff', fontFamily: 'Arial, sans-serif' }}>
    {production.scenes.map((scene, index) => {
      const start = cursor;
      const length = Math.round(scene.durationSeconds * fps);
      cursor += length;
      return <Sequence key={scene.id} from={start} durationInFrames={length}>
        {(scene.actors?.length ?? 0) > 0 || (scene.props?.length ?? 0) > 0 || scene.camera ? <DeclarativeScene scene={scene} production={production} /> : <RobloxStoryScene scene={scene} sceneIndex={index} sceneStartSeconds={start / fps} wordAlignments={wordAlignments} />}
      </Sequence>;
    })}
  </AbsoluteFill>;
};

