import React from 'react';
import {AbsoluteFill,interpolate,useCurrentFrame} from 'remotion';

export const FilmStudioSmoke:React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame,[0,18,132,149],[0,1,1,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
  const scale = interpolate(frame,[0,149],[1.08,1],{extrapolateRight:'clamp'});
  return <AbsoluteFill style={{background:'#101522',justifyContent:'center',alignItems:'center',color:'#f6f1e8',fontFamily:'Arial'}}>
    <div style={{opacity,transform:`scale(${scale})`,fontSize:76,fontWeight:700,letterSpacing:4}}>FILM STUDIO</div>
    <div style={{position:'absolute',bottom:70,fontSize:22,opacity:0.7}}>5-second render verification</div>
  </AbsoluteFill>;
};
