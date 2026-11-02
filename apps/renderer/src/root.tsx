import React from 'react';
import {Composition} from 'remotion';
import {FilmComposition} from './compositions/FilmComposition';
import {FilmStudioSmoke} from './compositions/FilmStudioSmoke';

export const FilmStudioRoot:React.FC = () => <>
  <Composition id="FilmStudio" component={FilmComposition} durationInFrames={150} fps={30} width={1280} height={720}
    defaultProps={{production:{schemaVersion:1,title:'Film Studio',idea:'Smoke render',styleId:'minimal-cinematic',styleInvariants:[],durationSeconds:5,aspectRatio:'16:9',fps:30,width:1280,height:720,scenes:[{id:'scene-1',title:'Opening',durationSeconds:5,visualDirection:'Minimal cinematic title',narration:'',onScreenText:['Film Studio'],background:'#101522'}],subtitles:[],audio:{musicVolume:0.18}}}} />
  <Composition id="FilmStudioSmoke" component={FilmStudioSmoke} durationInFrames={150} fps={30} width={1280} height={720} />
</>;
