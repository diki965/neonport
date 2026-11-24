// Solport — entry point. Fixed-step simulation, screens, save/load, shops,
// missions, and staged screenshots (?shot=title|chase|mission|play&seed=N).
// The frame body is wrapped in try/finally so input.endFrame() always runs:
// an exception mid-frame used to stick keys down forever.

import { STEP, VIEW, SAVE_KEY, BEST_KEY, PISTOL, MONEY, WORLD } from './config.js';
import { createWorld, stepWorld, nearestParked, nearestPlace, addWanted } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  renderWorld, renderHud, renderTitle, renderDialogue, renderShop, renderCenter,
  SCREEN_TITLE, SCREEN_PLAY, SCREEN_OVER, SCREEN_BUSTED, SCREEN_WIN,
} from './render.js';
import { startMission, advanceDialogue, missionDone, MISSIONS } from './missions.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW.width;
canvas.height = VIEW.height;
const statusEl = document.getElementById('status');

const params = new URLSearchParams(window.location.search);
const seed = parseInt(params.get('seed') || '1', 10) || 1;
const shotName = params.get('shot');

const input = createInput();
input.attach(canvas);
const audio = createAudio();
const world = createWorld(seed);

// Debug handle for automated checks (harmless in normal play).
window.__solport = { world, game: null, input };

const game = {
  screen: SCREEN_TITLE,
  paused: false,
  toasts: [],
  best: 0,
  shop: null,
  missionIndex: 0,
  cam: { x: world.player.x, y: world.player.y },
  titleButtons: [],
  saveData: null,
  world,
};

try { game.best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch (e) { /* private mode */ }
try { game.saveData = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { game.saveData = null; }
window.__solport.game = game;

function toast(text, color) {
  game.toasts.push({ text, color: color || '#eef1f5', t: 3 });
  if (game.toasts.length > 3) game.toasts.shift();
}

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function layoutTitleButtons() {
  const labels = ['NEW GAME'];
  if (game.saveData) labels.push('CONTINUE');
  labels.push('HOW TO PLAY');
  game.titleButtons = labels.map((label, i) => ({
    label,
    x: VIEW.width / 2 - 150,
    y: 380 + i * 62,
    w: 300,
    h: 48,
    hover: false,
  }));
}
layoutTitleButtons();

function saveGame() {
  const p = world.player;
  const data = {
    cash: p.cash, health: p.health, hasPistol: p.hasPistol, ammo: p.ammo,
    missionIndex: game.missionIndex, wanted: world.wanted, x: p.x, y: p.y,
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* private mode */ }
  game.saveData = data;
  layoutTitleButtons();
}

function loadSave(data) {
  const p = world.player;
  p.cash = data.cash;
  p.health = data.health;
  p.hasPistol = data.hasPistol;
  p.ammo = data.ammo;
  p.x = data.x;
  p.y = data.y;
  world.wanted = 0;
  world.cops = [];
  game.missionIndex = data.missionIndex || 0;
  startMission(world, game.missionIndex);
  world.mission.line = world.mission.dialogue.length - 1;
  game.cam.x = p.x;
  game.cam.y = p.y;
}

function beginMission(index) {
  game.missionIndex = index;
  startMission(world, index);
  game.screen = 'dialogue';
  setStatus(MISSIONS[index].briefing);
}

function fireBullet(p) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = VIEW.width / rect.width;
  const scaleY = VIEW.height / rect.height;
  const mx = (input.mouse.x * scaleX - VIEW.width / 2) + game.cam.x;
  const my = (input.mouse.y * scaleY - VIEW.height / 2) + game.cam.y;
  const angle = Math.atan2(my - p.y, mx - p.x);
  world.bullets.push({ x: p.x + Math.cos(angle) * 22, y: p.y + Math.sin(angle) * 22, angle, speed: 900, life: 1.1 });
  world.particles.push({ x: p.x + Math.cos(angle) * 26, y: p.y + Math.sin(angle) * 26, vx: Math.cos(angle) * 120, vy: Math.sin(angle) * 120, life: 0.15, color: '#ffe66d' });
  audio.shot();
}

function openShop(id) {
  const p = world.player;
  const defs = {
    gunbarn: {
      title: 'Gun Barn',
      items: [
        { label: 'Pistol', price: PISTOL.price, buy() { if (p.cash >= PISTOL.price && !p.hasPistol) { p.cash -= PISTOL.price; p.hasPistol = true; p.ammo = PISTOL.magSize; return 'Pistol bought'; } return p.hasPistol ? 'Already armed' : 'Not enough cash'; } },
        { label: 'Ammo pack (24 rds)', price: PISTOL.ammoPrice, buy() { if (!p.hasPistol) return 'Buy the pistol first'; if (p.cash < PISTOL.ammoPrice) return 'Not enough cash'; p.cash -= PISTOL.ammoPrice; p.ammo += PISTOL.ammoPack; return 'Ammo +24'; } },
      ],
    },
    clinic: {
      title: 'Clinic',
      items: [
        { label: 'Patch up (full health)', price: MONEY.healPrice, buy() { if (p.cash < MONEY.healPrice) return 'Not enough cash'; if (p.health >= 100) return 'Already healthy'; p.cash -= MONEY.healPrice; p.health = 100; return 'Patched up'; } },
      ],
    },
    respray: {
      title: 'Respray',
      items: [
        { label: 'New paint — lose the heat', price: MONEY.resprayPrice, buy() { if (p.cash < MONEY.resprayPrice) return 'Not enough cash'; if (world.wanted === 0) return 'No heat to lose'; p.cash -= MONEY.resprayPrice; world.wanted = 0; world.cops = []; world.heat = 0; return 'Clean. The cops lost you.'; } },
      ],
    },
    garage: {
      title: 'Garage',
      items: [
        { label: 'Sell this car', price: -MONEY.sellCar, buy() { if (!p.inCar) return 'Bring a car to sell'; const car = p.inCar; p.inCar = null; car.taken = true; p.cash += MONEY.sellCar; return 'Sold for $' + MONEY.sellCar; } },
      ],
    },
  };
  const def = defs[id];
  if (!def) return;
  game.shop = { id, title: def.title, items: def.items, selected: 0, message: '', messageColor: '#2ecc71' };
  game.screen = 'shop';
}

function buySelected() {
  const shop = game.shop;
  if (!shop) return;
  const item = shop.items[shop.selected];
  const result = item.buy();
  shop.message = result;
  shop.messageColor = result.includes('Not enough') || result.includes('first') || result.includes('Already') || result.includes('Bring') || result.includes('No heat') ? '#e74c3c' : '#2ecc71';
  if (shop.messageColor === '#2ecc71') audio.cash();
}

function interact() {
  const p = world.player;
  if (p.dead || p.busted) return;
  const place = nearestPlace(world, p.x, p.y, 90);
  if (place) {
    if (place.id === 'safehouse') {
      p.health = 100;
      saveGame();
      toast('Game saved at the Safehouse', '#2ecc71');
      audio.pickup();
      return;
    }
    openShop(place.id);
    return;
  }
  const car = nearestParked(world, p.x, p.y, 70);
  if (car && !p.inCar) {
    toast('Press F to get in the car', '#ffe9a8');
  }
}

function enterExitCar() {
  const p = world.player;
  if (p.dead || p.busted) return;
  if (p.inCar) {
    const car = p.inCar;
    p.inCar = null;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 44;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 44;
    return;
  }
  const car = nearestParked(world, p.x, p.y, 70);
  if (car) {
    car.taken = true;
    p.inCar = car;
    p.x = car.x;
    p.y = car.y;
    addWanted(world, 1);
    toast(car.taxi ? 'Taxi taken — drive to the marker for the fare' : 'Car stolen — the cops noticed', '#ffd94d');
    if (car.taxi) {
      const dests = Object.values(world.places);
      const dest = dests[Math.floor(Math.random() * dests.length)];
      world.taxiFare = { dest: { x: dest.x, y: dest.y }, pay: MONEY.taxiFare };
      if (world.mission) world.mission.target = world.taxiFare.dest;
    }
    audio.blip(440, 0.1, 'square', 0.08);
  }
}

function drainEvents() {
  for (const ev of world.events) {
    if (ev.type === 'fare') { toast('Taxi fare +$' + ev.amount, '#2ecc71'); audio.cash(); }
    else if (ev.type === 'drop') { toast('Package delivered', '#2ecc71'); audio.pickup(); }
    else if (ev.type === 'collect') { toast('Collected $150', '#2ecc71'); audio.cash(); }
    else if (ev.type === 'grab') { toast('Vault cash grabbed — RUN!', '#e74c3c'); audio.jingle(); }
    else if (ev.type === 'busted') { audio.busted(); }
    else if (ev.type === 'hurt') { audio.blip(200, 0.08, 'sawtooth', 0.06); }
    else if (ev.type === 'pedDown') { toast('Pedestrian down — wanted up', '#e74c3c'); }
  }
  world.events.length = 0;
}

function step(dt) {
  // Edge-triggered input (pressed keys, clicks) is consumed by the first
  // step that runs after it arrives, and cleared here — never by a frame
  // that runs no step, or presses get lost between frames.
  try {
  if (game.screen === 'dialogue') {
    if (input.pressed.interact || input.mouse.clicked) {
      const more = advanceDialogue(world);
      if (!more) game.screen = SCREEN_PLAY;
      audio.blip(660, 0.05, 'sine', 0.06);
    }
    return;
  }
  if (game.screen === 'shop') {
    const shop = game.shop;
    if (input.pressed.up) shop.selected = (shop.selected + shop.items.length - 1) % shop.items.length;
    if (input.pressed.down) shop.selected = (shop.selected + 1) % shop.items.length;
    if (input.pressed.confirm) buySelected();
    if (input.pressed.interact || input.pressed.pause) game.screen = SCREEN_PLAY;
    return;
  }
  if (game.screen !== SCREEN_PLAY) return;

  if (input.pressed.pause) { game.paused = !game.paused; return; }
  if (game.paused) return;
  if (input.pressed.mute) { const m = audio.toggleMute(); toast(m ? 'Muted' : 'Sound on'); return; }
  if (input.pressed.interact) interact();
  if (input.pressed.enter) enterExitCar();

  stepWorld(world, input, dt, fireBullet);
  drainEvents();

  // Mission progress.
  if (world.mission) {
    const done = missionDone(world);
    if (done === 'fail') {
      toast('Too slow — Rosa gives you another shot', '#e74c3c');
      beginMission(game.missionIndex);
      return;
    }
    if (done) {
      const reward = MONEY.missionReward[game.missionIndex] || 500;
      world.player.cash += reward;
      toast('Mission complete — +$' + reward, '#2ecc71');
      audio.jingle();
      saveGame();
      game.best = Math.max(game.best, game.missionIndex + 1);
      try { localStorage.setItem(BEST_KEY, String(game.best)); } catch (e) { /* private mode */ }
      if (game.missionIndex + 1 >= MISSIONS.length) {
        game.screen = SCREEN_WIN;
        setStatus('Story complete');
      } else {
        beginMission(game.missionIndex + 1);
      }
      return;
    }
  }

  if (world.player.busted) {
    const p = world.player;
    const lost = Math.min(p.cash, 200);
    p.cash -= lost;
    p.health = 100;
    p.busted = false;
    p.inCar = null;
    p.x = world.places.safehouse.x;
    p.y = world.places.safehouse.y;
    world.wanted = 0;
    world.cops = [];
    world.heat = 0;
    game.screen = SCREEN_BUSTED;
    setStatus('Busted — the cops took $' + lost);
    return;
  }
  if (world.player.dead) {
    game.screen = SCREEN_OVER;
    setStatus('Wasted');
    return;
  }

  // Camera follows the player, centred after the step.
  game.cam.x = Math.max(VIEW.width / 2, Math.min(WORLD.width - VIEW.width / 2, world.player.x));
  game.cam.y = Math.max(VIEW.height / 2, Math.min(WORLD.height - VIEW.height / 2, world.player.y));

  // Audio follows the game.
  audio.ensure();
  audio.setEngine(world.player.inCar ? Math.abs(world.player.inCar.speed) / 560 : 0);
  audio.setSiren(world.wanted > 0, dt);

  for (const t of game.toasts) t.t -= dt;
  game.toasts = game.toasts.filter((t) => t.t > 0);
  } finally {
    input.endFrame();
  }
}

function render() {
  ctx.clearRect(0, 0, VIEW.width, VIEW.height);
  if (game.screen === SCREEN_TITLE) {
    renderWorld(ctx, world, game.cam);
    renderTitle(ctx, game);
    return;
  }
  renderWorld(ctx, world, game.cam);
  if (game.screen === SCREEN_PLAY || game.screen === 'dialogue' || game.screen === 'shop' || game.paused) {
    renderHud(ctx, world, game);
    if (game.screen === 'dialogue') renderDialogue(ctx, world);
    if (game.screen === 'shop') renderShop(ctx, game);
    if (game.paused) renderCenter(ctx, 'PAUSED', 'Esc to resume', '#fff');
    return;
  }
  if (game.screen === SCREEN_BUSTED) {
    renderHud(ctx, world, game);
    renderCenter(ctx, 'BUSTED', 'The cops took $200. Rosa is not impressed.', '#ffd94d');
    return;
  }
  if (game.screen === SCREEN_OVER) {
    renderCenter(ctx, 'WASTED', 'Rico is down. The city keeps moving without you.', '#e74c3c');
    return;
  }
  if (game.screen === SCREEN_WIN) {
    renderHud(ctx, world, game);
    renderCenter(ctx, 'SOLPORT IS YOURS', 'All five of Rosa\u2019s jobs done. The vault money is safe.', '#2ecc71');
  }
}

function titleClick() {
  const rect = canvas.getBoundingClientRect();
  const mx = input.mouse.x * (VIEW.width / rect.width);
  const my = input.mouse.y * (VIEW.height / rect.height);
  for (const b of game.titleButtons) {
    b.hover = mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h;
  }
  if (!input.mouse.clicked) return;
  for (const b of game.titleButtons) {
    if (!b.hover) continue;
    audio.ensure();
    if (b.label === 'NEW GAME') {
      game.missionIndex = 0;
      beginMission(0);
      setStatus('Mission 1: Wheels');
    } else if (b.label === 'CONTINUE' && game.saveData) {
      loadSave(game.saveData);
      game.screen = SCREEN_PLAY;
      setStatus('Back on the streets');
    } else if (b.label === 'HOW TO PLAY') {
      toast('WASD move/drive · E interact · F car · Click shoot · M mute');
    }
    return;
  }
}

// Staged screenshot mode: play the scene forward, render one frame, stop.
if (shotName) {
  const staged = stageShot(shotName, world, (w, inp, dt) => stepWorld(w, inp, dt, fireBullet));
  game.screen = staged.screen;
  game.cam.x = Math.max(VIEW.width / 2, Math.min(WORLD.width - VIEW.width / 2, world.player.x));
  game.cam.y = Math.max(VIEW.height / 2, Math.min(WORLD.height - VIEW.height / 2, world.player.y));
  render();
  document.title = 'Solport — shot ' + shotName;
} else {
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (game.screen === SCREEN_TITLE) {
      titleClick();
      // Keep the city alive behind the title.
      stepWorld(world, { held: {}, pressed: {}, mouse: input.mouse }, dt, () => {});
      world.events.length = 0;
      game.cam.x = Math.max(VIEW.width / 2, Math.min(WORLD.width - VIEW.width / 2, world.player.x));
      game.cam.y = Math.max(VIEW.height / 2, Math.min(WORLD.height - VIEW.height / 2, world.player.y));
      input.endFrame();
    } else if (game.screen === SCREEN_BUSTED || game.screen === SCREEN_OVER || game.screen === SCREEN_WIN) {
      if (input.pressed.confirm || input.pressed.interact) {
        if (game.screen === SCREEN_WIN) { game.screen = SCREEN_TITLE; layoutTitleButtons(); }
        else { world.player.dead = false; world.player.health = 100; game.screen = SCREEN_PLAY; }
      }
      input.endFrame();
    } else {
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 5) {
        step(STEP);
        acc -= STEP;
        n += 1;
      }
      if (n === 5) acc = 0;
    }
    render();
  }
  requestAnimationFrame(frame);
}
