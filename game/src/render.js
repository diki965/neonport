// All canvas drawing: the city, cars, people, HUD, minimap and every screen.
// The camera frames a 1280x720 view around the player and is centred after
// the simulation settles each frame, never before.

import { WORLD, VIEW, PALETTE, FONT, CAR } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_OVER = 'over';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WIN = 'win';

function drawCar(ctx, x, y, angle, color, taxi) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-CAR.length / 2 + 3, -CAR.width / 2 + 4, CAR.length, CAR.width);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 8);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.85)';
  ctx.beginPath();
  ctx.roundRect(-8, -CAR.width / 2 + 4, 18, CAR.width - 8, 4);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.fillRect(-CAR.length / 2 + 4, -CAR.width / 2 - 2, 10, 5);
  ctx.fillRect(-CAR.length / 2 + 4, CAR.width / 2 - 3, 10, 5);
  ctx.fillRect(CAR.length / 2 - 12, -CAR.width / 2 - 2, 10, 5);
  ctx.fillRect(CAR.length / 2 - 12, CAR.width / 2 - 3, 10, 5);
  if (taxi) {
    ctx.fillStyle = '#111';
    ctx.font = 'bold 11px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 4);
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, color, isPlayer) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 12, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, isPlayer ? 14 : 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = isPlayer ? PALETTE.playerShirt : '#222';
  ctx.fillRect(0, -5, 16, 10);
  ctx.restore();
}

export function renderWorld(ctx, world, cam) {
  const { x: cx, y: cy } = cam;
  const vw = VIEW.width;
  const vh = VIEW.height;
  ctx.save();
  ctx.translate(-cx + vw / 2, -cy + vh / 2);

  // Ground: sea west, sand beach, grass city.
  ctx.fillStyle = PALETTE.sea;
  ctx.fillRect(cx - vw / 2, cy - vh / 2, vw, vh);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(120, Math.max(0, cy - vh / 2), 150, vh);
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(270, Math.max(0, cy - vh / 2), WORLD.width - 270, vh);

  // Roads.
  ctx.fillStyle = PALETTE.road;
  for (let x = 260; x < WORLD.width; x += 350) ctx.fillRect(x, cy - vh / 2, 96, vh);
  for (let y = 0; y < WORLD.height; y += 350) ctx.fillRect(cx - vw / 2, y, vw, 96);
  ctx.strokeStyle = PALETTE.roadLine;
  ctx.lineWidth = 3;
  ctx.setLineDash([24, 24]);
  for (let x = 260; x < WORLD.width; x += 350) {
    ctx.beginPath();
    ctx.moveTo(x + 48, cy - vh / 2);
    ctx.lineTo(x + 48, cy + vh / 2);
    ctx.stroke();
  }
  for (let y = 0; y < WORLD.height; y += 350) {
    ctx.beginPath();
    ctx.moveTo(cx - vw / 2, y + 48);
    ctx.lineTo(cx + vw / 2, y + 48);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Buildings.
  for (const b of world.buildings) {
    if (b.x > cx + vw / 2 + 50 || b.x + b.w < cx - vw / 2 - 50 || b.y > cy + vh / 2 + 50 || b.y + b.h < cy - vh / 2 - 50) continue;
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,200,0.5)';
    for (let wy = b.y + 14; wy < b.y + b.h - 10; wy += 26) {
      for (let wx = b.x + 12; wx < b.x + b.w - 10; wx += 26) {
        ctx.fillRect(wx, wy, 10, 12);
      }
    }
  }

  // Trees.
  ctx.fillStyle = '#3d6b2f';
  for (const t of world.trees) {
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Places.
  ctx.textAlign = 'center';
  for (const place of Object.values(world.places)) {
    ctx.fillStyle = place.color;
    ctx.beginPath();
    ctx.arc(place.x, place.y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px ' + FONT;
    ctx.fillText(place.name, place.x, place.y - 28);
  }

  // Mission marker.
  if (world.mission && world.mission.target) {
    const t = world.mission.target;
    const bob = Math.sin(world.time * 4) * 6;
    ctx.fillStyle = PALETTE.marker;
    ctx.beginPath();
    ctx.moveTo(t.x, t.y - 44 + bob);
    ctx.lineTo(t.x - 12, t.y - 66 + bob);
    ctx.lineTo(t.x + 12, t.y - 66 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,207,61,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 52 + Math.sin(world.time * 3) * 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Parked cars.
  for (const c of world.parked) {
    if (!c.taken) drawCar(ctx, c.x, c.y, c.angle, c.color, c.taxi);
  }
  // Traffic.
  for (const c of world.traffic) drawCar(ctx, c.x, c.y, c.angle, c.color, false);
  // Cops.
  for (const cop of world.cops) {
    if (cop.health <= 0) continue;
    if (cop.onFoot) drawPerson(ctx, cop.x, cop.y, cop.angle, '#24344d', false);
    else drawCar(ctx, cop.x, cop.y, cop.angle, cop.color, false);
  }
  // Pedestrians.
  for (const ped of world.peds) {
    if (ped.alive) drawPerson(ctx, ped.x, ped.y, ped.angle, ped.color, false);
  }
  // Bullets and particles.
  ctx.fillStyle = '#ffe66d';
  for (const b of world.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const pt of world.particles) {
    ctx.globalAlpha = Math.max(0, pt.life);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Player (or the car they drive).
  const p = world.player;
  if (p.inCar) {
    drawCar(ctx, p.inCar.x, p.inCar.y, p.inCar.angle, p.inCar.color, p.inCar.taxi);
  } else if (!p.dead) {
    drawPerson(ctx, p.x, p.y, p.angle, PALETTE.player, true);
    if (p.hasPistol) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = '#222';
      ctx.fillRect(8, -2, 18, 4);
      ctx.restore();
    }
  }
  ctx.restore();
}

export function renderHud(ctx, world, game) {
  const p = world.player;
  ctx.save();
  // Top-left panel: cash, health, ammo.
  ctx.fillStyle = PALETTE.panel;
  ctx.beginPath();
  ctx.roundRect(12, 12, 250, 86, 10);
  ctx.fill();
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 22px ' + FONT;
  ctx.textAlign = 'left';
  ctx.fillText('$' + p.cash, 26, 42);
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(26, 54, 120, 12);
  ctx.fillStyle = '#2ecc71';
  ctx.fillRect(26, 54, 120 * Math.max(0, p.health / 100), 12);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '14px ' + FONT;
  ctx.fillText(p.hasPistol ? 'Pistol  ' + p.ammo + ' rds' : 'Fists', 26, 88);
  if (p.inCar) ctx.fillText(Math.round(Math.abs(p.inCar.speed) * 0.18) + ' km/h', 160, 88);

  // Wanted stars, top centre.
  ctx.textAlign = 'center';
  ctx.font = '28px ' + FONT;
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < world.wanted ? PALETTE.star : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', VIEW.width / 2 - 70 + i * 35, 44);
  }

  // Mission banner.
  if (world.mission) {
    ctx.fillStyle = PALETTE.panel;
    ctx.beginPath();
    ctx.roundRect(VIEW.width / 2 - 260, 58, 520, 54, 10);
    ctx.fill();
    ctx.fillStyle = PALETTE.marker;
    ctx.font = 'bold 16px ' + FONT;
    ctx.fillText(world.mission.name.toUpperCase(), VIEW.width / 2, 80);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '14px ' + FONT;
    ctx.fillText(world.mission.hint, VIEW.width / 2, 100);
    if (world.mission.timer !== undefined) {
      ctx.fillStyle = world.mission.timer < 30 ? '#e74c3c' : PALETTE.text;
      ctx.font = 'bold 15px ' + FONT;
      ctx.fillText(Math.ceil(world.mission.timer) + 's', VIEW.width / 2 + 228, 80);
    }
  }

  // Objective compass arrow at the screen edge.
  if (world.mission && world.mission.target) {
    const t = world.mission.target;
    const dx = t.x - p.x;
    const dy = t.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > 420) {
      const a = Math.atan2(dy, dx);
      const ex = VIEW.width / 2 + Math.cos(a) * 300;
      const ey = VIEW.height / 2 + Math.sin(a) * 200;
      ctx.save();
      ctx.translate(Math.max(30, Math.min(VIEW.width - 30, ex)), Math.max(140, Math.min(VIEW.height - 30, ey)));
      ctx.rotate(a);
      ctx.fillStyle = PALETTE.marker;
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-10, -10);
      ctx.lineTo(-10, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 13px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText(Math.round(d) + 'm', Math.max(40, Math.min(VIEW.width - 40, ex)), Math.max(155, Math.min(VIEW.height - 15, ey)) + 22);
    }
  }

  // Minimap, top right.
  const mw = 220;
  const mh = 156;
  const mx = VIEW.width - mw - 12;
  const my = 12;
  ctx.fillStyle = PALETTE.panel;
  ctx.beginPath();
  ctx.roundRect(mx, my, mw, mh, 8);
  ctx.fill();
  const sx = mw / WORLD.width;
  const sy = mh / WORLD.height;
  ctx.fillStyle = PALETTE.sea;
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(mx + 270 * sx, my, (WORLD.width - 270) * sx, mh);
  ctx.fillStyle = PALETTE.road;
  for (let x = 260; x < WORLD.width; x += 350) ctx.fillRect(mx + x * sx, my, 96 * sx, mh);
  for (let y = 0; y < WORLD.height; y += 350) ctx.fillRect(mx, my + y * sy, mw, 96 * sy);
  if (world.mission && world.mission.target) {
    ctx.fillStyle = PALETTE.marker;
    ctx.beginPath();
    ctx.arc(mx + world.mission.target.x * sx, my + world.mission.target.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#e74c3c';
  for (const cop of world.cops) {
    if (cop.health > 0) ctx.fillRect(mx + cop.x * sx - 2, my + cop.y * sy - 2, 4, 4);
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(mx + p.x * sx, my + p.y * sy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx + (p.x - 640) * sx, my + (p.y - 360) * sy, 1280 * sx, 720 * sy);

  // Toasts.
  ctx.textAlign = 'center';
  ctx.font = 'bold 17px ' + FONT;
  let ty = VIEW.height - 90;
  for (const toast of game.toasts) {
    ctx.fillStyle = PALETTE.panel;
    const w = ctx.measureText(toast.text).width + 30;
    ctx.beginPath();
    ctx.roundRect(VIEW.width / 2 - w / 2, ty - 24, w, 32, 8);
    ctx.fill();
    ctx.fillStyle = toast.color || PALETTE.text;
    ctx.fillText(toast.text, VIEW.width / 2, ty);
    ty -= 40;
  }

  // Controls hint, bottom left.
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(238,241,245,0.75)';
  ctx.font = '13px ' + FONT;
  ctx.fillText('WASD move/drive · E interact · F enter car · Click shoot · M mute', 14, VIEW.height - 14);
  ctx.restore();
}

export function renderTitle(ctx, game) {
  ctx.save();
  // Sun-soaked skyline band.
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  grad.addColorStop(0, '#ff9a56');
  grad.addColorStop(0.5, '#e85d75');
  grad.addColorStop(1, '#2c1a4d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = 'rgba(20,16,40,0.55)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  // Skyline silhouettes.
  ctx.fillStyle = '#1a1230';
  let x = 0;
  let seed = 7;
  while (x < VIEW.width) {
    seed = (seed * 16807) % 2147483647;
    const bw = 60 + (seed % 90);
    const bh = 120 + (seed % 220);
    ctx.fillRect(x, 470 - bh, bw, bh);
    x += bw + 8;
  }
  ctx.fillStyle = '#ffd94d';
  ctx.beginPath();
  ctx.arc(VIEW.width - 220, 130, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 84px ' + FONT;
  ctx.fillText('SOLPORT', VIEW.width / 2, 250);
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 22px ' + FONT;
  ctx.fillText('A sun-soaked open-world crime story', VIEW.width / 2, 292);
  ctx.fillStyle = '#fff';
  ctx.font = '18px ' + FONT;
  ctx.fillText('Five missions for Rosa. One city that never sleeps.', VIEW.width / 2, 326);
  // Buttons.
  const buttons = game.titleButtons;
  for (const b of buttons) {
    ctx.fillStyle = b.hover ? '#ffd94d' : '#fff';
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 10);
    ctx.fill();
    ctx.fillStyle = '#1a1230';
    ctx.font = 'bold 20px ' + FONT;
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 7);
  }
  // Hint lines in light colours on the dark band.
  ctx.fillStyle = '#ffe9a8';
  ctx.font = '15px ' + FONT;
  ctx.fillText('WASD move and drive · E interact · F get in a car · Mouse aims, click shoots', VIEW.width / 2, 592);
  ctx.fillStyle = '#cfe3ff';
  ctx.fillText('Steal cars, lose the cops, run Rosa\u2019s jobs — and don\u2019t get busted.', VIEW.width / 2, 618);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '13px ' + FONT;
  ctx.fillText('An original game. No Rockstar names, art or assets. Best: ' + (game.best || 0) + ' missions', VIEW.width / 2, 660);
  ctx.restore();
}

export function renderDialogue(ctx, world) {
  const m = world.mission;
  if (!m || !m.dialogue) return;
  const line = m.dialogue[Math.min(m.line, m.dialogue.length - 1)];
  ctx.save();
  ctx.fillStyle = PALETTE.panel;
  ctx.beginPath();
  ctx.roundRect(90, VIEW.height - 190, VIEW.width - 180, 130, 12);
  ctx.fill();
  ctx.fillStyle = PALETTE.marker;
  ctx.font = 'bold 15px ' + FONT;
  ctx.textAlign = 'left';
  ctx.fillText(m.name.toUpperCase() + ' — ROSA', 116, VIEW.height - 156);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '18px ' + FONT;
  wrapText(ctx, line, 116, VIEW.height - 124, VIEW.width - 232, 26);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '14px ' + FONT;
  ctx.textAlign = 'right';
  ctx.fillText(m.line < m.dialogue.length - 1 ? 'E — next' : 'E — begin', VIEW.width - 116, VIEW.height - 76);
  ctx.restore();
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lineH;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, yy);
}

export function renderShop(ctx, game) {
  const shop = game.shop;
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,14,0.72)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = PALETTE.panel;
  ctx.beginPath();
  ctx.roundRect(VIEW.width / 2 - 260, 140, 520, 380, 14);
  ctx.fill();
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 26px ' + FONT;
  ctx.textAlign = 'center';
  ctx.fillText(shop.title, VIEW.width / 2, 186);
  ctx.font = '16px ' + FONT;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('Cash: $' + game.world.player.cash, VIEW.width / 2, 214);
  shop.items.forEach((item, i) => {
    const y = 250 + i * 56;
    ctx.fillStyle = i === shop.selected ? 'rgba(255,217,77,0.18)' : 'transparent';
    ctx.beginPath();
    ctx.roundRect(VIEW.width / 2 - 230, y - 28, 460, 46, 8);
    ctx.fill();
    ctx.fillStyle = PALETTE.text;
    ctx.font = '18px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText(item.label, VIEW.width / 2 - 214, y);
    ctx.textAlign = 'right';
    ctx.fillText('$' + item.price, VIEW.width / 2 + 214, y);
  });
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '14px ' + FONT;
  ctx.textAlign = 'center';
  ctx.fillText('Up/Down choose · Enter buy · E close', VIEW.width / 2, 480);
  if (shop.message) {
    ctx.fillStyle = shop.messageColor || '#2ecc71';
    ctx.font = 'bold 16px ' + FONT;
    ctx.fillText(shop.message, VIEW.width / 2, 508);
  }
  ctx.restore();
}

export function renderCenter(ctx, title, sub, color) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,14,0.78)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = color || '#fff';
  ctx.font = 'bold 64px ' + FONT;
  ctx.fillText(title, VIEW.width / 2, VIEW.height / 2 - 20);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '20px ' + FONT;
  ctx.fillText(sub, VIEW.width / 2, VIEW.height / 2 + 24);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '16px ' + FONT;
  ctx.fillText('Press Enter to continue', VIEW.width / 2, VIEW.height / 2 + 64);
  ctx.restore();
}
