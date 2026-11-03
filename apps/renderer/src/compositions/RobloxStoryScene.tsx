import React from 'react';
import { Canvas } from '@react-three/fiber';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import * as THREE from 'three';
import type { ProductionSpec } from '@film-studio/contracts';

type Scene = ProductionSpec['scenes'][number];
type ActorKind = 'alex' | 'shadow' | 'resident' | 'double';
const materialCache = new Map<string, THREE.MeshStandardMaterial>();
const material = (color: string, roughness = 0.86) => {
  const key = `${color}:${roughness}`;
  const cached = materialCache.get(key);
  if (cached) return cached;
  const created = new THREE.MeshStandardMaterial({ color, roughness });
  materialCache.set(key, created);
  return created;
};
const windowGlass = new THREE.MeshStandardMaterial({ color: '#6e8da8', roughness: 0.28, transparent: true, opacity: 0.32 });
const hoodie = material('#2369a8');
const black = material('#11151e');
const skin = material('#e9b58d');
const white = material('#f1f2f4');
const hair = material('#101116');
const voidMat = material('#05060a');
const eyes = new THREE.MeshBasicMaterial({ color: '#bceaff' });

function Block({ position, scale, material: mat, rotation = [0, 0, 0], shadowless = false }: {
  position: [number, number, number]; scale: [number, number, number]; material: THREE.Material;
  rotation?: [number, number, number]; shadowless?: boolean;
}) {
  return <mesh position={position} scale={scale} rotation={rotation} castShadow={!shadowless} receiveShadow material={mat} dispose={null}>
    <boxGeometry args={[1, 1, 1]} />
  </mesh>;
}

function ABlock({ shadowless = false, ...props }: { position: [number, number, number]; scale: [number, number, number]; material: THREE.Material; rotation?: [number, number, number]; shadowless?: boolean }) {
  return <Block {...props} shadowless={shadowless} />;
}

function Actor({ frame, fps, kind, sceneIndex, position = [0, 0, 0], scale = 1 }: {
  frame: number; fps: number; kind: ActorKind; sceneIndex: number; position?: [number, number, number]; scale?: number;
}) {
  const t = frame / fps;
  const isShadow = kind === 'shadow';
  const isDouble = kind === 'double';
  const isVoid = isShadow;
  const residentPanics = kind === 'resident' && sceneIndex === 1 && t >= 3.4;
  const walking = sceneIndex === 1 || sceneIndex === 2 || sceneIndex === 4 || (sceneIndex === 7 && kind === 'alex');
  const running = sceneIndex === 4 || (sceneIndex === 7 && kind === 'alex') || residentPanics;
  const stride = Math.sin(t * (running ? 12 : 7) + sceneIndex);
  const idle = Math.sin(t * 2.1) * 0.025;
  const wave = isShadow && (sceneIndex === 0 || sceneIndex === 3 || sceneIndex === 8);
  // In the incident, Alex raises his right arm first. Shadow Alex waits, then
  // performs three complete left-arm waves and finally turns toward him.
  const waveStart = sceneIndex === 3 ? 1.15 : 0.35;
  const waveDuration = 1.8;
  const wavePhase = (t - waveStart) / waveDuration;
  const waveEnvelope = wavePhase >= 0 && wavePhase <= 1 ? Math.sin(Math.PI * wavePhase) ** 2 : 0;
  const waveArm = Math.sin(wavePhase * Math.PI * 6) * 0.62 * waveEnvelope;
  const alexRaise = Math.max(0, Math.min(1, t / 0.72));
  const leftArmRotation: [number, number, number] = wave
    ? [0, 0, wavePhase >= 0 && wavePhase <= 1 ? 2.05 + waveArm : 0.04]
    : [walking ? stride * 0.45 : 0.04, 0, -0.08];
  const dismissGesture = Math.max(0, Math.min(1, (t - 2.15) / 0.35)) * (1 - Math.max(0, Math.min(1, (t - 2.85) / 0.35)));
  const rightArmRotation: [number, number, number] = sceneIndex === 3 && kind === 'alex'
    ? [0, 0, -2.05 * alexRaise]
    : kind === 'alex' && sceneIndex === 2
      ? [0, 0, -0.72 * dismissGesture]
      : [walking ? -stride * 0.45 : -0.04, 0, 0.08];
  const headYaw = isShadow && sceneIndex === 3
    ? Math.max(0, Math.min(1, (t - 3.05) / 0.55)) * 0.72
    : kind === 'resident' && residentPanics ? -0.5
      : kind === 'alex' && sceneIndex === 2
        ? (t >= 1.4 && t <= 2.5 ? -0.42 : t > 2.5 && t < 3.0 ? 0.18 : 0)
        : 0;
  const mouthOpen = kind === 'double' && sceneIndex === 6 ? 0.085
    : kind === 'alex' && (sceneIndex === 3 || sceneIndex === 5 || sceneIndex === 6 || sceneIndex === 7 || sceneIndex === 8)
      ? Math.max(0.035, Math.min(0.12, 0.035 + Math.sin(t * 5) * 0.025 + (sceneIndex === 3 ? alexRaise * 0.045 : 0.025)))
      : 0.035;
  const leg = walking ? stride * (running ? 0.62 : 0.4) : 0.025;
  const torso = isVoid ? voidMat : kind === 'resident' ? material('#64845b') : hoodie;
  const trousers = isVoid ? voidMat : black;
  const face = isVoid ? voidMat : skin;
  const shoe = isVoid ? voidMat : white;
  const ActorBlock = (props: { position: [number, number, number]; scale: [number, number, number]; material: THREE.Material; rotation?: [number, number, number] }) => <ABlock {...props} shadowless={isVoid || isDouble || (kind === 'alex' && sceneIndex === 7)} />;
  const headTilt = isDouble ? Math.sin(t * 1.2) * 0.12 : 0;
  const bodyLean = kind === 'resident' && residentPanics ? 0.16
    : kind === 'alex' && sceneIndex === 5 ? Math.max(0, Math.min(1, (t - 3) / 1.1)) * 0.18 : 0;
  const shadowStretch = isShadow && sceneIndex === 4 ? 1.15 + 0.08 * Math.sin(t * 2.2) ** 2 : 1;
  return <group position={position} scale={[scale * shadowStretch, scale, scale]} rotation={[0, sceneIndex === 8 && kind === 'alex' ? Math.PI : 0.08, bodyLean]}>
    <group position={[0, 1.12 + idle, 0]}>
      <ActorBlock position={[0, 0, 0]} scale={[0.72, 0.82, 0.38]} material={torso} />
      <ActorBlock position={[0, 0.72, 0]} scale={[0.57, 0.57, 0.52]} material={face} rotation={[headTilt, headYaw, headTilt]} />
      {!isVoid && <>
        <ActorBlock position={[0, 1.02, -0.02]} scale={[0.63, 0.16, 0.62]} material={hair} />
        <ActorBlock position={[-0.22, 1.08, 0.02]} scale={[0.2, 0.19, 0.52]} material={hair} rotation={[0, 0, -0.22]} />
        <ActorBlock position={[0.12, 1.1, -0.03]} scale={[0.22, 0.2, 0.5]} material={hair} rotation={[0, 0, 0.25]} />
        <ActorBlock position={[-0.14, 0.78, 0.268]} scale={[0.055, 0.075, 0.018]} material={black} />
        <ActorBlock position={[0.14, 0.78, 0.268]} scale={[0.055, 0.075, 0.018]} material={black} />
        <ActorBlock position={[0, 0.59, 0.27]} scale={[0.16, mouthOpen, 0.02]} material={material('#914d43')} />
        <ActorBlock position={[0, 0.22, -0.25]} scale={[0.42, 0.44, 0.18]} material={hoodie} />
      </>}
      {isShadow && <>
        <ActorBlock position={[-0.14, 0.08, 0.266]} scale={[0.12, 0.045, 0.02]} material={eyes} />
        <ActorBlock position={[0.14, 0.08, 0.266]} scale={[0.12, 0.045, 0.02]} material={eyes} />
      </>}
      {kind === 'alex' && sceneIndex === 2 && <group position={[-0.5, -0.35, 0.34]} rotation={[0.15, 0, -0.18]}>
        <ActorBlock position={[0, 0, 0]} scale={[0.2, 0.34, 0.045]} material={black} />
        <ActorBlock position={[0, 0.015, 0.026]} scale={[0.16, 0.27, 0.008]} material={material('#78a9c8')} />
        <ActorBlock position={[0, -0.13, 0.032]} scale={[0.035, 0.018, 0.008]} material={white} />
      </group>}
      <group position={[-0.47, 0.23, 0]} rotation={leftArmRotation}>
        <ActorBlock position={[0, -0.32, 0]} scale={[0.24, 0.72, 0.27]} material={torso} />
        <ActorBlock position={[0, -0.72, 0]} scale={[0.23, 0.2, 0.25]} material={face} />
      </group>
      <group position={[0.47, 0.23, 0]} rotation={rightArmRotation}>
        <ActorBlock position={[0, -0.32, 0]} scale={[0.24, 0.72, 0.27]} material={torso} />
        <ActorBlock position={[0, -0.72, 0]} scale={[0.23, 0.2, 0.25]} material={face} />
      </group>
      <group position={[-0.19, -0.46, 0]} rotation={[leg, 0, 0]}>
        <ActorBlock position={[0, -0.37, 0]} scale={[0.29, 0.78, 0.32]} material={trousers} />
        <ActorBlock position={[0, -0.79, 0.08]} scale={[0.32, 0.18, 0.48]} material={shoe} />
      </group>
      <group position={[0.19, -0.46, 0]} rotation={[-leg, 0, 0]}>
        <ActorBlock position={[0, -0.37, 0]} scale={[0.29, 0.78, 0.32]} material={trousers} />
        <ActorBlock position={[0, -0.79, 0.08]} scale={[0.32, 0.18, 0.48]} material={shoe} />
      </group>
    </group>
  </group>;
}

function Town({ night = true, frame, fps, sceneIndex }: { night?: boolean; frame: number; fps: number; sceneIndex: number }) {
  const house = material(night ? '#33415b' : '#e8c9a0');
  const road = material(night ? '#202735' : '#6d747b');
  const seconds = frame / fps;
  const doorOpen = Math.max(0, Math.min(1, (seconds - 5.5) / 0.6));
  const doorClose = Math.max(0, Math.min(1, (seconds - 6.4) / 0.25));
  const alexHouseDoorAngle = sceneIndex === 4 ? -1.05 * doorOpen * (1 - doorClose) : 0;
  return <group>
    <ABlock position={[0, -0.18, 0]} scale={[18, 0.35, 10]} material={road} />
    {[-6, -3, 3, 6].map((x, i) => <group key={x} position={[x, 0, -4.1]}>
      <ABlock position={[0, 1.1, 0]} scale={[2.2, 2.2, 1.7]} material={house} />
      <ABlock position={[0, 2.55, 0]} scale={[2.5, 0.75, 1.9]} material={material(night ? '#171d2c' : '#a65e4d')} />
      <group position={[-0.24, 0.7, 0.88]} rotation={[0, x === -3 ? alexHouseDoorAngle : 0, 0]}>
        <ABlock position={[0.24, 0, 0]} scale={[0.48, 1.2, 0.08]} material={material('#453a3a')} />
      </group>
      <ABlock position={[-0.62, 1.45, 0.89]} scale={[0.35, 0.45, 0.08]} material={material('#92b8d0')} />
    </group>)}
    <ABlock position={[-0.8, 2.3, 0.2]} scale={[0.12, 4.6, 0.12]} material={material('#242a34')} />
    <mesh position={[-0.8, 4.55, 0.2]}><sphereGeometry args={[0.24, 16, 16]} /><meshBasicMaterial color="#ffd58a" /></mesh>
    {/* A readable 9 PM street clock, placed in the town establishing-shot sightline. */}
    <ABlock position={[3.45, 2.65, -1.55]} scale={[0.14, 3.2, 0.14]} material={material('#242a34')} />
    <mesh position={[3.45, 3.65, -1.48]} rotation={[0, 0, 0]}>
      <cylinderGeometry args={[0.48, 0.48, 0.12, 24]} />
      <meshStandardMaterial color="#e8e4d8" />
    </mesh>
    <mesh position={[3.45, 3.65, -1.405]}>
      <circleGeometry args={[0.4, 24]} />
      <meshBasicMaterial color="#f4ead1" />
    </mesh>
    <mesh position={[3.45, 3.82, -1.38]} rotation={[0, 0, -Math.PI / 2]}>
      <boxGeometry args={[0.3, 0.035, 0.018]} />
      <meshBasicMaterial color="#171923" />
    </mesh>
    <mesh position={[3.34, 3.65, -1.375]}>
      <boxGeometry args={[0.23, 0.028, 0.018]} />
      <meshBasicMaterial color="#171923" />
    </mesh>
    {/* Warning sign: yellow board and dark warning mark, visible from the street. */}
    <ABlock position={[-1.8, 0.95, 1.35]} scale={[0.1, 1.9, 0.1]} material={material('#34343a')} />
    <ABlock position={[-1.8, 1.85, 1.35]} scale={[1.05, 0.82, 0.12]} material={material('#e5b83f')} />
    <ABlock position={[-1.8, 1.88, 1.425]} scale={[0.12, 0.43, 0.025]} material={material('#24232a')} />
    <mesh position={[-1.8, 1.58, 1.445]}><sphereGeometry args={[0.055, 12, 12]} /><meshBasicMaterial color="#24232a" /></mesh>
    {/* Upstairs window: a fixed landmark for the final shadow reveal. */}
    <ABlock position={[-3, 2.15, -3.18]} scale={[1.35, 1.35, 0.1]} material={material('#111827')} />
    <ABlock position={[-3, 2.15, -3.105]} scale={[1.16, 1.16, 0.035]} material={windowGlass} shadowless />
    {[-3.58, -3, -2.42].map((x) => <ABlock key={x} position={[x, 2.15, -3.06]} scale={[0.055, 1.28, 0.06]} material={material('#d2c4aa')} />)}
    {[1.57, 2.15, 2.73].map((y) => <ABlock key={y} position={[-3, y, -3.06]} scale={[1.22, 0.055, 0.06]} material={material('#d2c4aa')} />)}
  </group>;
}

function Bedroom({ frame, fps, blackout = false }: { frame: number; fps: number; blackout?: boolean }) {
  const seconds = frame / fps;
  const doorOpen = Math.max(0, Math.min(1, (seconds - 0.25) / 1.15));
  const flicker = blackout && seconds > 6 ? (Math.sin(frame * 2.4) > 0.2 ? 0.05 : 0.8) : 1;
  return <group>
    <ABlock position={[0, -0.16, 0]} scale={[12, 0.3, 8]} material={material('#343747')} />
    <ABlock position={[0, 2.4, -3.7]} scale={[12, 5, 0.25]} material={material('#202638')} />
    <ABlock position={[-3, 2.15, -3.48]} scale={[1.35, 1.35, 0.08]} material={material('#5b83a5', 0.35)} />
    {[-3.58, -3, -2.42].map((x) => <ABlock key={x} position={[x, 2.15, -3.35]} scale={[0.055, 1.28, 0.06]} material={material('#d2c4aa')} />)}
    {[1.57, 2.15, 2.73].map((y) => <ABlock key={y} position={[-3, y, -3.35]} scale={[1.22, 0.055, 0.06]} material={material('#d2c4aa')} />)}
    <ABlock position={[2.3, 0.18, -1.8]} scale={[3.3, 0.45, 2.2]} material={material('#725f66')} />
    <ABlock position={[2.3, 0.48, -1.8]} scale={[3.25, 0.25, 2.1]} material={material('#a8b3c7')} />
    <ABlock position={[1.5, 0.7, -2.35]} scale={[0.95, 0.28, 0.5]} material={material('#e4d9c7')} />
    {/* Doorway silhouette gives the duplicate a clear entrance position. */}
    <ABlock position={[-2.45, 1.35, -3.48]} scale={[0.14, 2.7, 0.16]} material={material('#51434a')} />
    <ABlock position={[-0.95, 1.35, -3.48]} scale={[0.14, 2.7, 0.16]} material={material('#51434a')} />
    <ABlock position={[-1.7, 2.72, -3.48]} scale={[1.65, 0.14, 0.16]} material={material('#51434a')} />
    <group position={[-2.45, 1.35, -3.42]} rotation={[0, -doorOpen * 1.15, 0]}>
      <ABlock position={[0.72, 0, 0]} scale={[1.42, 2.5, 0.06]} material={material('#171d2b')} shadowless />
      <ABlock position={[1.22, 0, 0.05]} scale={[0.055, 0.09, 0.035]} material={material('#d2b16d')} shadowless />
    </group>
    <pointLight position={[0, 3.8, 0]} intensity={blackout ? flicker : 1.5} color="#f4d9ad" distance={9} />
  </group>;
}

function World({ scene, sceneIndex, frame, fps }: { scene: Scene; sceneIndex: number; frame: number; fps: number }) {
  const isMorning = sceneIndex === 7;
  const isBedroom = sceneIndex === 5 || sceneIndex === 6;
  const isBlackout = sceneIndex === 6;
  const night = sceneIndex !== 7;
  const inTown = !isBedroom;
  const shadowWave = sceneIndex === 0 || sceneIndex === 3;
  const alexPosition: [number, number, number] = sceneIndex === 8 ? [-2.2, 0, 1.2]
    : sceneIndex === 7 ? [-2.8 + Math.min(1, (frame / fps) / 2.2) * 2.0, 0, 0.2]
    : sceneIndex === 4 ? [-0.8 - (frame / fps) * 0.28, 0, 0.2 - (frame / fps) * 0.5]
    : sceneIndex === 2 ? [-0.4 - (frame / fps) * 0.22, 0, 0.2]
    : sceneIndex === 5 ? [-0.8 + Math.max(0, Math.min(1, (frame / fps - 3) / 1.1)) * 0.45, 0, 0.2]
    : [-0.8, 0, 0.2];
  return <>
    <color attach="background" args={[scene.background]} />
    <fog attach="fog" args={[scene.background, 9, 22]} />
    <ambientLight intensity={isMorning ? 1.35 : isBlackout && frame / fps > 8 ? 0.06 : 0.72} />
    <directionalLight position={[-4, 8, 5]} intensity={isMorning ? 2.5 : isBlackout && frame / fps > 8 ? 0.05 : 1.7} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
    <pointLight position={[-0.8, 4.4, 0.2]} color="#ffd58a" intensity={night ? 2.2 : 0.2} distance={10} />
    {inTown ? <Town night={night} frame={frame} fps={fps} sceneIndex={sceneIndex} /> : <Bedroom frame={frame} fps={fps} blackout={isBlackout} />}
    {(sceneIndex === 1 || sceneIndex === 7) && [-1.2, 0, 1.2].map((x, i) => {
      const residentRun = sceneIndex === 1 && i === 2 && frame / fps > 3.4;
      const travel = Math.max(0, frame / fps - 3.4);
      const residentPosition: [number, number, number] = [
        x + (sceneIndex === 1 ? frame / fps * 0.12 + (residentRun ? travel * 0.55 : 0) : 0),
        0,
        (i === 1 ? 1.2 : 0.8) - (residentRun ? travel * 1.2 : 0)
      ];
      return <Actor key={i} frame={frame + i * 7} fps={fps} kind="resident" sceneIndex={sceneIndex} position={residentPosition} />;
    })}
    {sceneIndex !== 1 && <Actor frame={frame} fps={fps} kind="alex" sceneIndex={sceneIndex} position={alexPosition} />}
    {(shadowWave || sceneIndex === 4) && <Actor frame={frame} fps={fps} kind="shadow" sceneIndex={sceneIndex}
      position={sceneIndex === 4 ? [0.95 - (frame / fps) * 0.65, 0, -0.1 - (frame / fps) * 0.52] : [0.95, 0, -0.1]} />}
    {sceneIndex === 8 && <Actor frame={frame} fps={fps} kind="shadow" sceneIndex={8} position={[-3, 1.67, -3.45]} scale={0.5} />}
    {sceneIndex === 5 && <Actor frame={frame} fps={fps} kind="double" sceneIndex={5} position={[-1.7 + Math.min(1, Math.max(0, (frame / fps - 1.2) / 2.2)) * 0.45, 0, -3.05]} />}
    {sceneIndex === 6 && <Actor frame={frame} fps={fps} kind="double" sceneIndex={6} position={[-1.25, 0, -3.05]} />}
  </>;
}

export const RobloxStoryScene: React.FC<{ scene: Scene; sceneIndex: number }> = ({ scene, sceneIndex }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const scale = width / 360;
  const push = Math.min(1, frame / Math.max(1, fps * 2));
  const cameraPosition: [number, number, number] = sceneIndex === 0 ? [0, 5.5 - push * 2.8, 11 - push * 2.1]
    : sceneIndex === 3 ? [0, 2.6, 9.5 - push * 2.1]
    : sceneIndex === 4 ? [-0.2 - (frame / fps) * 0.12, 2.5, 9 - (frame / fps) * 0.45]
    : sceneIndex === 5 || sceneIndex === 6 ? [0, 2.2, 8.2 - push * 0.8]
    : sceneIndex === 7 ? [0, 2.2 + Math.min(1, frame / Math.max(1, fps * 5)) * 1.4, 9.5]
    : sceneIndex === 8 ? [-2.2, 2.7, 6.1] : [0, 2.6, 9.5];
  const blackout = sceneIndex === 6 && frame / fps > 10.4;
  const finalCut = sceneIndex === 8 && frame / fps > 3.65;
  const hideScene = blackout || finalCut;
  return <div style={{ position: 'absolute', inset: 0, background: hideScene ? '#000' : undefined }}>
    {!hideScene && <Canvas shadows dpr={1} camera={{ position: cameraPosition, fov: sceneIndex === 8 ? 29 : 34 }}
      onCreated={({ camera }) => { if (sceneIndex === 8) camera.lookAt(-3, 2.1, -3.12); }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}>
      <World scene={scene} sceneIndex={sceneIndex} frame={frame} fps={fps} />
    </Canvas>}
    {blackout && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28, opacity: Math.max(0, 1 - (frame / fps - 10.4) / 0.85) }}>
      {[0, 1].map((eye) => <div key={eye} style={{ width: 12 * scale, height: 7 * scale, borderRadius: '50%', background: '#bceaff', boxShadow: '0 0 18px 7px rgba(188,234,255,.75)' }} />)}
    </div>}
    {scene.onScreenText?.map((line, index) => !hideScene && <div key={index} style={{
      position: 'absolute', top: `${15 + index * 5}%`, left: '50%', transform: 'translateX(-50%)',
      maxWidth: '88%', padding: `${6 * scale}px ${12 * scale}px`,
      color: sceneIndex === 0 ? '#fff3d6' : '#ffffff',
      background: sceneIndex === 0 ? 'rgba(10,14,24,.48)' : 'rgba(10,14,24,.58)',
      borderRadius: 6 * scale, fontFamily: 'Arial', fontSize: (sceneIndex === 0 ? 23 : 18) * scale,
      fontWeight: 900, letterSpacing: 1.4 * scale, textAlign: 'center',
      textShadow: '0 2px 8px rgba(0,0,0,.9)', whiteSpace: 'nowrap'
    }}>{line}</div>)}
    {sceneIndex === 1 && !hideScene && <div style={{ position: 'absolute', top: '16%', right: '7%', padding: `${8 * scale}px ${12 * scale}px`, border: `${2 * scale}px solid rgba(255,230,180,.8)`, borderRadius: 8 * scale, background: 'rgba(12,16,25,.82)', color: '#fff0c9', fontFamily: 'Arial', fontWeight: 900, fontSize: 23 * scale, letterSpacing: 1.5 * scale, boxShadow: '0 0 18px rgba(255,210,130,.25)' }}>
      9:00 PM
    </div>}
    {!hideScene && <div style={{ position: 'absolute', top: '5%', left: '6%', color: 'rgba(255,255,255,.58)', fontFamily: 'Arial', fontSize: 18 * scale, letterSpacing: 5 * scale }}>
      TOWNTALES  /  {String(sceneIndex + 1).padStart(2, '0')}
    </div>}
  </div>;
};
