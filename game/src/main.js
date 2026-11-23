// Solport: the boot, the loop, the state machine and every rule that ties the
// modules together — wanted decay, shops, saves, dialogue, menus and the
// camera. The world itself lives in world.js, the actors in entities.js, the
// story in missions.js and all drawing in render.js.
import { VIEW, STEP, WORLD, WANTED, MONEY, PISTOL } from './config.js';
import { createRandom, clamp, dist } from './random.js';
import { createWorld } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createEntities } from './entities.js';
import { createMissions } from './missions.js';
import { createRenderer } from './render.js';
import { hasSave, saveGame, loadSave, clearSave } from './save.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
canvas.width = VIEW.width;
canvas.height = VIEW.height;
const statusEl = document.getElementById('status');

const input = createInput(canvas);
const audio = createAudio();
const world = createWorld(20261122);
const entities = createEntities(world, audio);
const missions = createMissions(world, entities);
const render = createRenderer(canvas);

const G = {
  state: 'title',
  time: 0,
  cash: MONEY.startCash,
  wanted: 0,
  wantedTimer: 0,
  unseenTimer: 0,
  camera: { x: world.locations.safehouse.x, y: world.locations.safehouse.y },
  toast: '',
  toastT: 0,
  showHelp: false,
  hasSave: hasSave(),
  lastMission: null,
  failReason: '',
  hintT: 0,
  input, audio, world, entities, missions,
  hooks: null,
  mouseWorld: null,
  policeSight: null,
};

G.mouseWorld = () => {
  const sx = input.mouseX;
  const sy = input.mouseY;
  return { x: G.camera.x - VIEW.width / 2 + sx, y: G.camera.y - VIEW.height / 2 + sy };
};

G.policeSight = () => {
  const p = entities.player;
  for (const c of entities.cars) {
    if (c.driver === 'police' && !c.dead && dist(c.x, c.y, p.x, p.y) < WANTED.sightRange) return true;
  }
  for (const c of entities.footCops) {
    if (!c.dead && dist(c.x, c.y, p.x, p.y) < WANTED.sightRange) return true;
  }
  return false;
};

function showToast(text, dur = 3) {
  G.toast = text;
  G.toastT = dur;
}

function setWanted(n) {
  G.wanted = clamp(n, 0, WANTED.maxStars);
  G.unseenTimer = 0;
  G.wantedTimer = 0;
}

function startMission(i) {
  missions.startMission(i);
  const m = missions.defs[i];
  if (m.id === 'heat') setWanted(3);
}

G.hooks = {
  onCrime: (type, stars) => {
    if (stars > 0) {
      setWanted(G.wanted + stars);
      G.unseenTimer = 0;
    }
  },
  onCarStolen: () => showToast('Car stolen — the city saw that'),
  onPedDown: () => {},
  onExplosion: (x, y) => {
    if (dist(x, y, entities.player.x, entities.player.y) < 500) G.hooks.onCrime('explosion', 1);
  },
  onPickup: (kind) => showToast(kind === 'health' ? 'Health restored' : 'Ammo picked up'),
  onCash: (amount) => {
    G.cash += amount;
    audio.cash();
    showToast(`+$${amount}`);
  },
  onMissionComplete: (m) => {
    audio.missionDone();
    G.lastMission = m;
    G.state = 'missioncard';
    saveGame(G);
  },
  onMissionFailed: (m, reason) => {
    audio.missionFail();
    G.failReason = reason;
    G.state = 'failed';
  },
  onBusted: () => {
    const p = entities.player;
    if (p.inCar) entities.exitCar();
    G.cash = Math.max(0, G.cash - MONEY.deathPenalty);
    setWanted(0);
    p.hp = 100;
    p.dead = false;
    p.x = world.locations.safehouse.x;
    p.y = world.locations.safehouse.y + 60;
    const m = missions.current();
    if (m) {
      missions.active = false;
      missions.failed = true;
    }
    audio.setEngine(false, 0);
    G.state = 'busted';
  },
  onDown: () => {
    const p = entities.player;
    G.cash = Math.max(0, G.cash - MONEY.deathPenalty);
    setWanted(0);
    p.hp = 100;
    p.dead = false;
    p.x = world.locations.clinic.x;
    p.y = world.locations.clinic.y + 70;
    const m = missions.current();
    if (m) {
      missions.active = false;
      missions.failed = true;
    }
    audio.setEngine(false, 0);
    G.state = 'down';
  },
  onTaxiPickup: () => showToast('Passenger aboard — follow the yellow marker'),
  onTaxiDone: (fare) => showToast(`Taxi fare paid: $${fare}`),
  onVaultCracked: () => {
    setWanted(4);
    showToast('Vault cracked! The whole force is coming — RUN');
  },
};

function newGame() {
  clearSave();
  resetRun();
  G.cash = MONEY.startCash;
  G.state = 'play';
  G.hintT = 25;
  startMission(0);
  audio.ensure();
  audio.startMusic();
}

function resetRun() {
  const p = entities.player;
  p.x = world.locations.safehouse.x;
  p.y = world.locations.safehouse.y + 60;
  p.hp = 100;
  p.dead = false;
  p.hasPistol = false;
  p.weapon = 'fists';
  p.ammo = 0;
  p.reserveAmmo = 0;
  if (p.inCar) {
    p.inCar.driver = 'none';
    p.inCar = null;
  }
  setWanted(0);
  missions.index = 0;
  missions.step = 0;
  missions.active = false;
  missions.dialogue = null;
  missions.taxi = null;
  G.camera.x = p.x;
  G.camera.y = p.y;
  audio.setEngine(false, 0);
}

function continueGame() {
  const s = loadSave();
  if (!s) return;
  resetRun();
  G.cash = s.cash;
  const p = entities.player;
  p.hp = s.hp;
  p.hasPistol = s.hasPistol;
  p.ammo = s.ammo;
  p.reserveAmmo = s.reserveAmmo;
  if (p.hasPistol) p.weapon = 'pistol';
  G.state = 'play';
  G.hintT = 12;
  startMission(Math.min(s.missionIndex, 4));
  audio.ensure();
  audio.startMusic();
}

function retryMission() {
  const i = missions.index;
  resetRun();
  G.state = 'play';
  startMission(Math.min(i, 4));
}

// --- shops and safehouse -----------------------------------------------------
function updateShops(dt) {
  const p = entities.player;
  const L = world.locations;
  const near = (loc, r) => dist(p.x, p.y, loc.x, loc.y + 70) < r;

  if (!p.inCar && near(L.gunstore, 70)) {
    if (!p.hasPistol) {
      showToast('Gun Barn — press E to buy a pistol ($120)', 0.2);
      if (input.wasPressed('e')) {
        if (G.cash >= PISTOL.price) {
          G.cash -= PISTOL.price;
          p.hasPistol = true;
          p.weapon = 'pistol';
          p.ammo = PISTOL.magSize;
          p.reserveAmmo = PISTOL.startAmmo;
          audio.pickup();
          showToast('Pistol bought — press 2 to draw it, click to fire');
        } else {
          audio.deny();
          showToast('Not enough cash for a pistol');
        }
      }
    } else {
      showToast('Gun Barn — press E for ammo ($40)', 0.2);
      if (input.wasPressed('e')) {
        if (G.cash >= PISTOL.ammoPrice) {
          G.cash -= PISTOL.ammoPrice;
          p.reserveAmmo += PISTOL.magSize;
          audio.pickup();
          showToast('Ammo bought');
        } else {
          audio.deny();
          showToast('Not enough cash for ammo');
        }
      }
    }
  }

  if (!p.inCar && near(L.clinic, 70) && p.hp < 100) {
    showToast('Clinic — press E to heal ($80)', 0.2);
    if (input.wasPressed('e') && G.cash >= MONEY.hospital) {
      G.cash -= MONEY.hospital;
      p.hp = 100;
      audio.pickup();
      showToast('Patched up — full health');
    }
  }

  if (p.inCar && near(L.respray, 80) && G.wanted > 0) {
    showToast('Respray — press E for a new paint job ($100, clears wanted)', 0.2);
    if (input.wasPressed('e') && G.cash >= MONEY.respray) {
      G.cash -= MONEY.respray;
      setWanted(0);
      p.inCar.hp = 100;
      p.inCar.smoking = false;
      p.inCar.color = ['#e74c3c', '#3498db', '#f1c40f', '#1abc9c'][Math.floor(Math.random() * 4)];
      audio.pickup();
      showToast('Fresh paint — the police lost you');
    }
  }

  if (p.inCar && near(L.garage, 80) && p.inCar.hp < 100) {
    showToast("Rosa's Garage — press E to repair ($50)", 0.2);
    if (input.wasPressed('e') && G.cash >= MONEY.repair) {
      G.cash -= MONEY.repair;
      p.inCar.hp = 100;
      p.inCar.smoking = false;
      audio.pickup();
      showToast('Car repaired');
    }
  }

  if (!p.inCar && near(L.safehouse, 70)) {
    if (saveGame(G)) showToast('Game saved at the safehouse', 0.2);
  }

  // Reload from reserve with R.
  if (input.wasPressed('r') && p.hasPistol && p.weapon === 'pistol' && p.reserveAmmo > 0 && p.ammo < PISTOL.magSize) {
    const need = PISTOL.magSize - p.ammo;
    const take = Math.min(need, p.reserveAmmo);
    p.ammo += take;
    p.reserveAmmo -= take;
    audio.pickup();
  }
}

// --- wanted decay -------------------------------------------------------------
function updateWanted(dt) {
  if (G.wanted === 0) return;
  if (G.policeSight()) {
    G.unseenTimer = 0;
    G.wantedTimer = 0;
  } else {
    G.unseenTimer += dt;
    if (G.unseenTimer > WANTED.decayDelay) {
      G.wantedTimer += dt;
      if (G.wantedTimer >= WANTED.decayInterval) {
        G.wantedTimer = 0;
        setWanted(G.wanted - 1);
        if (G.wanted === 0) showToast('The heat is off — for now');
      }
    }
  }
}

// --- camera -------------------------------------------------------------------
function updateCamera(dt) {
  const p = entities.player;
  const look = p.inCar ? 0.35 : 0.18;
  const tx = p.x + Math.cos(p.angle) * (p.inCar ? p.inCar.speed * look : p.speed * look);
  const ty = p.y + Math.sin(p.angle) * (p.inCar ? p.inCar.speed * look : p.speed * look);
  G.camera.x += (tx - G.camera.x) * clamp(4 * dt, 0, 1);
  G.camera.y += (ty - G.camera.y) * clamp(4 * dt, 0, 1);
  G.camera.x = clamp(G.camera.x, VIEW.width / 2, WORLD.width - VIEW.width / 2);
  G.camera.y = clamp(G.camera.y, VIEW.height / 2, WORLD.height - VIEW.height / 2);
}

// --- buttons ------------------------------------------------------------------
function clickButton(label) {
  const b = render.buttons.find((btn) => btn.label === label && btn.enabled);
  if (!b) return false;
  return input.mouseX >= b.x && input.mouseX <= b.x + b.w && input.mouseY >= b.y && input.mouseY <= b.y + b.h;
}

function updateMenus() {
  if (G.state === 'title') {
    if (input.mousePressed) {
      if (clickButton('NEW GAME')) newGame();
      else if (clickButton('CONTINUE') && G.hasSave) continueGame();
      else if (clickButton('HOW TO PLAY')) G.showHelp = true;
      else if (clickButton('CLOSE')) G.showHelp = false;
    }
    return;
  }
  if (G.state === 'pause') {
    if (input.mousePressed) {
      if (clickButton('RESUME')) G.state = 'play';
      else if (clickButton('SAVE GAME')) {
        if (saveGame(G)) showToast('Game saved');
        G.state = 'play';
      } else if (clickButton('QUIT TO TITLE')) {
        G.state = 'title';
        G.hasSave = hasSave();
      }
    }
    return;
  }
  if (G.state === 'missioncard') {
    if (input.mousePressed && clickButton('CONTINUE')) G.state = 'play';
    return;
  }
  if (G.state === 'down' || G.state === 'busted' || G.state === 'failed') {
    if (input.mousePressed) {
      if (clickButton('TRY AGAIN')) retryMission();
      else if (clickButton('QUIT TO TITLE')) {
        G.state = 'title';
        G.hasSave = hasSave();
      }
    }
  }
}

// --- main loop ------------------------------------------------------------------
let last = performance.now();
let acc = 0;

function frame(now) {
  requestAnimationFrame(frame);
  try {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;
  acc += dt;

  // Global keys.
  if (input.wasPressed('m')) {
    const muted = audio.toggleMute();
    showToast(muted ? 'Sound off' : 'Sound on');
  }
  if ((input.wasPressed('p') || input.wasPressed('escape')) && (G.state === 'play' || G.state === 'pause')) {
    G.state = G.state === 'play' ? 'pause' : 'play';
  }

  let steps = 0;
  while (acc >= STEP && steps < 5) {
    acc -= STEP;
    steps += 1;
    G.time += STEP;

    if (G.state === 'title' || G.state === 'pause') {
      // Frozen world; menus still animate with G.time.
    } else if (G.state === 'play') {
      if (missions.dialogue) {
        if (input.wasPressed('e') || input.mousePressed) {
          // Consume the click: several fixed steps can run in one frame and
          // each would otherwise advance the dialogue a line.
          input.mousePressed = false;
          missions.advanceDialogue();
        }
      } else {
        entities.update(STEP, G);
        missions.update(STEP, G);
        updateWanted(STEP);
        updateShops(STEP);
        updateCamera(STEP);
        G.hintT = Math.max(0, G.hintT - STEP);
        if (entities.player.dead) audio.setEngine(false, 0);
        else if (!entities.player.inCar) audio.setEngine(false, 0);
      }
    }
    if (G.toastT > 0) G.toastT -= STEP;
    // One press must fire once per frame, not once per fixed step: clear the
    // pressed set after the first step so later steps in this frame see a
    // clean slate. (Keys are only added by event listeners, which run between
    // frames, so nothing is lost.)
    if (steps === 1) input.pressed.clear();
  }

  updateMenus();
  render.draw(G);
  if (statusEl) {
    const m = missions.current();
    statusEl.textContent = G.state === 'play'
      ? `Solport — ${m ? m.title : 'Free roam'} — cash $${G.cash}, wanted ${G.wanted} star${G.wanted === 1 ? '' : 's'}`
      : 'Solport — a sun-soaked open-world crime story';
  }
  } finally {
    // Always clear per-frame input, even if an update throws, so one bad
    // frame can't stick a key or a click down forever.
    input.endFrame();
  }
}

// Screenshot staging (?shot=start|play|foot|mission) for the maker's shots.
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  stageShot(G, shot);
  if (shot !== 'start') {
    G.state = 'play';
    audio.ensure();
  }
  render.draw(G);
} else {
  requestAnimationFrame(frame);
}

// A small handle for automated checks: state, cash, wanted, player, missions.
window.__solport = G;
