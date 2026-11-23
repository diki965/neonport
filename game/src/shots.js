// Screenshot scenes, driven by ?shot= in the URL. Each one stages a real
// game state — the same code path the player uses — so the screenshots are
// renders of the game itself, never composited. Used by the maker's shot
// script and by nothing else.
import { WORLD } from './config.js';

export function stageShot(G, shot) {
  const E = G.entities;
  const M = G.missions;
  const L = G.world.locations;
  const p = E.player;

  if (shot === 'start') {
    G.state = 'title';
    return;
  }

  G.state = 'play';
  G.cash = 1240;
  if (shot === 'play') {
    // Cover: Rico in the red sports car, mid-chase, three stars, two cop cars
    // behind, mission 2 running, the minimap full of blue dots.
    M.startMission(1);
    M.dialogue = null;
    M.step = 1;
    M.stepTimer = 12;
    const car = E.cars.find((c) => c.color === '#e74c3c' && c.type.name === 'Sports');
    if (car) {
      car.driver = 'player';
      p.inCar = car;
      car.x = 1400;
      car.y = 1100;
      car.angle = Math.PI / 2; // south down the avenue, clear stretch
      car.speed = 420;
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
    }
    p.hp = 100;
    G.wanted = 3;
    G.wantedTimer = 0;
    const cop1 = E.spawnCopCar(p.x, p.y);
    cop1.x = p.x - 30;
    cop1.y = p.y - 260;
    cop1.angle = Math.PI / 2;
    cop1.speed = 430;
    const cop2 = E.spawnCopCar(p.x, p.y);
    cop2.x = p.x + 40;
    cop2.y = p.y - 330;
    cop2.angle = Math.PI / 2;
    cop2.speed = 430;
  } else if (shot === 'foot') {
    // On foot on a busy avenue: traffic, pedestrians, the Gun Barn ahead.
    M.startMission(0);
    M.dialogue = null;
    p.x = 1000;
    p.y = 1560;
    p.angle = -Math.PI / 2;
    p.hasPistol = true;
    p.weapon = 'pistol';
    p.ammo = 12;
    p.reserveAmmo = 24;
    G.wanted = 0;
    for (let i = 0; i < 6; i++) {
      const ped = E.peds[i];
      if (ped) {
        ped.x = 920 + i * 44;
        ped.y = 1470 + (i % 3) * 55;
        ped.state = 'walk';
      }
    }
    G.camera.x = p.x;
    G.camera.y = p.y;
  } else if (shot === 'mission') {
    // Mission 5: outside the bank with the vault cracked, four stars, cops
    // closing in, the safehouse marker on the map.
    M.startMission(4);
    M.dialogue = null;
    M.step = 1;
    M.vaultHeat = true;
    p.x = L.bank.x;
    p.y = L.bank.y + 110;
    p.angle = Math.PI / 2;
    p.hasPistol = true;
    p.weapon = 'pistol';
    p.ammo = 9;
    p.reserveAmmo = 12;
    p.hp = 72;
    G.wanted = 4;
    G.cash = 2740;
    const cop1 = E.spawnCopCar(p.x, p.y);
    cop1.x = p.x + 420;
    cop1.y = p.y - 140;
    cop1.speed = 400;
    const cop2 = E.spawnCopCar(p.x, p.y);
    cop2.x = p.x - 380;
    cop2.y = p.y + 160;
    cop2.speed = 400;
    E.spawnFootCop(p.x + 180, p.y + 90);
  }
  // Let one frame of traffic settle before the shot is taken, then put the
  // camera on the player — the settle steps move the cars, so centring the
  // camera first would leave the player off-screen.
  for (let i = 0; i < 30; i++) {
    E.update(1 / 60, { ...G, input: G.input, hooks: G.hooks, world: G.world, wanted: G.wanted, mouseWorld: G.mouseWorld, policeSight: () => false });
  }
  // The settle steps can bounce the player's car off crossing traffic; put
  // it back at chase speed so the shot reads as a chase, not a pile-up.
  if (p.inCar) p.inCar.speed = 380;
  for (const c of E.cars) if (c.driver === 'police') c.speed = 400;
  G.camera.x = clampCam(p.x, p);
  G.camera.y = clampCamY(p.y, p);
}

function clampCam(x, p) {
  return Math.max(640, Math.min(WORLD.width - 640, x));
}

function clampCamY(y, p) {
  return Math.max(360, Math.min(WORLD.height - 360, y));
}
