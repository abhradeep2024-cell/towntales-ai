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
  const { durationInFrames, width } = useVideoConfig();
  const scale = width / 360;
  // Split on whitespace so the two-word karaoke window is applied to real words.
  const words = text.trim().split(/\s+/).filter(Boolean);
  const active = Math.min(words.length - 1, Math.floor(frame / Math.max(1, durationInFrames) * words.length));
  // Keep captions to one or two words for phone readability.
  const firstVisible = Math.floor(active / 2) * 2;
  const visibleWords = words.slice(firstVisible, firstVisible + 2);
  return <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: '16%' }}>
    <div style={{ fontSize: 34 * scale, lineHeight: 1.12, fontWeight: 900, textAlign: 'center', background: 'rgba(0,0,0,.82)', padding: `${10 * scale}px ${22 * scale}px`, borderRadius: 10 * scale, maxWidth: '88%', textShadow: '0 2px 8px #000', letterSpacing: 0.2 * scale }}>
      {visibleWords.map((word, i) => {
        const wordIndex = firstVisible + i;
        return <React.Fragment key={wordIndex}><span style={{ color: wordIndex === active ? '#ff4057' : '#fff' }}>{word}</span>{i < visibleWords.length - 1 ? ' ' : ''}</React.Fragment>;
      })}
    </div>
  </AbsoluteFill>;
};
