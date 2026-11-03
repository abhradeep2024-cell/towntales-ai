import React from 'react';
import { Canvas } from '@react-three/fiber';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import * as THREE from 'three';
import type { ProductionSpec } from '@film-studio/contracts';

type Scene = ProductionSpec['scenes'][number];
type ActorKind = 'alex' | 'shadow' | 'resident' | 'double';
const material = (color: string, roughness = 0.86) => new THREE.MeshStandardMaterial({ color, roughness });
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
  return <mesh position={position} scale={scale} rotation={rotation} castShadow={!shadowless} receiveShadow material={mat}>
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
  const walking = sceneIndex === 1 || sceneIndex === 2 || sceneIndex === 4 || sceneIndex === 7;
  const running = sceneIndex === 4;
  const stride = Math.sin(t * (running ? 12 : 7) + sceneIndex);
  const idle = Math.sin(t * 2.1) * 0.025;
  const wave = isShadow && (sceneIndex === 0 || sceneIndex === 3 || sceneIndex === 8);
  // Three deliberate, finite wave cycles; the envelope eases the arm in and out.
  const waveStart = 0.35;
  const waveDuration = 1.8;
  const wavePhase = (t - waveStart) / waveDuration;
  const waveEnvelope = wavePhase >= 0 && wavePhase <= 1 ? Math.sin(Math.PI * wavePhase) ** 2 : 0;
  const waveArm = Math.sin(wavePhase * Math.PI * 6) * 0.62 * waveEnvelope;
  const armLeft = wave ? waveArm : (walking ? stride * 0.45 : 0.04);
  const armRight = sceneIndex === 3 && kind === 'alex' ? -1.05 : (walking ? -stride * 0.45 : -0.04);
  const leg = walking ? stride * (running ? 0.62 : 0.4) : 0.025;
  const torso = isVoid ? voidMat : kind === 'resident' ? material('#64845b') : hoodie;
  const trousers = isVoid ? voidMat : black;
  const face = isVoid ? voidMat : skin;
  const shoe = isVoid ? voidMat : white;
  const ActorBlock = (props: { position: [number, number, number]; scale: [number, number, number]; material: THREE.Material; rotation?: [number, number, number] }) => <ABlock {...props} shadowless={isVoid || isDouble || (kind === 'alex' && sceneIndex === 7)} />;
  const headTilt = isDouble ? Math.sin(t * 1.2) * 0.12 : 0;
  return <group position={position} scale={scale} rotation={[0, sceneIndex === 8 ? -0.35 : 0.08, 0]}>
    <group position={[0, 1.12 + idle, 0]}>
      <ActorBlock position={[0, 0, 0]} scale={[0.72, 0.82, 0.38]} material={torso} />
      <ActorBlock position={[0, 0.72, 0]} scale={[0.57, 0.57, 0.52]} material={face} rotation={[headTilt, 0, headTilt]} />
      {!isVoid && <>
        <ActorBlock position={[0, 1.02, -0.02]} scale={[0.63, 0.16, 0.62]} material={hair} />
        <ActorBlock position={[-0.22, 1.08, 0.02]} scale={[0.2, 0.19, 0.52]} material={hair} rotation={[0, 0, -0.22]} />
        <ActorBlock position={[0.12, 1.1, -0.03]} scale={[0.22, 0.2, 0.5]} material={hair} rotation={[0, 0, 0.25]} />
        <ActorBlock position={[-0.14, 0.78, 0.268]} scale={[0.055, 0.075, 0.018]} material={black} />
        <ActorBlock position={[0.14, 0.78, 0.268]} scale={[0.055, 0.075, 0.018]} material={black} />
        <ActorBlock position={[0, 0.59, 0.27]} scale={[0.16, 0.035, 0.02]} material={material('#914d43')} />
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
      <group position={[-0.47, 0.23, 0]} rotation={[armLeft, 0, -0.08]}>
        <ActorBlock position={[0, -0.32, 0]} scale={[0.24, 0.72, 0.27]} material={torso} />
        <ActorBlock position={[0, -0.72, 0]} scale={[0.23, 0.2, 0.25]} material={face} />
      </group>
      <group position={[0.47, 0.23, 0]} rotation={[armRight, 0, 0.08]}>
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

function Town({ night = true }: { night?: boolean }) {
  const house = material(night ? '#33415b' : '#e8c9a0');
  const road = material(night ? '#202735' : '#6d747b');
  return <group>
    <ABlock position={[0, -0.18, 0]} scale={[18, 0.35, 10]} material={road} />
    {[-6, -3, 3, 6].map((x, i) => <group key={x} position={[x, 0, -4.1]}>
      <ABlock position={[0, 1.1, 0]} scale={[2.2, 2.2, 1.7]} material={house} />
      <ABlock position={[0, 2.55, 0]} scale={[2.5, 0.75, 1.9]} material={material(night ? '#171d2c' : '#a65e4d')} />
      <ABlock position={[0, 0.7, 0.88]} scale={[0.48, 1.2, 0.08]} material={material('#453a3a')} />
      <ABlock position={[-0.62, 1.45, 0.89]} scale={[0.35, 0.45, 0.08]} material={material('#92b8d0')} />
    </group>)}
    <ABlock position={[-3.7, 2.3, -1.4]} scale={[0.12, 4.6, 0.12]} material={material('#242a34')} />
    <mesh position={[-3.7, 4.55, -1.4]}><sphereGeometry args={[0.24, 16, 16]} /><meshBasicMaterial color="#ffd58a" /></mesh>
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
    <mesh position={[3.56, 3.65, -1.375]} rotation={[0, 0, -Math.PI / 3]}>
      <boxGeometry args={[0.23, 0.028, 0.018]} />
      <meshBasicMaterial color="#171923" />
    </mesh>
    {/* Warning sign: yellow board and dark warning mark, visible from the street. */}
    <ABlock position={[-4.1, 0.95, 1.35]} scale={[0.1, 1.9, 0.1]} material={material('#34343a')} />
    <ABlock position={[-4.1, 1.85, 1.35]} scale={[1.05, 0.82, 0.12]} material={material('#e5b83f')} />
    <ABlock position={[-4.1, 1.88, 1.425]} scale={[0.12, 0.43, 0.025]} material={material('#24232a')} />
    <mesh position={[-4.1, 1.58, 1.445]}><sphereGeometry args={[0.055, 12, 12]} /><meshBasicMaterial color="#24232a" /></mesh>
    {/* Upstairs window: a fixed landmark for the final shadow reveal. */}
    <ABlock position={[-3, 2.15, -3.18]} scale={[1.35, 1.35, 0.1]} material={material('#111827')} />
    <ABlock position={[-3, 2.15, -3.105]} scale={[1.16, 1.16, 0.035]} material={new THREE.MeshStandardMaterial({ color: '#6e8da8', roughness: 0.28, transparent: true, opacity: 0.32 })} shadowless />
    {[-3.58, -3, -2.42].map((x) => <ABlock key={x} position={[x, 2.15, -3.06]} scale={[0.055, 1.28, 0.06]} material={material('#d2c4aa')} />)}
    {[1.57, 2.15, 2.73].map((y) => <ABlock key={y} position={[-3, y, -3.06]} scale={[1.22, 0.055, 0.06]} material={material('#d2c4aa')} />)}
  </group>;
}

function Bedroom({ frame, fps, blackout = false }: { frame: number; fps: number; blackout?: boolean }) {
  const flicker = blackout && frame / fps > 6 ? (Math.sin(frame * 2.4) > 0.2 ? 0.05 : 0.8) : 1;
  return <group>
    <ABlock position={[0, -0.16, 0]} scale={[12, 0.3, 8]} material={material('#343747')} />
    <ABlock position={[0, 2.4, -3.7]} scale={[12, 5, 0.25]} material={material('#202638')} />
    <ABlock position={[-3.4, 1.3, -3.48]} scale={[2.3, 2.1, 0.08]} material={material('#5b83a5', 0.35)} />
    <ABlock position={[-3.4, 1.3, -3.4]} scale={[0.08, 2.2, 0.12]} material={material('#111827')} />
    <ABlock position={[2.3, 0.18, -1.8]} scale={[3.3, 0.45, 2.2]} material={material('#725f66')} />
    <ABlock position={[2.3, 0.48, -1.8]} scale={[3.25, 0.25, 2.1]} material={material('#a8b3c7')} />
    <ABlock position={[1.5, 0.7, -2.35]} scale={[0.95, 0.28, 0.5]} material={material('#e4d9c7')} />
    {/* Doorway silhouette gives the duplicate a clear entrance position. */}
    <ABlock position={[-2.45, 1.35, -3.48]} scale={[0.14, 2.7, 0.16]} material={material('#51434a')} />
    <ABlock position={[-0.95, 1.35, -3.48]} scale={[0.14, 2.7, 0.16]} material={material('#51434a')} />
    <ABlock position={[-1.7, 2.72, -3.48]} scale={[1.65, 0.14, 0.16]} material={material('#51434a')} />
    <ABlock position={[-1.7, 1.35, -3.42]} scale={[1.25, 2.5, 0.035]} material={material('#171d2b')} shadowless />
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
  const alexPosition: [number, number, number] = sceneIndex === 8 ? [-2.2, 0, 1.2] : [sceneIndex === 4 ? -1.5 + (frame / fps) * 0.2 : -0.8, 0, 0.2];
  return <>
    <color attach="background" args={[scene.background]} />
    <fog attach="fog" args={[scene.background, 9, 22]} />
    <ambientLight intensity={isMorning ? 1.35 : isBlackout && frame / fps > 8 ? 0.06 : 0.72} />
    <directionalLight position={[-4, 8, 5]} intensity={isMorning ? 2.5 : 1.7} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
    <pointLight position={[-3.7, 4.4, -1.4]} color="#ffd58a" intensity={night ? 2.2 : 0.2} distance={10} />
    {inTown ? <Town night={night} /> : <Bedroom frame={frame} fps={fps} blackout={isBlackout} />}
    {(sceneIndex === 1 || sceneIndex === 7) && [-3.6, 0, 3.5].map((x, i) => <Actor key={i} frame={frame + i * 7} fps={fps} kind="resident" sceneIndex={1} position={[x, 0, i === 1 ? 1.2 : 0.8]} />)}
    {sceneIndex !== 1 && <Actor frame={frame} fps={fps} kind="alex" sceneIndex={sceneIndex} position={alexPosition} />}
    {(shadowWave || sceneIndex === 4) && <Actor frame={frame} fps={fps} kind="shadow" sceneIndex={sceneIndex} position={[0.95, 0, -0.1]} />}
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
  const cameraPosition: [number, number, number] = sceneIndex === 0 ? [0, 3.5 - push * 1.1, 11 - push * 2.1]
    : sceneIndex === 4 ? [0, 2.5, 9 - push * 1.3]
    : sceneIndex === 5 || sceneIndex === 6 ? [0, 2.2, 8.2 - push * 0.8]
    : sceneIndex === 8 ? [0, 2.4, 10 - push * 1.4] : [0, 2.6, 9.5];
  const blackout = sceneIndex === 6 && frame / fps > 10.4;
  return <div style={{ position: 'absolute', inset: 0, background: blackout ? '#000' : undefined }}>
    {!blackout && <Canvas shadows dpr={1} camera={{ position: cameraPosition, fov: 34 }} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}>
      <World scene={scene} sceneIndex={sceneIndex} frame={frame} fps={fps} />
    </Canvas>}
    <div style={{ position: 'absolute', top: '5%', left: '6%', color: 'rgba(255,255,255,.58)', fontFamily: 'Arial', fontSize: 18 * scale, letterSpacing: 5 * scale }}>
      TOWNTALES  /  {String(sceneIndex + 1).padStart(2, '0')}
    </div>
  </div>;
};
