import React from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import type { ProductionSpec } from '@film-studio/contracts';

export type WordAlignmentCue = { text: string; start: number; end: number; sceneIndex: number; source?: string };
import { RobloxStoryScene } from './RobloxStoryScene';
import { DeclarativeScene } from './DeclarativeScene';

export const FilmComposition: React.FC<{ production: ProductionSpec; wordAlignments?: WordAlignmentCue[] }> = ({ production, wordAlignments = [] }) => {
  const {fps,width,height} = useVideoConfig();
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
    {(production.captionCues ?? []).filter(cue => cue.kind !== 'dialogue' && cue.kind !== 'narration').map(cue => {
      const from = Math.max(0,Math.round(cue.startSeconds * fps));
      const durationInFrames = Math.max(1,Math.round((cue.endSeconds - cue.startSeconds) * fps));
      const isTitle = cue.kind === 'title';
      const isLabel = cue.kind === 'label';
      const fontSize = Math.max(22,Math.min(isTitle ? 64 : 42,Math.round(width * (isTitle ? 0.055 : 0.036))));
      return <Sequence key={cue.id} from={from} durationInFrames={durationInFrames}>
        <AbsoluteFill style={{
          justifyContent:isTitle ? 'center' : isLabel ? 'flex-start' : 'flex-end',
          alignItems:'center',
          paddingTop:height * (isLabel ? 0.12 : 0.06),
          paddingBottom:height * (isTitle ? 0 : 0.14),
          paddingLeft:width * 0.09,
          paddingRight:width * 0.09,
          pointerEvents:'none'
        }}>
          <div style={{
            maxWidth:'100%',
            padding:isTitle ? '0.16em 0.28em' : '0.22em 0.58em',
            borderRadius:isTitle ? 10 : 999,
            background:isTitle ? 'rgba(5,8,14,0.18)' : 'rgba(5,8,14,0.72)',
            color:'#ffffff',
            fontFamily:'Arial, sans-serif',
            fontSize,
            fontWeight:900,
            lineHeight:1.12,
            textAlign:'center',
            overflowWrap:'anywhere',
            textShadow:'0 3px 14px rgba(0,0,0,0.9)',
            border:isTitle ? 'none' : '1px solid rgba(255,255,255,0.22)'
          }}>{cue.text}</div>
        </AbsoluteFill>
      </Sequence>;
    })}
  </AbsoluteFill>;
};

