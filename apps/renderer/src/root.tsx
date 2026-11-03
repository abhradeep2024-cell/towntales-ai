import React from 'react';
import {Composition} from 'remotion';
import {FilmComposition} from './compositions/FilmComposition';
import {FilmStudioSmoke} from './compositions/FilmStudioSmoke';
import {episode01Production} from './compositions/episode01';

const landscapeProduction = {
  schemaVersion: 1 as const, title: 'Film Studio', idea: 'Smoke render', styleId: 'swiss-motion',
  styleInvariants: ['Swiss grid', 'typographic hierarchy'], durationSeconds: 5, aspectRatio: '16:9' as const,
  fps: 30 as const, width: 1280, height: 720,
  scenes: [{id:'scene-1',title:'Film Studio',durationSeconds:5,visualDirection:'A clean cinematic title reveal',narration:'',onScreenText:['FILM STUDIO'],background:'#101522'}],
  subtitles: [{start:1,end:3,text:'Five second render test'}],
  audio: {musicEnabled:false,voiceEnabled:false,burnSubtitles:false,voice:'en-US-AriaNeural',musicVolume:0.12,voiceVolume:1,musicStyle:'ambient' as const}
};

const multiSceneProduction = {
  schemaVersion: 1 as const, title: 'Multi-scene QA', idea: 'A three-beat test story', styleId: 'swiss-motion',
  styleInvariants: ['Swiss grid', 'typographic hierarchy'], durationSeconds: 10, aspectRatio: '16:9' as const,
  fps: 30 as const, width: 1280, height: 720,
  scenes: [
    {id:'scene-1',title:'The Signal',durationSeconds:3,visualDirection:'A signal appears in a dark field',narration:'',onScreenText:['01 · SIGNAL'],background:'#101522'},
    {id:'scene-2',title:'The Response',durationSeconds:3,visualDirection:'The signal expands into a structured grid',narration:'',onScreenText:['02 · RESPONSE'],background:'#192a40'},
    {id:'scene-3',title:'The Resolution',durationSeconds:4,visualDirection:'The composition resolves into a final frame',narration:'',onScreenText:['03 · RESOLUTION'],background:'#243c48'}
  ],
  subtitles: [{start:0.5,end:2.5,text:'A signal appears.'},{start:3.5,end:5.5,text:'A response follows.'},{start:7,end:9.5,text:'The story resolves.'}],
  audio: {musicEnabled:false,voiceEnabled:false,burnSubtitles:false,voice:'en-US-AriaNeural',musicVolume:0.12,voiceVolume:1,musicStyle:'ambient' as const}
};

const verticalProduction = {
  schemaVersion: 1 as const, title: 'Vertical format QA', idea: 'Portrait-safe video frame', styleId: 'swiss-motion',
  styleInvariants: ['Swiss grid', 'typographic hierarchy'], durationSeconds: 5, aspectRatio: '9:16' as const,
  fps: 30 as const, width: 720, height: 1280,
  scenes: [{id:'scene-1',title:'VERTICAL',durationSeconds:5,visualDirection:'A title framed for portrait mobile viewing',narration:'',onScreenText:['9:16 · 720 × 1280'],background:'#101522'}],
  subtitles: [{start:1,end:3,text:'Portrait render check'}],
  audio: {musicEnabled:false,voiceEnabled:false,burnSubtitles:false,voice:'en-US-AriaNeural',musicVolume:0.12,voiceVolume:1,musicStyle:'ambient' as const}
};

const declarativeAnimationProduction = {
  schemaVersion: 1 as const, title: 'Declarative Animation Engine QA', idea: 'A reusable actor walks, turns and waves beside a prop.', styleId: 'roblox-cinematic',
  styleInvariants: ['Persistent actor identity', 'Timeline-driven motion'], durationSeconds: 6, aspectRatio: '16:9' as const,
  fps: 30 as const, width: 1280, height: 720,
  characters: [{
    id: 'CHAR_QA_001', name: 'QA Actor', rig: 'block-humanoid' as const,
    appearance: { bodyColor: '#2563a6', skinColor: '#e8b58e', hairColor: '#171717', pantsColor: '#171a22', shoeColor: '#f2f2f2', eyeColor: '#171717', eyeEmissiveColor: '#000000', eyeEmissiveIntensity: 0, mouthColor: '#914d43', castShadow: true, receiveShadow: true, scale: 1 }
  }],
  scenes: [{
    id: 'declarative-scene', title: 'Actor motion contract', durationSeconds: 6,
    visualDirection: 'An actor walks into frame, turns and waves beside a prop.',
    narration: '', onScreenText: ['DECLARATIVE ANIMATION'], background: '#101522',
    actors: [{
      characterId: 'CHAR_QA_001', position: [-2,0,0] as [number,number,number], rotationY: 0,
      actions: [
        { type: 'walk' as const, startSeconds: 0, durationSeconds: 1.8, intensity: 1, arm: 'both' as const, repeat: 1 },
        { type: 'move' as const, startSeconds: 0, durationSeconds: 2, targetPosition: [0,0,0] as [number,number,number], intensity: 1, arm: 'right' as const, repeat: 1 },
        { type: 'turn' as const, startSeconds: 2, durationSeconds: 0.8, targetRotationY: 0.6, intensity: 1, arm: 'right' as const, repeat: 1 },
        { type: 'wave' as const, startSeconds: 3, durationSeconds: 2, intensity: 1, arm: 'right' as const, repeat: 3 }
      ]
    }],
    props: [{ id: 'qa-prop', type: 'box' as const, position: [2,0.6,0] as [number,number,number], scale: [0.8,1.2,0.8] as [number,number,number], color: '#d8a34a', rotation: [0,0,0] as [number,number,number], castShadow: true }],
    camera: { keyframes: [
      { atSeconds: 0, position: [0,3,9] as [number,number,number], target: [0,1,0] as [number,number,number], fov: 40 },
      { atSeconds: 6, position: [1,2.5,6] as [number,number,number], target: [0.5,1,0] as [number,number,number], fov: 35 }
    ] }
  }],
  subtitles: [], audio: { musicEnabled: false, voiceEnabled: false, burnSubtitles: false, voice: 'en-US-AriaNeural', musicVolume: 0.12, voiceVolume: 1, musicStyle: 'ambient' as const }
};

const episode01ProductionFullResolution = {
  ...episode01Production,
  width: 1080,
  height: 1920
};

export const FilmStudioRoot:React.FC = () => <>
  <Composition id="FilmStudio" component={FilmComposition} durationInFrames={150} fps={30} width={1280} height={720}
    defaultProps={{production:landscapeProduction}} />
  <Composition id="FilmStudioSmoke" component={FilmStudioSmoke} durationInFrames={150} fps={30} width={1280} height={720} />
  <Composition id="FilmStudioMultiSceneSmoke" component={FilmComposition} durationInFrames={300} fps={30} width={1280} height={720}
    defaultProps={{production:multiSceneProduction}} />
  <Composition id="FilmStudioDeclarativeSmoke" component={FilmComposition} durationInFrames={180} fps={30} width={1280} height={720}
    defaultProps={{production:declarativeAnimationProduction}} />
  <Composition id="FilmStudioVerticalSmoke" component={FilmComposition} durationInFrames={150} fps={30} width={720} height={1280}
    defaultProps={{production:verticalProduction}} />
  <Composition id="TownTalesEpisode01Preview" component={FilmComposition} durationInFrames={1800} fps={30} width={360} height={640}
    defaultProps={{production:episode01Production}} />
  <Composition id="TownTalesEpisode01Production" component={FilmComposition} durationInFrames={1800} fps={30} width={1080} height={1920}
    defaultProps={{production:episode01ProductionFullResolution}} />
</>;
