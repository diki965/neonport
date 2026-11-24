// Solport's city and its simulation: roads, buildings, places, traffic,
// pedestrians, police, cars, bullets and the wanted system. All state lives
// in one `world` object created from a seed, so a staged screenshot can
// rebuild the exact same city and play the real rules forward.

import { WORLD, PLAYER, CAR, PISTOL, WANTED, MONEY } from './config.js';
import { makeRng, pick, range, intRange } from './random.js';

export const ROAD_W = 96;
const BLOCK = 350;

function onRoad(x, y) {
  if (x < 260) return false;
  const rx = (x - 260) % BLOCK;
  const ry = y % BLOCK;
  return (rx < ROAD_W || ry < ROAD_W);
}

function roadCentre(v) {
  return v - ((v - 260) % BLOCK) + ROAD_W / 2;
}

function nearestRoadPoint(x, y) {
  const cx = roadCentre(x);
  const cy = Math.floor(y / BLOCK) * BLOCK + ROAD_W / 2;
  const dx = Math.abs(cx - x);
  const dy = Math.abs(cy - y);
  return dx < dy ? { x: cx, y } : { x, y: cy };
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function createWorld(seed) {
  const rng = makeRng(seed);
  const world = {
    seed,
    rng,
    time: 0,
    buildings: [],
    trees: [],
    parked: [],
    traffic: [],
    peds: [],
    cops: [],
    bullets: [],
    particles: [],
    pickups: [],
    wanted: 0,
    heat: 0,
    copTimer: 0,
    events: [],
    player: null,
    car: null,
    taxiFare: null,
  };

  // City blocks: buildings fill the space between roads; some blocks are parks.
  for (let bx = 0; bx < 7; bx += 1) {
    for (let by = 0; by < 5; by += 1) {
      const x0 = 260 + bx * BLOCK + ROAD_W + 14;
      const y0 = by * BLOCK + ROAD_W + 14;
      const w = BLOCK - ROAD_W - 28;
      const h = BLOCK - ROAD_W - 28;
      if (rng() < 0.16) {
        for (let t = 0; t < 5; t += 1) {
          world.trees.push({ x: x0 + rng() * w, y: y0 + rng() * h, r: 12 + rng() * 10 });
        }
        continue;
      }
      const n = 1 + Math.floor(rng() * 2);
      for (let i = 0; i < n; i += 1) {
        const bw = w / n - 12;
        world.buildings.push({
          x: x0 + i * (w / n) + 4,
          y: y0 + 6,
          w: bw,
          h: h - 12,
          color: pick(rng, ['#b0563e', '#c07a3e', '#7d8aa0', '#a03e5c', '#4e7d6b', '#8a6fb0', '#5b7fa6']),
          roof: pick(rng, ['#6e3a2c', '#54423a', '#3a4a5a']),
        });
      }
    }
  }

  // Named places (door positions the player walks to).
  world.places = {
    safehouse: { x: 470, y: 1798, name: 'Safehouse', color: '#2e86de' },
    gunbarn: { x: 1150, y: 380, name: 'Gun Barn', color: '#c0392b' },
    clinic: { x: 1500, y: 1080, name: 'Clinic', color: '#27ae60' },
    respray: { x: 2200, y: 730, name: 'Respray', color: '#8e44ad' },
    garage: { x: 800, y: 1430, name: 'Garage', color: '#e67e22' },
    bank: { x: 2550, y: 380, name: 'Bank of Solport', color: '#c9a227' },
    marina: { x: 200, y: 900, name: 'Marina', color: '#2e7f9e' },
    market: { x: 1850, y: 1780, name: 'Market', color: '#16a085' },
  };

  // Parked cars along the roads, some taxis.
  for (let i = 0; i < 26; i += 1) {
    const vertical = rng() < 0.5;
    const road = 1 + Math.floor(rng() * 6);
    const along = range(rng, 300, WORLD.height - 300);
    const taxi = rng() < 0.18;
    world.parked.push({
      x: vertical ? 260 + road * BLOCK + ROAD_W / 2 + (rng() < 0.5 ? -24 : 24) : range(rng, 400, WORLD.width - 100),
      y: vertical ? along : Math.floor(along / BLOCK) * BLOCK + ROAD_W / 2 + (rng() < 0.5 ? -24 : 24),
      angle: vertical ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2),
      color: taxi ? '#f5c542' : pick(rng, ['#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#e67e22', '#16a085', '#d5dbdb', '#7f8c8d']),
      taxi,
      speed: 0,
      taken: false,
    });
  }

  // Traffic cars cruising the roads.
  for (let i = 0; i < 14; i += 1) {
    const vertical = rng() < 0.5;
    const road = 1 + Math.floor(rng() * 6);
    world.traffic.push({
      x: vertical ? 260 + road * BLOCK + ROAD_W / 2 : range(rng, 400, WORLD.width - 100),
      y: vertical ? range(rng, 100, WORLD.height - 100) : Math.floor(range(rng, 100, WORLD.height - 100) / BLOCK) * BLOCK + ROAD_W / 2,
      angle: vertical ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2),
      color: pick(rng, ['#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#e67e22', '#16a085', '#d5dbdb']),
      speed: range(rng, 140, 220),
      taxi: false,
    });
  }

  // Pedestrians on the roads' edges (never inside buildings, where they
  // would be stuck and drawn through roofs).
  for (let i = 0; i < 46; i += 1) {
    const vertical = rng() < 0.5;
    const road = 1 + Math.floor(rng() * 6);
    world.peds.push({
      x: vertical ? 260 + road * BLOCK + ROAD_W / 2 + (rng() < 0.5 ? -34 : 34) : range(rng, 300, WORLD.width - 60),
      y: vertical ? range(rng, 100, WORLD.height - 100) : Math.floor(range(rng, 100, WORLD.height - 100) / BLOCK) * BLOCK + ROAD_W / 2 + (rng() < 0.5 ? -34 : 34),
      angle: rng() * Math.PI * 2,
      speed: range(rng, 40, 80),
      color: pick(rng, ['#e74c3c', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#f39c12']),
      alive: true,
      flee: 0,
      hail: rng() < 0.14,
    });
  }

  world.player = {
    // Spawn on the road by the Safehouse — never inside a city block,
    // where the buildings would pin the player in place.
    x: 470, y: 1760, angle: -Math.PI / 2, vx: 0, vy: 0,
    health: PLAYER.health, hasPistol: false, ammo: 0,
    cash: MONEY.start, inCar: null, fistTimer: 0, shootTimer: 0,
    invulnerable: 0, dead: false, busted: false,
  };
  return world;
}

function collideBuildings(world, x, y, r) {
  for (const b of world.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
  }
  return false;
}

function clampWorld(p) {
  p.x = Math.max(30, Math.min(WORLD.width - 30, p.x));
  p.y = Math.max(30, Math.min(WORLD.height - 30, p.y));
}

export function addWanted(world, n) {
  world.wanted = Math.min(WANTED.max, world.wanted + n);
  world.heat = 1;
}

export function spawnCop(world, near) {
  const p = nearestRoadPoint(near.x + (world.rng() < 0.5 ? -260 : 260), near.y);
  if (world.rng() < 0.5 || world.wanted < 2) {
    world.cops.push({ x: p.x, y: p.y, angle: 0, speed: 0, onFoot: true, health: 60, shootTimer: 1 + world.rng() });
  } else {
    world.cops.push({
      x: p.x, y: p.y, angle: 0, speed: 0, onFoot: false,
      color: '#1f2a3a', health: 120, shootTimer: 0,
    });
  }
}

function stepPlayer(world, input, dt, fire) {
  const p = world.player;
  if (p.dead || p.busted) return;
  p.fistTimer = Math.max(0, p.fistTimer - dt);
  p.shootTimer = Math.max(0, p.shootTimer - dt);
  p.invulnerable = Math.max(0, p.invulnerable - dt);

  if (p.inCar) {
    const car = p.inCar;
    const fwd = (input.held.up ? 1 : 0) - (input.held.down ? 0.6 : 0);
    const steer = (input.held.left ? 1 : 0) - (input.held.right ? 1 : 0);
    const moving = Math.abs(car.speed) > 20;
    // Screen coordinates have y down, so the angle grows clockwise: turning
    // left (counterclockwise) DECREASES it. Reversing flips the steering.
    if (moving) car.angle -= steer * CAR.steer * dt * Math.sign(car.speed) * (input.held.brake ? 1.6 : 1);
    if (input.held.brake) {
      car.speed -= Math.sign(car.speed) * CAR.brake * dt;
      if (Math.abs(car.speed) < 30) car.speed = 0;
    } else if (fwd > 0) {
      car.speed = Math.min(CAR.maxSpeed, car.speed + CAR.accel * dt);
    } else if (fwd < 0) {
      car.speed = Math.max(-CAR.maxReverse, car.speed - CAR.reverseAccel * dt);
    } else {
      car.speed -= car.speed * 1.4 * dt;
      if (Math.abs(car.speed) < 8) car.speed = 0;
    }
    // Axis-separated movement so a car slides along walls instead of
    // dead-stopping on them: the autopilot (and the player) can grind
    // around a corner instead of getting wedged on it.
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    if (!collideBuildings(world, nx, car.y, 24)) car.x = nx;
    else car.speed *= 0.5;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (!collideBuildings(world, car.x, ny, 24)) car.y = ny;
    else car.speed *= 0.5;
    clampWorld(car);
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    // Ramming peds and cops while speeding.
    if (Math.abs(car.speed) > 260) {
      for (const ped of world.peds) {
        if (ped.alive && dist(ped, car) < 40) {
          ped.alive = false;
          addWanted(world, WANTED.hitPed);
          world.events.push({ type: 'pedDown' });
        }
      }
      for (const cop of world.cops) {
        if (cop.onFoot && dist(cop, car) < 44) {
          cop.health = 0;
          addWanted(world, WANTED.killCop);
          world.events.push({ type: 'copDown' });
        }
      }
    }
    return;
  }

  let mx = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
  let my = (input.held.down ? 1 : 0) - (input.held.up ? 1 : 0);
  const len = Math.hypot(mx, my);
  if (len > 0) { mx /= len; my /= len; }
  const speed = input.held.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  p.vx += (mx * speed - p.vx) * Math.min(1, PLAYER.accel * dt / speed);
  p.vy += (my * speed - p.vy) * Math.min(1, PLAYER.accel * dt / speed);
  const nx = p.x + p.vx * dt;
  const ny = p.y + p.vy * dt;
  if (!collideBuildings(world, nx, p.y, PLAYER.radius)) p.x = nx;
  if (!collideBuildings(world, p.x, ny, PLAYER.radius)) p.y = ny;
  clampWorld(p);
  if (len > 0) p.angle = Math.atan2(my, mx);

  // Fist fight: nearest ped or cop in range.
  if (input.pressed.interact && p.fistTimer <= 0) {
    p.fistTimer = PLAYER.fistRate;
    const targets = [...world.peds.filter((q) => q.alive), ...world.cops.filter((q) => q.health > 0)];
    for (const t of targets) {
      if (dist(t, p) < PLAYER.fistRange) {
        if (t.alive !== undefined) { t.alive = false; addWanted(world, WANTED.hitPed); }
        else { t.health -= PLAYER.fistDamage; if (t.health <= 0) addWanted(world, WANTED.killCop); }
        world.events.push({ type: 'punch' });
        break;
      }
    }
  }
  // Pistol: aim with the mouse, click to fire.
  if (p.hasPistol && p.ammo > 0 && input.mouse.clicked && p.shootTimer <= 0) {
    p.shootTimer = PISTOL.rate;
    p.ammo -= 1;
    fire(p);
    addWanted(world, WANTED.shoot);
  }
}

function stepTraffic(world, dt) {
  for (const c of world.traffic) {
    const vertical = Math.abs(Math.cos(c.angle)) < 0.5;
    let blocked = false;
    for (const o of [...world.traffic, ...world.cops.filter((k) => !k.onFoot)]) {
      if (o === c) continue;
      const d = dist(o, c);
      if (d < 70) {
        const ahead = (o.x - c.x) * Math.cos(c.angle) + (o.y - c.y) * Math.sin(c.angle);
        if (ahead > 0 && ahead < 70) { blocked = true; break; }
      }
    }
    const sp = blocked ? 0 : c.speed;
    const nx = c.x + Math.cos(c.angle) * sp * dt;
    const ny = c.y + Math.sin(c.angle) * sp * dt;
    if (nx < 300 || nx > WORLD.width - 40 || ny < 40 || ny > WORLD.height - 40 || collideBuildings(world, nx, ny, 24)) {
      // Turn around at the map edge.
      c.angle += Math.PI;
      continue;
    }
    c.x = nx; c.y = ny;
    void vertical;
  }
}

function stepPeds(world, dt) {
  const p = world.player;
  for (const ped of world.peds) {
    if (!ped.alive) continue;
    if (ped.flee > 0) {
      ped.flee -= dt;
      const a = Math.atan2(ped.y - p.y, ped.x - p.x);
      ped.x += Math.cos(a) * 150 * dt;
      ped.y += Math.sin(a) * 150 * dt;
    } else {
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      if (world.rng() < dt * 0.3) ped.angle = world.rng() * Math.PI * 2;
      if (collideBuildings(world, ped.x, ped.y, 10) || ped.x < 280 || ped.x > WORLD.width - 40 || ped.y < 40 || ped.y > WORLD.height - 40) {
        ped.angle += Math.PI / 2;
        ped.x = Math.max(280, Math.min(WORLD.width - 40, ped.x));
        ped.y = Math.max(40, Math.min(WORLD.height - 40, ped.y));
      }
    }
    if (dist(ped, p) < 260 && world.wanted > 0) ped.flee = 2;
  }
}

function stepCops(world, dt) {
  const p = world.player;
  // Spawn pressure while wanted.
  if (world.wanted > 0) {
    world.copTimer -= dt;
    if (world.copTimer <= 0 && world.cops.length < Math.min(WANTED.maxCops, world.wanted + 2)) {
      spawnCop(world, p);
      world.copTimer = WANTED.copSpawnInterval;
    }
    world.heat += dt;
    if (world.heat > WANTED.decaySeconds && world.cops.length === 0) {
      world.wanted = Math.max(0, world.wanted - 1);
      world.heat = 0;
    }
  }
  for (const cop of world.cops) {
    if (cop.health <= 0) continue;
    const d = dist(cop, p);
    if (cop.onFoot) {
      const a = Math.atan2(p.y - cop.y, p.x - cop.x);
      cop.angle = a;
      const sp = 240 + world.wanted * 12;
      cop.x += Math.cos(a) * sp * dt;
      cop.y += Math.sin(a) * sp * dt;
      // Foot cops shoot when close and the player is on foot.
      if (d < 420 && !p.inCar) {
        cop.shootTimer -= dt;
        if (cop.shootTimer <= 0) {
          cop.shootTimer = 1.1;
          if (p.invulnerable <= 0) {
            p.health -= 9;
            world.events.push({ type: 'hurt' });
            p.invulnerable = 0.4;
          }
        }
      }
      if (d < WANTED.bustRadius && !p.inCar && Math.hypot(p.vx, p.vy) < 60) {
        p.busted = true;
        world.events.push({ type: 'busted' });
      }
    } else {
      // Police car: chase and ram.
      const a = Math.atan2(p.y - cop.y, p.x - cop.x);
      let da = a - cop.angle;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      cop.angle += Math.max(-3 * dt, Math.min(3 * dt, da));
      cop.speed = Math.min(520, (cop.speed || 0) + 420 * dt);
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
      clampWorld(cop);
      if (d < 46) {
        if (p.inCar) {
          p.inCar.speed *= 0.4;
          if (p.invulnerable <= 0) { p.health -= 6; p.invulnerable = 0.5; }
        } else if (Math.hypot(p.vx, p.vy) < 60) {
          p.busted = true;
          world.events.push({ type: 'busted' });
        }
      }
    }
  }
  world.cops = world.cops.filter((c) => c.health > 0);
}

function stepBullets(world, dt) {
  for (const b of world.bullets) {
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.life -= dt;
    if (collideBuildings(world, b.x, b.y, 2)) b.life = 0;
    for (const cop of world.cops) {
      if (cop.health > 0 && dist(cop, b) < 26) {
        cop.health -= PISTOL.damage;
        b.life = 0;
        if (cop.health <= 0) addWanted(world, WANTED.killCop);
        world.events.push({ type: 'hit' });
        break;
      }
    }
    for (const ped of world.peds) {
      if (ped.alive && dist(ped, b) < 18) {
        ped.alive = false;
        b.life = 0;
        addWanted(world, WANTED.hitPed);
        world.events.push({ type: 'hit' });
        break;
      }
    }
  }
  world.bullets = world.bullets.filter((b) => b.life > 0 && b.x > 0 && b.x < WORLD.width && b.y > 0 && b.y < WORLD.height);
}

export function stepWorld(world, input, dt, fire) {
  world.time += dt;
  stepPlayer(world, input, dt, fire);
  stepTraffic(world, dt);
  stepPeds(world, dt);
  stepCops(world, dt);
  stepBullets(world, dt);
  for (const pt of world.particles) { pt.life -= dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; }
  world.particles = world.particles.filter((pt) => pt.life > 0);
  const p = world.player;
  if (p.health <= 0 && !p.dead) { p.dead = true; world.events.push({ type: 'dead' }); }
  if (world.taxiFare) {
    const fare = world.taxiFare;
    if (dist(p, fare.dest) < 60) {
      p.cash += fare.pay;
      world.events.push({ type: 'fare', amount: fare.pay });
      world.taxiFare = null;
    }
  }
}

export function nearestParked(world, x, y, maxD) {
  let best = null;
  let bestD = maxD;
  for (const c of world.parked) {
    if (c.taken) continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

export function nearestPlace(world, x, y, maxD) {
  let best = null;
  let bestD = maxD;
  for (const [id, place] of Object.entries(world.places)) {
    const d = Math.hypot(place.x - x, place.y - y);
    if (d < bestD) { bestD = d; best = { id, ...place }; }
  }
  return best;
}
