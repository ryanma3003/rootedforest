import * as THREE from 'three';
import { mulberry32 } from '../../lib/math';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext('2d')! };
}

/** White leaf silhouette with soft veins; tinted per instance via instanceColor. */
export function makeLeafTexture() {
  const { c, ctx } = canvas(128, 256);
  ctx.beginPath();
  ctx.moveTo(64, 250);
  ctx.bezierCurveTo(120, 200, 114, 70, 64, 4);
  ctx.bezierCurveTo(14, 70, 8, 200, 64, 250);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, 128, 0);
  g.addColorStop(0, '#cfcfcf');
  g.addColorStop(0.5, '#ffffff');
  g.addColorStop(1, '#bdbdbd');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(40,60,30,0.28)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(64, 250);
  ctx.lineTo(64, 8);
  ctx.stroke();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = 'rgba(40,60,30,0.16)';
  for (let y = 225; y > 30; y -= 20) {
    ctx.beginPath();
    ctx.moveTo(64, y);
    ctx.quadraticCurveTo(84, y - 14, 112, y - 34);
    ctx.moveTo(64, y);
    ctx.quadraticCurveTo(44, y - 14, 16, y - 34);
    ctx.stroke();
  }
  ctx.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Vertical fissured bark, used as albedo detail and bump. */
export function makeBarkTexture() {
  const r = mulberry32(3);
  const { c, ctx } = canvas(256, 512);
  ctx.fillStyle = '#b4b4b4';
  ctx.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 320; i++) {
    const x = r() * 256;
    const dark = r() < 0.7;
    ctx.strokeStyle = dark ? `rgba(30,30,30,${0.12 + r() * 0.35})` : `rgba(240,240,240,${0.08 + r() * 0.2})`;
    ctx.lineWidth = 0.6 + r() * (dark ? 3 : 1.5);
    ctx.beginPath();
    let px = x;
    let py = r() * 512 - 64;
    ctx.moveTo(px, py);
    const len = 60 + r() * 300;
    for (let s = 0; s < len; s += 16) {
      px += (r() - 0.5) * 5;
      py += 16;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(${r() < 0.5 ? '20,20,20' : '230,230,230'},${r() * 0.15})`;
    ctx.fillRect(r() * 256, r() * 512, 1 + r() * 3, 1 + r() * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  tex.anisotropy = 4;
  return tex;
}
