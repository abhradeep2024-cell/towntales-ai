import * as Deco from '/styles/art-deco/demo/engine/deco.js';
import * as Type from '/styles/art-deco/demo/engine/type.js';

const canvas = document.getElementById('film');
const g = canvas.getContext('2d');
const W = 1920, H = 1080;

await Promise.all([
  '80px Limelight',
  '80px Poiret',
  '600 40px Josefin',
  '400 40px Josefin',
  '700 40px Josefin',
  '80px Italiana'
].map((font) => document.fonts.load(font)));

window.DUR = 8;

window.render = (t) => {
  g.setTransform(1,0,0,1,0,0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';

  const titleIn = Deco.eio(Deco.seg(t, 0.25, 1.8));
  const titleOut = Deco.seg(t, 6.7, 7.6);
  const sheen = (t * 0.14) % 1;

  Deco.ground(g, W, H, {top:'#16120c',bot:'#050403',vig:0.56});
  Deco.sunburst(g, W/2, H*0.47, {
    rays:48, r0:115, r1:1450, rot:t*0.018,
    mode:'lines', w:1.6, alpha:0.48, sheen
  });
  Deco.archFrame(g, W/2, 970, 1160, 900, {
    rings:4,gap:17,steps:3,crown:'round',part:1,
    fill:'rgba(9,7,5,.25)',burst:true,glow:0.26,sheen
  });

  // Symmetric structural rules keep the Art Deco centre axis fixed.
  for (const side of [-1,1]) {
    Deco.gline(g,[[W/2+side*380,270],[W/2+side*650,270]],{w:2,glow:0.25,sheen});
    Deco.gline(g,[[W/2+side*430,805],[W/2+side*610,805]],{w:1.5,sheen:sheen+0.2});
  }

  Type.titleBar(g,'MIDNIGHT SIGNAL',W/2,390,{
    p:titleIn,out:titleOut,size:78,font:Type.FONTS.title,track:7,
    sub:'A NEW CITY AWAKENS',subSize:28,wings:true,sheen
  });

  const reveal = Deco.ss(Deco.seg(t,1.4,3.2));
  Type.decoDigits(g,'1930',W/2,705,88,{sheen,alpha:reveal,sy:1.42});
  Type.clockFace(g,W/2,890,118,{
    h:11,m:59,s:Math.floor(t*7)%60,
    lit:0.25+0.55*Deco.ss(Deco.seg(t,3.1,6.8)),
    roman:true,sheen,face:'#0b0906'
  });
  Deco.sparkle(g, W/2-525, 385, 27*titleIn,{alpha:titleIn,glow:1});
  Deco.sparkle(g, W/2+525, 385, 27*titleIn,{alpha:titleIn,glow:1});
  Deco.vignette(g,W,H,0.30);
};

window.READY = true;
