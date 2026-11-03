import React from 'react';
import { Canvas } from '@react-three/fiber';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import * as THREE from 'three';
import type { ProductionSpec } from '@film-studio/contracts';

type Scene = ProductionSpec['scenes'][number];

const mat = (color: string, roughness = 0.82) => new THREE.MeshStandardMaterial({ color, roughness });
const skin = mat('#f0bd91');
const shirt = mat('#2467a5');
const pants = mat('#263449');
const shoe = mat('#151a22');
const shadowMat = new THREE.MeshStandardMaterial({ color: '#070910', roughness: 1 });
const eyeMat = new THREE.MeshBasicMaterial({ color: '#b8eaff' });

function Block({ position, scale, material, rotation = [0, 0, 0] }: {
  position: [number, number, number]; scale: [number, number, number]; material: THREE.Material;
  rotation?: [number, number, number];
}) {
  return <mesh position={position} scale={scale} rotation={rotation} castShadow receiveShadow material={material}>
    <boxGeometry args={[1, 1, 1]} />
  </mesh>;
}

function Character({ frame, fps, shadow = false, sceneIndex = 0 }: {
  frame: number; fps: number; shadow?: boolean; sceneIndex?: number;
}) {
  const t = frame / fps;
  const stride = Math.sin(t * 7 + sceneIndex * 0.8);
  const idle = Math.sin(t * 2.1 + (shadow ? 1.1 : 0));
  const isShadow = shadow;
  const body = isShadow ? shadowMat : shirt;
  const limb = isShadow ? shadowMat : pants;
  const face = isShadow ? shadowMat : skin;
  const walk = sceneIndex % 3 === 1;
  const armSwing = walk ? stride * 0.55 : Math.sin(t * 2.4) * 0.09;
  const legSwing = walk ? stride * 0.48 : Math.sin(t * 2.4 + 1) * 0.035;
  return <group position={[shadow ? 1.55 : -0.8, 0, shadow ? -0.5 : 0.2]} rotation={[0, shadow ? -0.18 : 0.12, 0]}>
    <group position={[0, 1.15 + idle * 0.025, 0]}>
      <Block position={[0, 0, 0]} scale={[0.72, 0.82, 0.38]} material={body} />
      <Block position={[0, 0.72, 0]} scale={[0.57, 0.57, 0.52]} material={face} />
      {!isShadow && <>
        <Block position={[-0.14, 0.78, 0.268]} scale={[0.055, 0.075, 0.018]} material={shoe} />
        <Block position={[0.14, 0.78, 0.268]} scale={[0.055, 0.075, 0.018]} material={shoe} />
        <Block position={[0, 0.59, 0.27]} scale={[0.16, 0.035, 0.02]} material={mat('#8f4c42')} />
        <Block position={[0, 1.02, 0]} scale={[0.63, 0.12, 0.58]} material={mat('#18202c')} />
      </>}
      {isShadow && <>
        <Block position={[-0.14, 0.08, 0.266]} scale={[0.12, 0.045, 0.02]} material={eyeMat} />
        <Block position={[0.14, 0.08, 0.266]} scale={[0.12, 0.045, 0.02]} material={eyeMat} />
      </>}
      <group position={[-0.47, 0.23, 0]} rotation={[armSwing, 0, -0.08]}>
        <Block position={[0, -0.32, 0]} scale={[0.24, 0.72, 0.27]} material={body} />
        <Block position={[0, -0.72, 0]} scale={[0.23, 0.2, 0.25]} material={face} />
      </group>
      <group position={[0.47, 0.23, 0]} rotation={[-armSwing, 0, 0.08]}>
        <Block position={[0, -0.32, 0]} scale={[0.24, 0.72, 0.27]} material={body} />
        <Block position={[0, -0.72, 0]} scale={[0.23, 0.2, 0.25]} material={face} />
      </group>
      <group position={[-0.19, -0.46, 0]} rotation={[legSwing, 0, 0]}>
        <Block position={[0, -0.37, 0]} scale={[0.29, 0.78, 0.32]} material={limb} />
        <Block position={[0, -0.79, 0.08]} scale={[0.32, 0.18, 0.48]} material={shoe} />
      </group>
      <group position={[0.19, -0.46, 0]} rotation={[-legSwing, 0, 0]}>
        <Block position={[0, -0.37, 0]} scale={[0.29, 0.78, 0.32]} material={limb} />
        <Block position={[0, -0.79, 0.08]} scale={[0.32, 0.18, 0.48]} material={shoe} />
      </group>
    </group>
  </group>;
}

function Bedroom({ frame, fps }: { frame: number; fps: number }) {
  const pulse = 0.72 + Math.sin(frame / fps * 1.8) * 0.08;
  return <group>
    <Block position={[0, -0.16, 0]} scale={[12, 0.3, 8]} material={mat('#343747')} />
    <Block position={[0, 2.4, -3.7]} scale={[12, 5, 0.25]} material={mat('#202638')} />
    <Block position={[-3.4, 1.3, -3.48]} scale={[2.3, 2.1, 0.08]} material={mat('#5b83a5', 0.35)} />
    <Block position={[-3.4, 1.3, -3.4]} scale={[0.08, 2.2, 0.12]} material={mat('#111827')} />
    <Block position={[-3.4, 1.3, -3.4]} scale={[2.4, 0.08, 0.12]} material={mat('#111827')} />
    <Block position={[2.3, 0.18, -1.8]} scale={[3.3, 0.45, 2.2]} material={mat('#725f66')} />
    <Block position={[2.3, 0.48, -1.8]} scale={[3.25, 0.25, 2.1]} material={mat('#a8b3c7')} />
    <Block position={[1.5, 0.7, -2.35]} scale={[0.95, 0.28, 0.5]} material={mat('#e4d9c7')} />
    <Block position={[4.1, 1.25, -2.6]} scale={[0.12, 2.1, 0.12]} material={mat('#513f36')} />
    <mesh position={[4.1, 2.35, -2.6]} scale={[pulse, pulse, pulse]} material={mat('#f5c77b', 0.4)}>
      <sphereGeometry args={[0.42, 20, 20]} />
    </mesh>
  </group>;
}

function Atmosphere({ frame }: { frame: number }) {
  return <group>
    {Array.from({ length: 18 }, (_, i) => {
      const x = Math.sin(i * 12.9) * 4.6;
      const y = 0.5 + ((i * 0.61 + frame * 0.003) % 4.2);
      const z = -1.8 + Math.cos(i * 4.7) * 1.8;
      return <mesh key={i} position={[x, y, z]}>
        <sphereGeometry args={[0.018 + (i % 3) * 0.008, 8, 8]} />
        <meshBasicMaterial color="#c5d8ff" transparent opacity={0.35} />
      </mesh>;
    })}
  </group>;
}

function World({ scene, sceneIndex, frame, fps }: { scene: Scene; sceneIndex: number; frame: number; fps: number }) {
  const bedroom = /bed|bedroom|sleep|wake|room|morning|5\s?a\.m/i.test(scene.title + ' ' + scene.visualDirection);
  return <>
    <color attach="background" args={[scene.background]} />
    <fog attach="fog" args={[scene.background, 8, 19]} />
    <ambientLight intensity={0.75} />
    <directionalLight position={[-4, 8, 5]} intensity={2.1} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
    <pointLight position={[2.8, 3.5, -1]} color="#8caeff" intensity={1.3} distance={9} />
    {bedroom ? <Bedroom frame={frame} fps={fps} /> : <Block position={[0, -0.16, 0]} scale={[12, 0.3, 8]} material={mat('#252d40')} />}
    <Character frame={frame} fps={fps} sceneIndex={sceneIndex} />
    {sceneIndex > 0 && <Character frame={frame} fps={fps} sceneIndex={sceneIndex} shadow />}
    <Atmosphere frame={frame} />
  </>;
}

export const RobloxStoryScene: React.FC<{ scene: Scene; sceneIndex: number }> = ({ scene, sceneIndex }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return <div style={{ position: 'absolute', inset: 0 }}>
    <Canvas shadows dpr={1} camera={{ position: [0, 2.5, 9.5], fov: 34 }} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}>
      <World scene={scene} sceneIndex={sceneIndex} frame={frame} fps={fps} />
    </Canvas>
    <div style={{ position: 'absolute', top: '5%', left: '6%', color: 'rgba(255,255,255,.58)', fontFamily: 'Arial', fontSize: 18, letterSpacing: 5 }}>
      TOWNTALES  /  {String(sceneIndex + 1).padStart(2, '0')}
    </div>
  </div>;
};
