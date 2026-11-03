import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ProductionSpec } from '@film-studio/contracts';
import { RobloxStoryScene } from './RobloxStoryScene';

export const FilmComposition: React.FC<{ production: ProductionSpec }> = ({ production }) => {
  const fps = useVideoConfig().fps;
  let cursor = 0;
  return <AbsoluteFill style={{ background: '#090c13', color: '#fff', fontFamily: 'Arial, sans-serif' }}>
    {production.scenes.map((scene, index) => {
      const start = cursor;
      const length = Math.round(scene.durationSeconds * fps);
      cursor += length;
      return <Sequence key={scene.id} from={start} durationInFrames={length}>
        <RobloxStoryScene scene={scene} sceneIndex={index} />
      </Sequence>;
    })}
    {production.subtitles.map((subtitle, index) => <Sequence key={index} from={Math.floor(subtitle.start * fps)} durationInFrames={Math.max(1, Math.ceil((subtitle.end - subtitle.start) * fps))}>
      <Subtitle text={subtitle.text} />
    </Sequence>)}
  </AbsoluteFill>;
};

const Subtitle: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const words = text.trim().split(/\\s+/);
  const active = Math.min(words.length - 1, Math.floor(frame / Math.max(1, durationInFrames) * words.length));
  return <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: '11%' }}>
    <div style={{ fontSize: 32, fontWeight: 800, textAlign: 'center', background: 'rgba(0,0,0,.76)', padding: '12px 24px', borderRadius: 12, maxWidth: '88%', textShadow: '0 2px 8px #000' }}>
      {words.map((word, i) => <React.Fragment key={i}><span style={{ color: i === active ? '#ffe27a' : '#fff' }}>{word}</span>{i < words.length - 1 ? ' ' : ''}</React.Fragment>)}
    </div>
  </AbsoluteFill>;
};
