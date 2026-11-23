// Everything the player sees: the sun-soaked city, the cars and people in it,
// the HUD with its minimap, the dialogue and the menus. Drawing only — all
// state lives in main.js, entities.js and missions.js.
import { VIEW, PALETTE, FONT, WORLD } from './config.js';
import { AVENUES, STREETS, ROAD_W } from './world.js';
import { clamp, dist } from './random.js';

const MAP_W = 208;
const MAP_H = 148;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const R = { buttons: [] };

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function text(str, x, y, size, color, align = 'left', weight = '600') {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }

  function star(cx, cy, r, filled) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rad = i % 2 === 0 ? r : r * 0.45;
      const x = cx + Math.cos(a) * rad;
      const y = cy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = filled ? PALETTE.star : 'rgba(0,0,0,0.45)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // --- world ---------------------------------------------------------------
  function drawGround(cam, time) {
    // Grass base.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(cam.x - VIEW.width / 2 - 40, cam.y - VIEW.height / 2 - 40, VIEW.width + 80, VIEW.height + 80);
    // Beach and sea along the south edge.
    if (cam.y + VIEW.height / 2 > WORLD.beachY) {
      ctx.fillStyle = PALETTE.sand;
      ctx.fillRect(cam.x - VIEW.width / 2 - 40, WORLD.beachY, VIEW.width + 80, WORLD.seaY - WORLD.beachY);
      ctx.fillStyle = PALETTE.sea;
      ctx.fillRect(cam.x - VIEW.width / 2 - 40, WORLD.seaY, VIEW.width + 80, WORLD.height - WORLD.seaY + 40);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const wy = WORLD.seaY + 18 + i * 18 + Math.sin(time * 0.8 + i * 1.7) * 3;
        ctx.beginPath();
        for (let x = cam.x - VIEW.width / 2 - 40; x < cam.x + VIEW.width / 2 + 40; x += 26) {
          const y = wy + Math.sin(x * 0.02 + time + i) * 3;
          if (x === cam.x - VIEW.width / 2 - 40) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    // Roads.
    ctx.fillStyle = PALETTE.road;
    for (const av of AVENUES) ctx.fillRect(av - ROAD_W / 2, 0, ROAD_W, WORLD.beachY);
    for (const st of STREETS) ctx.fillRect(0, st - ROAD_W / 2, WORLD.width, ROAD_W);
    // Sidewalks.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const av of AVENUES) {
      ctx.fillRect(av - ROAD_W / 2 - 10, 0, 10, WORLD.beachY);
      ctx.fillRect(av + ROAD_W / 2, 0, 10, WORLD.beachY);
    }
    for (const st of STREETS) {
      ctx.fillRect(0, st - ROAD_W / 2 - 10, WORLD.width, 10);
      ctx.fillRect(0, st + ROAD_W / 2, WORLD.width, 10);
    }
    // Centre dashes.
    ctx.strokeStyle = PALETTE.lane;
    ctx.lineWidth = 3;
    ctx.setLineDash([18, 22]);
    for (const av of AVENUES) {
      ctx.beginPath();
      ctx.moveTo(av, 0);
      ctx.lineTo(av, WORLD.beachY);
      ctx.stroke();
    }
    for (const st of STREETS) {
      ctx.beginPath();
      ctx.moveTo(0, st);
      ctx.lineTo(WORLD.width, st);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Crosswalks at every intersection.
    ctx.fillStyle = PALETTE.crosswalk;
    for (const av of AVENUES) {
      for (const st of STREETS) {
        for (let i = -3; i <= 3; i++) {
          ctx.fillRect(av + i * 12 - 4, st - ROAD_W / 2 - 2, 8, 14);
          ctx.fillRect(av + i * 12 - 4, st + ROAD_W / 2 - 12, 8, 14);
        }
      }
    }
  }

  function drawBuildings(world, cam) {
    const x0 = cam.x - VIEW.width / 2 - 120;
    const x1 = cam.x + VIEW.width / 2 + 120;
    const y0 = cam.y - VIEW.height / 2 - 120;
    const y1 = cam.y + VIEW.height / 2 + 120;
    for (const b of world.buildings) {
      if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
      // Soft shadow.
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      ctx.fillStyle = b.wall;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
      // Windows.
      ctx.fillStyle = 'rgba(255,244,190,0.9)';
      const cols = Math.max(1, Math.floor(b.w / 26));
      const rows = Math.max(1, Math.floor(b.h / 26));
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          if ((i * 7 + j * 3 + b.w) % 3 === 0) continue;
          ctx.fillRect(b.x + 10 + i * 26, b.y + 10 + j * 26, 12, 10);
        }
      }
      if (b.sign) {
        ctx.fillStyle = b.signColor || '#ff5d8f';
        const sw = Math.min(b.w - 8, b.sign.length * 7 + 12);
        rr(b.x + (b.w - sw) / 2, b.y + b.h - 22, sw, 16, 4);
        ctx.fill();
        text(b.sign, b.x + b.w / 2, b.y + b.h - 14, 10, '#14202e', 'center', '800');
      }
    }
  }

  function drawPalms(world, cam, time) {
    const x0 = cam.x - VIEW.width / 2 - 60;
    const x1 = cam.x + VIEW.width / 2 + 60;
    const y0 = cam.y - VIEW.height / 2 - 60;
    const y1 = cam.y + VIEW.height / 2 + 60;
    for (const p of world.palms) {
      if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
      const sway = Math.sin(time * 0.9 + p.x * 0.01) * 2 + p.lean * 14;
      ctx.strokeStyle = '#8a6d3b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + sway, p.y - 26);
      ctx.stroke();
      ctx.fillStyle = '#2f9e44';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + p.lean;
        ctx.beginPath();
        ctx.ellipse(p.x + sway + Math.cos(a) * 11, p.y - 26 + Math.sin(a) * 6, 13, 5, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawPark(world) {
    const L = world.locations.park;
    ctx.fillStyle = '#69b455';
    rr(L.x - 190, L.y - 150, 380, 300, 10);
    ctx.fill();
    ctx.fillStyle = '#7ec850';
    for (let i = 0; i < 10; i++) {
      const px = L.x - 160 + (i % 5) * 80;
      const py = L.y - 120 + Math.floor(i / 5) * 200;
      ctx.beginPath();
      ctx.arc(px, py, 22, 0, Math.PI * 2);
      ctx.fill();
    }
    text('PALM PARK', L.x, L.y, 16, 'rgba(255,255,255,0.85)', 'center', '800');
  }

  // --- entities --------------------------------------------------------------
  function drawCar(car, time) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    rr(-car.type.w / 2 + 3, -car.type.h / 2 + 4, car.type.w, car.type.h, 8);
    ctx.fill();
    ctx.fillStyle = car.color;
    rr(-car.type.w / 2, -car.type.h / 2, car.type.w, car.type.h, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,30,44,0.85)';
    rr(-car.type.w / 2 + 8, -car.type.h / 2 + 4, 12, car.type.h - 8, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(200,225,245,0.9)';
    rr(-2, -car.type.h / 2 + 3, 14, car.type.h - 6, 3);
    ctx.fill();
    if (car.type.taxi) {
      ctx.fillStyle = '#14202e';
      for (let i = 0; i < 4; i++) ctx.fillRect(-car.type.w / 2 + 22 + i * 6, -car.type.h / 2, 3, 5);
      text('TAXI', 0, 0, 8, '#14202e', 'center', '800');
    }
    // Headlights.
    ctx.fillStyle = '#fff8c0';
    ctx.fillRect(car.type.w / 2 - 2, -car.type.h / 2 + 3, 3, 5);
    ctx.fillRect(car.type.w / 2 - 2, car.type.h / 2 - 8, 3, 5);
    if (car.driver === 'police') {
      const on = Math.floor(time * 6) % 2 === 0;
      ctx.fillStyle = on ? '#ff3b30' : '#3f8cff';
      ctx.beginPath();
      ctx.arc(-6, -car.type.h / 2 + 1, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = on ? '#3f8cff' : '#ff3b30';
      ctx.beginPath();
      ctx.arc(-6, car.type.h / 2 - 1, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (car.smoking) {
      ctx.fillStyle = 'rgba(90,90,90,0.6)';
      ctx.beginPath();
      ctx.arc(-car.type.w / 2, 0, 6 + Math.sin(time * 5) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPerson(x, y, angle, shirt, skin, opts = {}) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 11, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(angle);
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(5, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    if (opts.gun) {
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(18, 0);
      ctx.stroke();
    }
    if (opts.cop) {
      ctx.fillStyle = '#1c2733';
      ctx.beginPath();
      ctx.arc(5, 0, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(2, -2, 6, 4);
    }
    ctx.restore();
  }

  function drawParticles(E) {
    for (const pt of E.particles) {
      if (pt.tracer) {
        ctx.strokeStyle = pt.color;
        ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        ctx.lineTo(pt.tracer.x, pt.tracer.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    ctx.strokeStyle = 'rgba(20,20,20,0.35)';
    ctx.lineWidth = 3;
    for (const s of E.skids) {
      ctx.globalAlpha = clamp(s.life / 6, 0, 0.6);
      ctx.beginPath();
      ctx.moveTo(s.x - Math.cos(s.angle) * 10, s.y - Math.sin(s.angle) * 10);
      ctx.lineTo(s.x + Math.cos(s.angle) * 10, s.y + Math.sin(s.angle) * 10);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // --- HUD -------------------------------------------------------------------
  function drawMinimap(G) {
    const mx = VIEW.width - MAP_W - 14;
    const my = 52;
    const sx = MAP_W / WORLD.width;
    const sy = MAP_H / WORLD.height;
    ctx.fillStyle = PALETTE.panel;
    rr(mx - 6, my - 6, MAP_W + 12, MAP_H + 12, 8);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    rr(mx, my, MAP_W, MAP_H, 4);
    ctx.clip();
    ctx.fillStyle = '#5d8a4a';
    ctx.fillRect(mx, my, MAP_W, MAP_H);
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(mx, my + WORLD.seaY * sy, MAP_W, MAP_H - WORLD.seaY * sy);
    ctx.strokeStyle = '#3a3f4a';
    ctx.lineWidth = 4;
    for (const av of AVENUES) {
      ctx.beginPath();
      ctx.moveTo(mx + av * sx, my);
      ctx.lineTo(mx + av * sx, my + WORLD.beachY * sy);
      ctx.stroke();
    }
    for (const st of STREETS) {
      ctx.beginPath();
      ctx.moveTo(mx, my + st * sy);
      ctx.lineTo(mx + MAP_W, my + st * sy);
      ctx.stroke();
    }
    const t = G.missions.target();
    const taxi = G.missions.taxi;
    if (t) {
      const pulse = 5 + Math.sin(G.time * 6) * 2;
      ctx.fillStyle = PALETTE.mission;
      ctx.beginPath();
      ctx.arc(mx + t.x * sx, my + t.y * sy, pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `800 11px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('!', mx + t.x * sx, my + t.y * sy + 4);
    }
    if (taxi) {
      ctx.fillStyle = PALETTE.taxi;
      ctx.beginPath();
      ctx.arc(mx + (taxi.state === 'riding' ? taxi.dest.x : taxi.x) * sx, my + (taxi.state === 'riding' ? taxi.dest.y : taxi.y) * sy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const c of G.entities.cars) {
      if (c.dead || c.driver !== 'police') continue;
      ctx.fillStyle = Math.floor(G.time * 4) % 2 === 0 ? '#ff3b30' : '#3f8cff';
      ctx.beginPath();
      ctx.arc(mx + c.x * sx, my + c.y * sy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    const p = G.entities.player;
    ctx.save();
    ctx.translate(mx + p.x * sx, my + p.y * sy);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    rr(mx - 6, my - 6, MAP_W + 12, MAP_H + 12, 8);
    ctx.stroke();
  }

  function drawHud(G) {
    const p = G.entities.player;
    // Cash and progress.
    ctx.fillStyle = PALETTE.panel;
    rr(12, 12, 210, 46, 8);
    ctx.fill();
    text(`$${G.cash.toLocaleString('en-US')}`, 26, 36, 22, '#7CFC9A', 'left', '800');
    text(`Missions ${Math.min(G.missions.index, 5)}/5`, 150, 36, 14, PALETTE.muted, 'left', '600');
    // Wanted stars, top centre-right.
    const sx = VIEW.width - MAP_W - 30;
    for (let i = 0; i < 5; i++) star(sx - i * 30, 32, 12, i < G.wanted);
    text('WANTED', sx - 150, 32, 12, G.wanted > 0 ? '#ff8a8a' : PALETTE.muted, 'right', '800');
    drawMinimap(G);
    // Objective banner.
    const obj = G.missions.objectiveText();
    const tl = G.missions.timeLeft();
    ctx.font = `600 15px ${FONT}`;
    const tw = ctx.measureText(obj).width;
    const timerW = tl !== null ? 56 : 0;
    const bx = VIEW.width / 2 - (tw + timerW) / 2 - 24;
    ctx.fillStyle = PALETTE.panel;
    rr(bx, 12, tw + timerW + 48, 40, 8);
    ctx.fill();
    ctx.fillStyle = PALETTE.mission;
    ctx.fillRect(bx, 12, 4, 40);
    text(obj, VIEW.width / 2 - timerW / 2, 33, 15, PALETTE.text, 'center', '600');
    if (tl !== null) {
      text(`${Math.ceil(tl)}s`, bx + tw + 48, 33, 15, tl < 15 ? '#ff8a8a' : PALETTE.gold, 'left', '800');
    }
    // Health bar, bottom left.
    ctx.fillStyle = PALETTE.panel;
    rr(12, VIEW.height - 52, 230, 40, 8);
    ctx.fill();
    text('HEALTH', 24, VIEW.height - 32, 12, PALETTE.muted, 'left', '800');
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    rr(80, VIEW.height - 40, 148, 16, 6);
    ctx.fill();
    ctx.fillStyle = p.hp > 35 ? PALETTE.health : PALETTE.danger;
    rr(80, VIEW.height - 40, 148 * clamp(p.hp / 100, 0, 1), 16, 6);
    ctx.fill();
    // Bottom right: speed in a car, weapon on foot.
    ctx.fillStyle = PALETTE.panel;
    rr(VIEW.width - 222, VIEW.height - 52, 210, 40, 8);
    ctx.fill();
    if (p.inCar) {
      const kmh = Math.round(Math.abs(p.inCar.speed) * 0.32);
      text(`${kmh} km/h`, VIEW.width - 26, VIEW.height - 32, 20, PALETTE.text, 'right', '800');
      text(p.inCar.type.name, VIEW.width - 120, VIEW.height - 32, 13, PALETTE.muted, 'right', '600');
      const chp = clamp(p.inCar.hp, 0, 100);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      rr(VIEW.width - 210, VIEW.height - 20, 100, 6, 3);
      ctx.fill();
      ctx.fillStyle = chp > 35 ? '#7CFC9A' : PALETTE.danger;
      rr(VIEW.width - 210, VIEW.height - 20, 100 * (chp / 100), 6, 3);
      ctx.fill();
    } else {
      const w = p.weapon === 'pistol' ? `Pistol  ${p.ammo} / ${p.reserveAmmo}` : 'Fists  (press 2 for pistol)';
      text(w, VIEW.width - 26, VIEW.height - 32, 15, PALETTE.text, 'right', '700');
    }
    // Off-screen mission arrow.
    const tgt = G.missions.target();
    if (tgt && G.state === 'play') {
      const cam = G.camera;
      const dx = tgt.x - p.x;
      const dy = tgt.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > 520) {
        const a = Math.atan2(dy, dx);
        const ax = VIEW.width / 2 + Math.cos(a) * 300;
        const ay = VIEW.height / 2 + Math.sin(a) * 220;
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(a);
        ctx.fillStyle = PALETTE.mission;
        ctx.beginPath();
        ctx.moveTo(18, 0);
        ctx.lineTo(-10, -11);
        ctx.lineTo(-10, 11);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        text(`${Math.round(d / 10)}m`, ax, ay + 26, 13, PALETTE.mission, 'center', '800');
      } else {
        // Pulsing marker on the target itself.
        const pulse = 26 + Math.sin(G.time * 5) * 6;
        ctx.strokeStyle = PALETTE.mission;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(tgt.x - cam.x + VIEW.width / 2, tgt.y - cam.y + VIEW.height / 2, pulse, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // Low-health vignette.
    if (p.hp < 35 && !p.dead) {
      const g = ctx.createRadialGradient(VIEW.width / 2, VIEW.height / 2, 200, VIEW.width / 2, VIEW.height / 2, 700);
      g.addColorStop(0, 'rgba(255,0,0,0)');
      g.addColorStop(1, `rgba(255,0,0,${0.25 + 0.12 * Math.sin(G.time * 4)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }
    // Busted timer warning.
    if (p.bustTimer > 0.15) {
      text('THE POLICE ARE GRABBING YOU — MOVE!', VIEW.width / 2, VIEW.height - 90, 20, '#ff8a8a', 'center', '800');
    }
  }

  function drawDialogue(G) {
    const d = G.missions.dialogue;
    if (!d) return;
    const line = d.lines[d.i];
    ctx.fillStyle = 'rgba(8,10,16,0.88)';
    rr(240, VIEW.height - 150, VIEW.width - 480, 110, 10);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    rr(240, VIEW.height - 150, VIEW.width - 480, 110, 10);
    ctx.stroke();
    ctx.fillStyle = line.who === 'Rosa' ? '#ff9f1c' : '#4fc3f7';
    rr(258, VIEW.height - 132, 64, 74, 8);
    ctx.fill();
    text(line.who[0], 290, VIEW.height - 94, 34, '#14202e', 'center', '800');
    text(line.who, 340, VIEW.height - 122, 15, '#ffd166', 'left', '800');
    // Wrap the line.
    ctx.font = `500 16px ${FONT}`;
    const words = line.text.split(' ');
    let row = '';
    let y = VIEW.height - 96;
    for (const w of words) {
      if (ctx.measureText(row + w).width > VIEW.width - 620) {
        text(row, 340, y, 16, PALETTE.text, 'left', '500');
        row = '';
        y += 22;
      }
      row += w + ' ';
    }
    text(row, 340, y, 16, PALETTE.text, 'left', '500');
    text('E / click to continue', VIEW.width - 258, VIEW.height - 62, 12, PALETTE.muted, 'right', '600');
  }

  function drawToast(G) {
    if (!G.toast || G.toastT <= 0) return;
    ctx.globalAlpha = clamp(G.toastT, 0, 1);
    ctx.fillStyle = PALETTE.panel;
    const w = ctx.measureText(G.toast).width + 44;
    ctx.font = `600 16px ${FONT}`;
    const tw = ctx.measureText(G.toast).width + 44;
    rr(VIEW.width / 2 - tw / 2, 66, tw, 38, 8);
    ctx.fill();
    text(G.toast, VIEW.width / 2, 86, 16, '#7CFC9A', 'center', '700');
    ctx.globalAlpha = 1;
  }

  // --- menus -------------------------------------------------------------------
  function drawButton(x, y, w, h, label, enabled = true) {
    const hover = R.mouseX >= x && R.mouseX <= x + w && R.mouseY >= y && R.mouseY <= y + h;
    ctx.fillStyle = hover && enabled ? '#ffd166' : '#12181f';
    rr(x, y, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    rr(x, y, w, h, 8);
    ctx.stroke();
    text(label, x + w / 2, y + h / 2 + 1, 18, hover && enabled ? '#14202e' : PALETTE.text, 'center', '700');
    R.buttons.push({ x, y, w, h, label, enabled });
    return hover;
  }

  function drawTitle(G) {
    // Sunny sky gradient + city silhouette.
    const g = ctx.createLinearGradient(0, 0, 0, VIEW.height);
    g.addColorStop(0, '#7ec8f2');
    g.addColorStop(0.6, '#bfe6f7');
    g.addColorStop(1, '#ffe9a8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.85;
    for (let i = 0; i < 5; i++) {
      const cx = ((i * 260 + G.time * 6) % (VIEW.width + 200)) - 100;
      ctx.beginPath();
      ctx.ellipse(cx, 90 + i * 26, 70, 20, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Sun.
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.arc(1120, 110, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,217,77,0.35)';
    ctx.beginPath();
    ctx.arc(1120, 110, 76, 0, Math.PI * 2);
    ctx.fill();
    // City silhouette.
    ctx.fillStyle = '#3d5a73';
    const base = 560;
    for (let i = 0; i < 14; i++) {
      const bw = 60 + ((i * 37) % 50);
      const bh = 90 + ((i * 53) % 130);
      ctx.fillRect(i * 92 + 8, base - bh, bw, bh);
    }
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(0, base, VIEW.width, VIEW.height - base);
    ctx.fillStyle = '#f5d76e';
    ctx.fillRect(0, base, VIEW.width, 6);
    // Title.
    text('SOLPORT', VIEW.width / 2, 210, 96, '#fff', 'center', '900');
    ctx.strokeStyle = '#ff5d8f';
    ctx.lineWidth = 4;
    ctx.strokeText('SOLPORT', VIEW.width / 2, 210);
    text('A sun-soaked open-world crime story', VIEW.width / 2, 272, 24, '#14202e', 'center', '700');
    text('Steal cars. Outrun the law. Take the city.', VIEW.width / 2, 306, 17, '#33475c', 'center', '600');
    R.buttons = [];
    const hasSave = G.hasSave;
    drawButton(VIEW.width / 2 - 150, 350, 300, 52, 'NEW GAME', true);
    drawButton(VIEW.width / 2 - 150, 414, 300, 52, 'CONTINUE', hasSave);
    drawButton(VIEW.width / 2 - 150, 478, 300, 52, 'HOW TO PLAY', true);
    text('WASD move / drive  •  E enter car  •  Mouse aim, click shoot  •  1 fists, 2 pistol', VIEW.width / 2, 592, 15, '#dfe8f0', 'center', '600');
    text('M mute  •  P pause  •  Progress saves at the safehouse', VIEW.width / 2, 618, 14, '#9fb2c3', 'center', '600');
    if (G.showHelp) {
      ctx.fillStyle = 'rgba(8,10,16,0.92)';
      rr(290, 120, VIEW.width - 580, 480, 12);
      ctx.fill();
      ctx.strokeStyle = PALETTE.panelEdge;
      rr(290, 120, VIEW.width - 580, 480, 12);
      ctx.stroke();
      text('HOW TO PLAY', VIEW.width / 2, 160, 26, PALETTE.gold, 'center', '800');
      const lines = [
        'You are Rico Vega, back in Solport after three years away.',
        'Rosa at the garage has five jobs for you — follow the orange',
        'marker on the map and the arrow at the edge of the screen.',
        '',
        'On foot: WASD to move, Shift to run, E to steal a car,',
        'mouse to aim, click to punch or shoot, 1/2 to swap weapon.',
        '',
        'Driving: W/S accelerate and brake, A/D steer, Space handbrake.',
        'Crimes raise your wanted stars. Cops chase you — lose them',
        'by staying out of sight, or pay $100 for a respray.',
        '',
        'Earn cash from missions and taxi fares. Buy a pistol and',
        'ammo at the Gun Barn, heal at the Clinic, save at home.',
      ];
      lines.forEach((l, i) => text(l, VIEW.width / 2, 196 + i * 24, 15, PALETTE.text, 'center', '500'));
      drawButton(VIEW.width / 2 - 90, 530, 180, 44, 'CLOSE', true);
    }
  }

  function drawPause(G) {
    ctx.fillStyle = 'rgba(8,10,16,0.72)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    text('PAUSED', VIEW.width / 2, 220, 48, PALETTE.text, 'center', '900');
    R.buttons = [];
    drawButton(VIEW.width / 2 - 150, 280, 300, 52, 'RESUME', true);
    drawButton(VIEW.width / 2 - 150, 344, 300, 52, 'SAVE GAME', true);
    drawButton(VIEW.width / 2 - 150, 408, 300, 52, 'QUIT TO TITLE', true);
    text('M mute  •  P resume', VIEW.width / 2, 500, 15, PALETTE.muted, 'center', '600');
  }

  function drawEndCard(G, title, sub, color) {
    ctx.fillStyle = 'rgba(8,10,16,0.78)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    text(title, VIEW.width / 2, 260, 64, color, 'center', '900');
    text(sub, VIEW.width / 2, 330, 20, PALETTE.text, 'center', '600');
    R.buttons = [];
    drawButton(VIEW.width / 2 - 150, 380, 300, 52, 'TRY AGAIN', true);
    drawButton(VIEW.width / 2 - 150, 444, 300, 52, 'QUIT TO TITLE', true);
  }

  function drawMissionCard(G) {
    ctx.fillStyle = 'rgba(8,10,16,0.72)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    text('MISSION COMPLETE', VIEW.width / 2, 250, 44, '#7CFC9A', 'center', '900');
    text(G.lastMission.title, VIEW.width / 2, 310, 22, PALETTE.text, 'center', '700');
    text(`+$${G.lastMission.reward.toLocaleString('en-US')}`, VIEW.width / 2, 352, 30, PALETTE.gold, 'center', '800');
    R.buttons = [];
    drawButton(VIEW.width / 2 - 150, 400, 300, 52, 'CONTINUE', true);
  }

  // --- main draw -------------------------------------------------------------
  R.draw = (G) => {
    R.mouseX = G.input.mouseX;
    R.mouseY = G.input.mouseY;
    R.buttons = [];
    ctx.clearRect(0, 0, VIEW.width, VIEW.height);
    if (G.state === 'title') {
      drawTitle(G);
      return;
    }
    const cam = G.camera;
    ctx.save();
    ctx.translate(VIEW.width / 2 - cam.x, VIEW.height / 2 - cam.y);
    drawGround(cam, G.time);
    drawPark(G.world);
    drawBuildings(G.world, cam);
    // Pickups.
    for (const pk of G.entities.pickups) {
      const bob = Math.sin(G.time * 4 + pk.x) * 3;
      ctx.fillStyle = pk.kind === 'health' ? '#58d68d' : pk.kind === 'ammo' ? '#ffd166' : '#7CFC9A';
      ctx.beginPath();
      ctx.arc(pk.x, pk.y + bob, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      text(pk.kind === 'health' ? '+' : pk.kind === 'ammo' ? 'A' : '$', pk.x, pk.y + bob + 1, 13, '#14202e', 'center', '800');
    }
    drawPalms(G.world, cam, G.time);
    // Skids and particles under the cars.
    drawParticles(G.entities);
    for (const car of G.entities.cars) if (!car.dead) drawCar(car, G.time);
    for (const ped of G.entities.peds) {
      if (ped.state === 'down') {
        ctx.save();
        ctx.translate(ped.x, ped.y);
        ctx.rotate(ped.angle + Math.PI / 2);
        ctx.fillStyle = ped.shirt;
        ctx.beginPath();
        ctx.ellipse(0, 0, 12, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        drawPerson(ped.x, ped.y, ped.angle, ped.shirt, ped.skin, { gun: ped.thug });
      }
    }
    for (const cop of G.entities.footCops) drawPerson(cop.x, cop.y, cop.angle, '#3f8cff', '#e0ac69', { cop: true });
    const p = G.entities.player;
    if (!p.inCar && !p.dead) {
      drawPerson(p.x, p.y, p.weapon === 'pistol' ? p.aim : p.angle, '#ff5d5d', '#f1c27d', { gun: p.weapon === 'pistol' });
      // Aim line, faint.
      if (p.weapon === 'pistol') {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x + Math.cos(p.aim) * 22, p.y + Math.sin(p.aim) * 22);
        ctx.lineTo(p.x + Math.cos(p.aim) * 60, p.y + Math.sin(p.aim) * 60);
        ctx.stroke();
      }
    }
    ctx.restore();

    drawHud(G);
    drawDialogue(G);
    drawToast(G);
    if (G.state === 'pause') drawPause(G);
    else if (G.state === 'down') drawEndCard(G, 'DOWN', 'The Clinic patched you up — $100. The city waits for no one.', '#ff5d5d');
    else if (G.state === 'busted') drawEndCard(G, 'CAUGHT', 'The Solport PD booked you. Rosa bailed you out — $100.', '#3f8cff');
    else if (G.state === 'missioncard') drawMissionCard(G);
    else if (G.state === 'failed') drawEndCard(G, 'MISSION FAILED', G.failReason || 'Try it again, Rico.', '#ff9f1c');
  };

  return R;
}
