import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { ProductionSpec } from '@film-studio/contracts';

type Scene = ProductionSpec['scenes'][number];
type Character = NonNullable<ProductionSpec['characters']>[number];
type Actor = NonNullable<Scene['actors']>[number];
type LibraryAsset = NonNullable<ProductionSpec['assets']>[number];

const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const smooth = (v: number) => { const p = clamp(v); return p * p * (3 - 2 * p); };
const mix = (a: number, b: number, p: number) => a + (b - a) * p;

function CameraTrack({ scene, time }: { scene: Scene; time: number }) {
  const { camera } = useThree();
  const keys = scene.camera?.keyframes ?? [
    { atSeconds: 0, position: [0, 3, 9] as [number,number,number], target: [0, 1, 0] as [number,number,number], fov: 40 },
    { atSeconds: scene.durationSeconds, position: [0, 3, 9] as [number,number,number], target: [0, 1, 0] as [number,number,number], fov: 40 }
  ];
  const segment = () => {
    if (time <= keys[0].atSeconds) return [keys[0], keys[0]] as const;
    for (let i = 0; i < keys.length - 1; i++) {
      if (time <= keys[i + 1].atSeconds) return [keys[i], keys[i + 1]] as const;
    }
    return [keys[keys.length - 1], keys[keys.length - 1]] as const;
  };
  const sample = (field: 'position' | 'target') => {
    const [left, right] = segment();
    const p = left === right ? 0 : smooth((time - left.atSeconds) / Math.max(0.001, right.atSeconds - left.atSeconds));
    return [0,1,2].map(i => mix(left[field][i], right[field][i], p)) as [number,number,number];
  };
  useFrame(() => {
    const pos = sample('position'), target = sample('target');
    camera.position.set(...pos); camera.lookAt(...target);
    const [left, right] = segment();
    const p = left === right ? 0 : smooth((time-left.atSeconds)/Math.max(.001,right.atSeconds-left.atSeconds));
    const fov = mix(left.fov, right.fov, p);
    if (camera instanceof THREE.PerspectiveCamera && camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  });
  return null;
}

function AnimatedActor({actor,character,time,assets}:{
  actor:Actor;character?:Character;time:number;assets:LibraryAsset[];
}) {
  if (character?.rig === 'gltf-humanoid' && character.assetId) {
    const asset = assets.find(item=>item.id===character.assetId);
    if (asset?.uri) return <GltfAnimatedActor actor={actor} character={character} asset={asset} time={time}/>;
  }
  return <BlockAnimatedActor actor={actor} character={character} time={time}/>;
}

function GltfAnimatedActor({actor,character,asset,time}:{
  actor:Actor;character:Character;asset:LibraryAsset;time:number;
}) {
  const gltf = useLoader(GLTFLoader,asset.uri!);
  const model = useMemo(()=>{
    const clone = cloneSkeleton(gltf.scene);
    clone.traverse(node=>{
      if (node instanceof THREE.Mesh) {
        node.castShadow = character.appearance.castShadow;
        node.receiveShadow = character.appearance.receiveShadow;
      }
    });
    return clone;
  },[gltf.scene,character.appearance.castShadow,character.appearance.receiveShadow]);
  const mixer = useMemo(()=>new THREE.AnimationMixer(model),[model]);
  const actionMap = useMemo(()=>new Map(gltf.animations.map(clip=>[clip.name,mixer.clipAction(clip)])),[gltf.animations,mixer]);
  const currentAction = useRef<THREE.AnimationAction|null>(null);
  const {fps} = useVideoConfig();
  const active = actor.actions.filter(action=>time>=action.startSeconds && time<=action.startSeconds+action.durationSeconds);
  const priorities = ['talk','wave','point','gesture','jump','recoil','dance','clap','crouch','run','walk','idle'];
  const actionType = priorities.find(type=>active.some(action=>action.type===type)) ?? 'idle';
  const currentAnimationAction = active.find(action=>action.type===actionType);
  const requestedName = character.animationMap?.[actionType] ?? actionType;
  const clipName = gltf.animations.find(clip=>clip.name.toLowerCase()===requestedName.toLowerCase())?.name ?? gltf.animations[0]?.name;
  const nextAction = clipName ? actionMap.get(clipName) ?? null : null;
  const move = [...actor.actions].filter(action=>action.type==='move' && time>=action.startSeconds).sort((a,b)=>b.startSeconds-a.startSeconds)[0];
  const moveProgress = move ? smooth((time-move.startSeconds)/Math.max(0.001,move.durationSeconds)) : 0;
  const target = move?.targetPosition ?? actor.position;
  const position = actor.position.map((value,index)=>mix(value,target[index],moveProgress)) as [number,number,number];
  const turn = [...actor.actions].filter(action=>action.type==='turn' && time>=action.startSeconds).sort((a,b)=>b.startSeconds-a.startSeconds)[0];
  const turnProgress = turn ? smooth((time-turn.startSeconds)/Math.max(0.001,turn.durationSeconds)) : 0;
  const rotationY = turn ? mix(actor.rotationY,turn.targetRotationY ?? actor.rotationY,turnProgress) : actor.rotationY;
  useFrame(()=>{
    if (nextAction && currentAction.current !== nextAction) {
      currentAction.current?.fadeOut(0.12);
      const repeating = ['idle','walk','run','dance'].includes(actionType);
      const repetitions = repeating ? Infinity : Math.max(1,currentAnimationAction?.repeat ?? 1);
      nextAction.setLoop(repeating ? THREE.LoopRepeat : THREE.LoopOnce,repetitions);
      nextAction.clampWhenFinished = !repeating;
      nextAction.reset().fadeIn(0.12).play();
      currentAction.current = nextAction;
    }
    mixer.setTime(Math.max(0,time-(currentAnimationAction?.startSeconds ?? 0)));
  });
  return <group position={position} rotation={[0,rotationY,0]} scale={character.appearance.scale}>
    <primitive object={model}/>
  </group>;
}

function BlockAnimatedActor({ actor, character, time }: { actor: Actor; character?: Character; time: number }) {
  const root = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null), rightArm = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null), rightLeg = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null), mouth = useRef<THREE.Mesh>(null);
  const appearance = character?.appearance;
  const scale = appearance?.scale ?? 1;
  const actions = actor.actions;
  const active = actions.filter(a => time >= a.startSeconds && time <= a.startSeconds + a.durationSeconds);
  const movement = active.find(a => a.type === 'walk' || a.type === 'run');
  const wave = active.find(a => a.type === 'wave');
  const point = active.find(a => a.type === 'point' || a.type === 'gesture');
  const jump = active.find(a => a.type === 'jump');
  const recoil = active.find(a => a.type === 'recoil');
  const crouch = active.find(a => a.type === 'crouch');
  const clap = active.find(a => a.type === 'clap');
  const dance = active.find(a => a.type === 'dance');
  const talk = active.find(a => a.type === 'talk');
  const lookAt = active.find(a => a.type === 'look-at');
  const fall = [...actions].filter(a => a.type === 'fall' && time >= a.startSeconds).sort((a,b) => b.startSeconds-a.startSeconds)[0];
  const turn = [...actions].filter(a => a.type === 'turn' && time >= a.startSeconds).sort((a,b) => b.startSeconds-a.startSeconds)[0];
  const expression = active.find(a => a.type === 'expression');
  const move = [...actions].filter(a => a.type === 'move' && time >= a.startSeconds).sort((a,b) => b.startSeconds-a.startSeconds)[0];
  const moveP = move ? smooth((time-move.startSeconds)/move.durationSeconds) : 0;
  const base = actor.position;
  const target = move?.targetPosition ?? base;
  const walkPhase = time * (movement?.type === 'run' ? 13 : 7);
  const waveP = wave ? clamp((time-wave.startSeconds)/wave.durationSeconds) : 0;
  const waveActive = Boolean(wave && waveP > 0 && waveP < 1);
  const gestureP = point ? Math.sin(Math.PI * clamp((time-point.startSeconds)/point.durationSeconds)) : 0;
  const jumpP = jump ? Math.sin(Math.PI * clamp((time-jump.startSeconds)/jump.durationSeconds)) : 0;
  const recoilP = recoil ? Math.sin(Math.PI * clamp((time-recoil.startSeconds)/recoil.durationSeconds)) : 0;
  const crouchP = crouch ? Math.sin(Math.PI * clamp((time-crouch.startSeconds)/crouch.durationSeconds)) : 0;
  const fallP = fall ? smooth(clamp((time-fall.startSeconds)/fall.durationSeconds)) : 0;
  const dancePhase = time * 5.5;
  const turnP = turn ? smooth((time-turn.startSeconds)/turn.durationSeconds) : 0;
  const appear = actions.filter(a => a.type === 'appear').sort((a,b) => a.startSeconds-b.startSeconds)[0];
  const disappear = actions.filter(a => a.type === 'disappear' && time >= a.startSeconds).sort((a,b) => b.startSeconds-a.startSeconds)[0];
  const opacity = disappear ? 1 - smooth((time-disappear.startSeconds)/disappear.durationSeconds) : appear ? smooth((time-appear.startSeconds)/appear.durationSeconds) : 1;
  const stride = movement ? Math.sin(walkPhase) * (movement.type === 'run' ? .62 : .38) * movement.intensity : dance ? Math.sin(dancePhase) * .55 : 0;
  const waveRotation = wave && waveActive ? Math.sin(waveP * Math.PI * 2 * wave.repeat) * .55 * Math.sin(Math.PI * waveP) : 0;
  const armAngle = waveActive ? -1.9 + waveRotation : point ? -1.4 * gestureP : 0;
  const performanceArm = clap ? Math.sin(time * 18) * .65 : dance ? Math.sin(dancePhase * 1.7) * .9 : 0;
  const armSide = wave?.arm ?? point?.arm ?? 'right';
  useFrame(() => {
    if (!root.current) return;
    root.current.position.set(mix(base[0],target[0],moveP), base[1] + jumpP * (jump?.intensity ?? 1) * 1.6 - crouchP * .22 - fallP * .42, mix(base[2],target[2],moveP));
    root.current.rotation.set(0, mix(actor.rotationY, turn?.targetRotationY ?? actor.rotationY, turnP), recoilP * .18 + fallP * 1.35);
    root.current.scale.set(scale * opacity, scale * opacity * (1 - crouchP * .2), scale * opacity);
    if (leftArm.current) leftArm.current.rotation.z = waveActive || point ? (armSide === 'left' || armSide === 'both' ? armAngle : stride) : performanceArm + stride;
    if (rightArm.current) rightArm.current.rotation.z = waveActive || point ? (armSide === 'right' || armSide === 'both' ? -armAngle : -stride) : -performanceArm - stride;
    if (leftLeg.current) leftLeg.current.rotation.x = stride;
    if (rightLeg.current) rightLeg.current.rotation.x = -stride;
    if (head.current) {
      const targetYaw = lookAt?.targetPosition ? Math.atan2(lookAt.targetPosition[0] - root.current.position.x, lookAt.targetPosition[2] - root.current.position.z) - root.current.rotation.y : 0;
      head.current.rotation.y = lookAt ? targetYaw : turnP * .7;
    }
    if (mouth.current) {
      const emotion = expression?.emotion ?? 'neutral';
      mouth.current.scale.y = talk ? .8 + Math.abs(Math.sin(time * 14)) * 1.4 : emotion === 'shock' || emotion === 'fear' ? 2.6 : emotion === 'smile' ? 0.7 : 1;
    }
  });
  const body = appearance?.bodyColor ?? '#2563a6';
  const skin = appearance?.skinColor ?? '#e8b58e';
  const dark = appearance?.hairColor ?? '#171717';
  const pants = appearance?.pantsColor ?? '#171a22';
  const shoes = appearance?.shoeColor ?? '#f2f2f2';
  const castShadow = appearance?.castShadow ?? true;
  const receiveShadow = appearance?.receiveShadow ?? true;
  const eyeColor = appearance?.eyeColor ?? '#171717';
  const eyeEmissiveColor = appearance?.eyeEmissiveColor ?? '#000000';
  const eyeEmissiveIntensity = appearance?.eyeEmissiveIntensity ?? 0;
  const mouthColor = appearance?.mouthColor ?? '#914d43';
  return <group ref={root} position={actor.position} rotation={[0,actor.rotationY,0]}>
    <mesh position={[0,1.35,0]} castShadow={castShadow} receiveShadow={receiveShadow}><boxGeometry args={[.72,.85,.38]}/><meshStandardMaterial color={body}/></mesh>
    <group ref={head} position={[0,2.05,0]}>
      <mesh castShadow={castShadow} receiveShadow={receiveShadow}><boxGeometry args={[.58,.58,.55]}/><meshStandardMaterial color={skin}/></mesh>
      <mesh position={[0,.29,-.015]} castShadow={castShadow} receiveShadow={receiveShadow}><boxGeometry args={[.64,.16,.62]}/><meshStandardMaterial color={dark}/></mesh>
      <mesh position={[-.14,.02,.28]}><boxGeometry args={[.055,.07,.02]}/><meshStandardMaterial color={eyeColor} emissive={eyeEmissiveColor} emissiveIntensity={eyeEmissiveIntensity}/></mesh>
      <mesh ref={mouth} position={[0,-.13,.28]}><boxGeometry args={[.16,.035,.02]}/><meshStandardMaterial color={mouthColor}/></mesh>
      <mesh position={[.14,.02,.28]}><boxGeometry args={[.055,.07,.02]}/><meshStandardMaterial color={eyeColor} emissive={eyeEmissiveColor} emissiveIntensity={eyeEmissiveIntensity}/></mesh>
    </group>
    <group ref={leftArm} position={[-.48,1.68,0]}><mesh position={[0,-.35,0]} castShadow={castShadow} receiveShadow={receiveShadow}><boxGeometry args={[.24,.72,.27]}/><meshStandardMaterial color={body}/></mesh></group>
    <group ref={rightArm} position={[.48,1.68,0]}><mesh position={[0,-.35,0]} castShadow={castShadow} receiveShadow={receiveShadow}><boxGeometry args={[.24,.72,.27]}/><meshStandardMaterial color={body}/></mesh></group>
    <group ref={leftLeg} position={[-.19,.92,0]}><mesh position={[0,-.42,0]} castShadow={castShadow} receiveShadow={receiveShadow}><boxGeometry args={[.29,.82,.32]}/><meshStandardMaterial color={pants}/></mesh><mesh position={[0,-.84,.08]} castShadow={castShadow} receiveShadow={receiveShadow}><boxGeometry args={[.32,.18,.48]}/><meshStandardMaterial color={shoes}/></mesh></group>
    <group ref={rightLeg} position={[.19,.92,0]}><mesh position={[0,-.42,0]} castShadow><boxGeometry args={[.29,.82,.32]}/><meshStandardMaterial color={pants}/></mesh><mesh position={[0,-.84,.08]}><boxGeometry args={[.32,.18,.48]}/><meshStandardMaterial color={shoes}/></mesh></group>
  </group>;
}

function ModelAsset({asset,position,scale,rotation,castShadow=true}:{
  asset:LibraryAsset;
  position:[number,number,number];
  scale:[number,number,number];
  rotation:[number,number,number];
  castShadow?:boolean;
}) {
  if (!asset.uri) return null;
  return <LoadedModel uri={asset.uri} position={position} scale={scale} rotation={rotation} castShadow={castShadow}/>;
}

function LoadedModel({uri,position,scale,rotation,castShadow}:{
  uri:string;position:[number,number,number];scale:[number,number,number];rotation:[number,number,number];castShadow:boolean;
}) {
  const gltf = useLoader(GLTFLoader,uri);
  const model = useMemo(()=>{
    const clone = gltf.scene.clone(true);
    clone.traverse(node=>{
      if (node instanceof THREE.Mesh) {
        node.castShadow = castShadow;
        node.receiveShadow = true;
      }
    });
    return clone;
  },[gltf.scene,castShadow]);
  return <primitive object={model} position={position} scale={scale} rotation={rotation}/>;
}

function SceneProps({props,assets}:{
  props:NonNullable<Scene['props']>;
  assets:LibraryAsset[];
}) {
  return <group>{props.map(prop => {
    const common = { position: prop.position as [number,number,number], scale: prop.scale as [number,number,number], rotation: prop.rotation as [number,number,number] };
    if (prop.type === 'model') {
      const asset = assets.find(item=>item.id===prop.assetId);
      return asset ? <ModelAsset key={prop.id} asset={asset} {...common} castShadow={prop.castShadow}/> : null;
    }
    if (prop.type === 'sphere') return <mesh key={prop.id} {...common} castShadow={prop.castShadow}><sphereGeometry args={[.5,24,16]}/><meshStandardMaterial color={prop.color}/></mesh>;
    if (prop.type === 'cylinder') return <mesh key={prop.id} {...common} castShadow={prop.castShadow}><cylinderGeometry args={[.5,.5,1,20]}/><meshStandardMaterial color={prop.color}/></mesh>;
    if (prop.type === 'plane') return <mesh key={prop.id} {...common} receiveShadow><planeGeometry args={[1,1]}/><meshStandardMaterial color={prop.color}/></mesh>;
    return <mesh key={prop.id} {...common} castShadow={prop.castShadow}><boxGeometry args={[1,1,1]}/><meshStandardMaterial color={prop.color}/></mesh>;
  })}</group>;
}

export const DeclarativeScene: React.FC<{ scene: Scene; production: ProductionSpec }> = ({ scene, production }) => {
  const frame = useCurrentFrame(), { fps } = useVideoConfig();
  const time = frame / fps;
  const characters = useMemo(() => new Map((production.characters ?? []).map(c => [c.id,c])), [production.characters]);
  const environment = production.environments?.find(item => item.id === scene.environmentId);
  const lighting = scene.lighting ?? environment?.lighting;
  const background = lighting?.background ?? environment?.background ?? scene.background;
  const groundColor = environment?.groundColor ?? '#454a52';
  const groundSize = environment?.groundSize ?? 80;
  const fog = environment?.fog;
  const props = [...(environment?.props ?? []), ...(scene.props ?? [])];
  const libraryAssets = production.assets ?? [];
  const environmentModel = environment?.assetId ? libraryAssets.find(asset=>asset.id===environment.assetId) : undefined;
  return <div style={{position:'absolute',inset:0,background}}>
    <Canvas shadows dpr={1} camera={{position:[0,3,9],fov:40}} gl={{antialias:true,alpha:false,powerPreference:'high-performance'}}>
      <color attach="background" args={[background]}/>
      {fog ? <fog attach="fog" args={[fog.color,fog.near,fog.far]}/> : null}
      <ambientLight color={lighting?.ambientColor ?? '#ffffff'} intensity={lighting?.ambientIntensity ?? 1.2}/>
      <directionalLight color={lighting?.keyColor ?? '#ffffff'} intensity={lighting?.keyIntensity ?? 2} position={lighting?.keyPosition ?? [4,8,5]} castShadow/>
      <CameraTrack scene={scene} time={time}/>
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.06,0]} receiveShadow><planeGeometry args={[groundSize,groundSize]}/><meshStandardMaterial color={groundColor}/></mesh>
      {environmentModel ? <ModelAsset asset={environmentModel} position={[0,0,0]} scale={[1,1,1]} rotation={[0,0,0]}/> : null}
      <SceneProps props={props} assets={libraryAssets}/>
      {(scene.actors ?? []).map((actor,index)=><AnimatedActor key={actor.characterId+index} actor={actor} character={characters.get(actor.characterId)} time={time} assets={libraryAssets}/>)}
    </Canvas>
    {scene.onScreenText.map((line,index)=><div key={index} style={{position:'absolute',top:`${14+index*6}%`,left:'50%',transform:'translateX(-50%)',maxWidth:'88%',color:'#fff',fontSize:36,fontWeight:900,textAlign:'center',textShadow:'0 3px 12px #000',fontFamily:'Arial'}}>{line}</div>)}
  </div>;
};
