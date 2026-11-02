import React from 'react';
import {AbsoluteFill,interpolate,Sequence,spring,useCurrentFrame,useVideoConfig} from 'remotion';
import type {ProductionSpec} from '@film-studio/contracts';

export const FilmComposition:React.FC<{production:ProductionSpec}> = ({production}) => {
  const fps = useVideoConfig().fps;
  let cursor = 0;
  return <AbsoluteFill style={{background:'#090c13',color:'#fff',fontFamily:'Arial, sans-serif'}}>
    {production.scenes.map((scene,index) => {
      const start = cursor;
      const length = Math.round(scene.durationSeconds*fps);
      cursor += length;
      return <Sequence key={scene.id} from={start} durationInFrames={length}>
        <SceneCard scene={scene} index={index} />
      </Sequence>;
    })}
    {production.subtitles.map((subtitle,index) => <Sequence key={index} from={Math.floor(subtitle.start*fps)} durationInFrames={Math.max(1,Math.ceil((subtitle.end-subtitle.start)*fps))}>
      <Subtitle text={subtitle.text} />
    </Sequence>)}
  </AbsoluteFill>;
};

const SceneCard:React.FC<{scene:ProductionSpec['scenes'][number];index:number}> = ({scene,index}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame,fps,config:{damping:18}});
  const opacity = interpolate(frame,[0,12],[0,1],{extrapolateRight:'clamp'});
  const zoom = interpolate(frame,[0,150],[1.08,1],{extrapolateRight:'clamp'});
  return <AbsoluteFill style={{background:scene.background,justifyContent:'center',alignItems:'center',padding:90,opacity,transform:`scale(${zoom})`}}>
    <div style={{position:'absolute',top:54,left:64,fontSize:20,letterSpacing:5,opacity:0.55}}>CHAPTER {String(index+1).padStart(2,'0')}</div>
    <div style={{fontSize:76,fontWeight:750,textAlign:'center',transform:`translateY(${(1-enter)*45}px)`}}>{scene.title}</div>
    <div style={{marginTop:32,fontSize:28,maxWidth:920,lineHeight:1.4,textAlign:'center',opacity:0.82}}>{scene.visualDirection}</div>
    {scene.onScreenText.map((line,i)=><div key={i} style={{marginTop:14,fontSize:24,letterSpacing:1.2}}>{line}</div>)}
    <div style={{position:'absolute',bottom:52,left:64,right:64,fontSize:18,opacity:0.65}}>{scene.narration}</div>
  </AbsoluteFill>;
};

const Subtitle:React.FC<{text:string}> = ({text}) => <AbsoluteFill style={{justifyContent:'flex-end',alignItems:'center',paddingBottom:110}}>
  <div style={{fontSize:32,fontWeight:700,textAlign:'center',background:'rgba(0,0,0,.72)',padding:'12px 24px',borderRadius:8,maxWidth:'86%'}}>{text}</div>
</AbsoluteFill>;
