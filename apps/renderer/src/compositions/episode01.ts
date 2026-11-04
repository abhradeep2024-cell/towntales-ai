import type { ProductionSpec } from '@film-studio/contracts';

export const episode01Production: ProductionSpec = {
  schemaVersion: 1,
  title: 'In This Town, Never Trust Your Shadow',
  idea: 'A Roblox-inspired cinematic horror short about Alex and a shadow that moves independently.',
  styleId: 'roblox-cinematic-horror',
  styleInvariants: [
    'R6 block-character proportions',
    'Alex wears a blue hoodie, black trousers and white sneakers',
    'Shadow Alex is a matte-black silhouette with pale glowing eyes',
    'Maintain the same town and bedroom geography across scenes',
    'Vertical 9:16 composition, cinematic lighting and readable captions'
  ],
  durationSeconds: 60,
  aspectRatio: '9:16',
  fps: 30,
  width: 1080,
  height: 1920,
  scenes: [
    { id: 's01-hook', title: 'The Shadow Waves', durationSeconds: 5, visualDirection: 'Sunset town establishing shot. Push toward Alex as his shadow raises an arm and waves independently while Alex remains still.', narration: 'In this town, your shadow must NEVER move differently from you after sunset.', onScreenText: ['NEVER TRUST YOUR SHADOW'], background: '#171b2a' },
    { id: 's02-rule', title: 'The Town Rule', durationSeconds: 6, visualDirection: 'Three residents cross the street with normal shadows. One resident notices a strange movement, panics and runs indoors. Show a clear 9 PM clock insert.', narration: 'Everyone knows the rule. Because once your shadow moves on its own, it means something is coming to take your place.', onScreenText: ['THE RULE'], background: '#20263a' },
    { id: 's03-alex', title: 'Meet Alex', durationSeconds: 6, visualDirection: 'Alex walks alone while looking at his phone, passes a warning sign and dismisses it with a casual gesture.', narration: 'My name is Alex, and I thought it was just another stupid town legend.', onScreenText: ['ALEX'], background: '#242b40' },
    { id: 's04-incident', title: 'The Wave', durationSeconds: 7, visualDirection: 'At exactly 9 PM Alex raises his right hand. His shadow delays, raises its opposite arm and waves three times, then turns its head. Alex freezes in fear.', narration: 'Until one night, at exactly 9 PM, I raised my hand. But my shadow didn’t. Instead... it waved at me.', onScreenText: ['9:00 PM'], background: '#101522' },
    { id: 's05-chase', title: 'Run Home', durationSeconds: 7, visualDirection: 'Alex sprints toward his house. Track the run, stretch the shadow unnaturally and make it move faster than Alex. End on a front door slam.', narration: 'I ran home as fast as I could.', onScreenText: ['RUN'], background: '#111827' },
    { id: 's06-double', title: 'The Double', durationSeconds: 8, visualDirection: 'Bedroom door opens. An identical Alex stands inside wearing the same blue hoodie, black trousers and white shoes. The double slowly tilts its head as the original recoils.', narration: 'But when I opened my bedroom door, someone was already standing inside. It looked exactly like me. Same clothes. Same face.', onScreenText: ['SAME FACE'], background: '#1a2030' },
    { id: 's07-blackout', title: 'No Shadow', durationSeconds: 12, visualDirection: 'Tilt down to the double’s feet: there is no shadow. The double smiles. Alex turns to run. Lights flicker, fail and the room goes completely black; glowing eyes remain for a brief beat.', narration: 'But something was wrong. It had no shadow. I turned around to run. And suddenly, every light in the house went out.', onScreenText: ['IT HAD NO SHADOW'], background: '#090b12' },
    { id: 's08-morning', title: 'The Morning After', durationSeconds: 5, visualDirection: 'Return to the same street in daylight. Residents have ordinary shadows. Alex runs into frame and has no shadow. Tilt down to reveal his feet.', narration: 'The next morning, I ran outside. The sun was shining. Everyone had a shadow. Except me.', onScreenText: ['EXCEPT ME'], background: '#9ab8d0' },
    { id: 's09-cliffhanger', title: 'The Window', durationSeconds: 4, visualDirection: 'Alex turns toward the upstairs bedroom window. His original shadow stands behind the glass and waves. Hard cut to black.', narration: 'Then I noticed something terrifying. My shadow was standing behind my bedroom window. And it was waving again.', onScreenText: ['IT’S STILL THERE'], background: '#111827' }
  ],
  subtitles: [
    { start: 0, end: 5, text: 'In this town, your shadow must NEVER move differently from you after sunset.' },
    { start: 5, end: 11, text: 'Everyone knows the rule. Because once your shadow moves on its own, it means something is coming to take your place.' },
    { start: 11, end: 17, text: 'My name is Alex, and I thought it was just another stupid town legend.' },
    { start: 17, end: 24, text: 'Until one night, at exactly 9 PM, I raised my hand. But my shadow didn’t. Instead... it waved at me.' },
    { start: 24, end: 31, text: 'I ran home as fast as I could.' },
    { start: 31, end: 39, text: 'But when I opened my bedroom door, someone was already standing inside. It looked exactly like me. Same clothes. Same face.' },
    { start: 39, end: 51, text: 'But something was wrong. It had no shadow. I turned around to run. And suddenly, every light in the house went out.' },
    { start: 51, end: 56, text: 'The next morning, I ran outside. The sun was shining. Everyone had a shadow. Except me.' },
    { start: 56, end: 60, text: 'Then I noticed something terrifying. My shadow was standing behind my bedroom window. And it was waving again.' }
  ],
  audio: { musicEnabled: true, voiceEnabled: true, burnSubtitles: true, voice: 'en-US-AriaNeural', musicStyle: 'suspense', musicVolume: 0.12, voiceVolume: 1 }
};
