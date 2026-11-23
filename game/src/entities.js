// Every moving thing in Solport: the player on foot or in a car, traffic cars,
// pedestrians, police cars and foot cops, plus particles and skid marks. The
// update takes a hooks object so missions and the wanted system can react to
// crimes without this file importing them.
import { PLAYER, CAR, WANTED, TRAFFIC, WORLD, PISTOL } from './config.js';
import { createRandom, pick, range, clamp, angleLerp, dist } from './random.js';
import { AVENUES, STREETS, ROAD_W, collideCircle, isRoad, isWater, inBounds, randomRoadPoint, randomSidewalkPoint } from './world.js';

const CAR_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#2c3e50', '#fd79a8', '#00cec9'];
const CAR_TYPES = [
  { name: 'Sedan', w: 46, h: 22, top: 470 },
  { name: 'Taxi', w: 46, h: 22, top: 470, taxi: true },
  { name: 'Sports', w: 48, h: 21, top: 560 },
  { name: 'Truck', w: 58, h: 26, top: 380 },
  { name: 'Van', w: 52, h: 24, top: 420 },
];
const PED_SHIRTS = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#fd79a8'];
const PED_SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

export function createEntities(world, audio) {
  const rand = createRandom(1337);
  const safe = world.locations.safehouse;
  const E = {
    player: {
      x: safe.x, y: safe.y + 60, angle: -Math.PI / 2, hp: PLAYER.health,
      inCar: null, weapon: 'fists', ammo: 0, reserveAmmo: 0, hasPistol: false,
      speed: 0, lastDamage: -99, bustTimer: 0, dead: false, punchTimer: 0, fireTimer: 0,
    },
    cars: [],
    peds: [],
    footCops: [],
    particles: [],
    skids: [],
    pickups: [],
    time: 0,
  };

  function makeCar(x, y, angle, opts = {}) {
    const type = opts.type || pick(rand, CAR_TYPES);
    const car = {
      x, y, angle, speed: 0, steer: 0,
      color: opts.color || (type.taxi ? '#ffe135' : pick(rand, CAR_COLORS)),
      type, hp: CAR.health,
      driver: opts.driver || 'npc', // npc | player | police | none
      target: null, wait: 0, smoking: false, dead: false,
      id: Math.floor(rand() * 1e9),
    };
    E.cars.push(car);
    return car;
  }

  function makePed(x, y, opts = {}) {
    const ped = {
      x, y, angle: range(rand, 0, Math.PI * 2), speed: 0,
      shirt: pick(rand, PED_SHIRTS), skin: pick(rand, PED_SKINS),
      target: randomSidewalkPoint(rand), state: 'walk', // walk | flee | down | driver
      fleeX: 0, fleeY: 0, downTimer: 0, thug: !!opts.thug, hp: opts.thug ? 60 : 20,
      id: Math.floor(rand() * 1e9),
    };
    E.peds.push(ped);
    return ped;
  }

  // Seed the city: parked cars, moving traffic, pedestrians on the sidewalks.
  for (let i = 0; i < TRAFFIC.cars; i++) {
    const p = randomRoadPoint(rand);
    const angle = p.vertical ? (rand() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rand() < 0.5 ? 0 : Math.PI);
    const car = makeCar(p.x + range(rand, -14, 14), p.y + range(rand, -14, 14), angle);
    car.speed = range(rand, 80, TRAFFIC.carSpeed);
    car.target = randomRoadPoint(rand);
    if (i < 8) { car.driver = 'none'; car.speed = 0; } // parked cars to steal
  }
  for (let i = 0; i < TRAFFIC.peds; i++) {
    const p = randomSidewalkPoint(rand);
    makePed(p.x, p.y);
  }
  // A sports car parked by the safehouse, for the first mission.
  makeCar(safe.x + 40, safe.y + 90, 0, { type: CAR_TYPES[2], color: '#e74c3c', driver: 'none' });
  // Health pickup at the clinic, ammo at the gun store.
  E.pickups.push({ x: world.locations.clinic.x, y: world.locations.clinic.y + 70, kind: 'health', amount: 50 });
  E.pickups.push({ x: world.locations.gunstore.x, y: world.locations.gunstore.y + 70, kind: 'ammo', amount: 24 });

  function addParticles(x, y, n, color, speed, life = 0.6) {
    for (let i = 0; i < n; i++) {
      const a = range(rand, 0, Math.PI * 2);
      const s = range(rand, speed * 0.3, speed);
      E.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: range(rand, life * 0.5, life), maxLife: life, color, size: range(rand, 2, 5) });
    }
    if (E.particles.length > 400) E.particles.splice(0, E.particles.length - 400);
  }

  function addSkid(x, y, angle) {
    E.skids.push({ x, y, angle, life: 6 });
    if (E.skids.length > 240) E.skids.shift();
  }

  function damageCar(car, amount, hooks) {
    if (car.dead) return;
    car.hp -= amount;
    if (car.hp <= 0) {
      car.dead = true;
      car.hp = 0;
      addParticles(car.x, car.y, 40, '#ff9f1c', 260, 1.0);
      addParticles(car.x, car.y, 24, '#555', 120, 1.4);
      audio.explosion();
      if (hooks) hooks.onExplosion?.(car.x, car.y);
      if (car.driver === 'player') {
        E.player.inCar = null;
        E.player.x = car.x + 30;
        E.player.y = car.y + 30;
      }
      car.driver = 'none';
    } else if (car.hp < 35 && !car.smoking) {
      car.smoking = true;
    }
  }

  function nearestCar(x, y, maxD) {
    let best = null;
    let bestD = maxD;
    for (const c of E.cars) {
      if (c.dead) continue;
      const d = dist(x, y, c.x, c.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  function nearestPed(x, y, maxD) {
    let best = null;
    let bestD = maxD;
    for (const p of E.peds) {
      if (p.state === 'down') continue;
      const d = dist(x, y, p.x, p.y);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  function witnessNearby(x, y, range_) {
    return E.peds.some((p) => p.state !== 'down' && dist(x, y, p.x, p.y) < range_) ||
      E.cars.some((c) => c.driver === 'police' && dist(x, y, c.x, c.y) < range_) ||
      E.footCops.some((c) => dist(x, y, c.x, c.y) < range_);
  }

  // --- player actions -------------------------------------------------------
  function tryEnterCar(hooks) {
    const p = E.player;
    const car = nearestCar(p.x, p.y, 56);
    if (!car) return false;
    audio.carDoor();
    if (car.driver === 'npc') {
      // Yank the driver out onto the sidewalk.
      const out = makePed(car.x + 26, car.y + 26);
      out.state = 'flee';
      out.fleeX = car.x + 200;
      out.fleeY = car.y + 200;
      if (witnessNearby(car.x, car.y, 260)) {
        hooks.onCrime?.('steal', CAR.stealWanted);
      }
      hooks.onCarStolen?.(car);
    } else if (car.driver === 'police') {
      hooks.onCrime?.('steal', 2);
    }
    car.driver = 'player';
    p.inCar = car;
    p.x = car.x;
    p.y = car.y;
    return true;
  }

  function exitCar() {
    const p = E.player;
    if (!p.inCar) return;
    const car = p.inCar;
    car.driver = 'none';
    car.speed *= 0.2;
    p.inCar = null;
    // Step out to the side of the car, on the road if possible.
    p.x = car.x - Math.sin(car.angle) * 34;
    p.y = car.y + Math.cos(car.angle) * 34;
    p.angle = car.angle;
    audio.carDoor();
  }

  function shootAt(wx, wy, hooks) {
    const p = E.player;
    if (p.weapon !== 'pistol' || !p.hasPistol || p.ammo <= 0) return;
    if (p.fireTimer > 0) return;
    p.fireTimer = PISTOL.fireInterval;
    p.ammo -= 1;
    audio.shoot();
    const a = Math.atan2(wy - p.y, wx - p.x) + range(rand, -PISTOL.spread, PISTOL.spread);
    const ex = p.x + Math.cos(a) * PISTOL.range;
    const ey = p.y + Math.sin(a) * PISTOL.range;
    E.particles.push({ x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20, vx: 0, vy: 0, life: 0.06, maxLife: 0.06, color: '#ffe135', size: 6, tracer: { x: ex, y: ey } });
    // Hit the first ped, thug, cop or car along the shot.
    let bestD = PISTOL.range;
    let hit = null;
    for (const ped of E.peds) {
      if (ped.state === 'down') continue;
      const d = distToSegment(ped.x, ped.y, p.x, p.y, ex, ey);
      if (d < 16) {
        const along = (ped.x - p.x) * Math.cos(a) + (ped.y - p.y) * Math.sin(a);
        if (along > 0 && along < bestD) { bestD = along; hit = { kind: 'ped', ped }; }
      }
    }
    for (const cop of E.footCops) {
      const d = distToSegment(cop.x, cop.y, p.x, p.y, ex, ey);
      if (d < 16) {
        const along = (cop.x - p.x) * Math.cos(a) + (cop.y - p.y) * Math.sin(a);
        if (along > 0 && along < bestD) { bestD = along; hit = { kind: 'cop', cop }; }
      }
    }
    for (const car of E.cars) {
      if (car.dead || car.driver === 'player') continue;
      const d = distToSegment(car.x, car.y, p.x, p.y, ex, ey);
      if (d < 24) {
        const along = (car.x - p.x) * Math.cos(a) + (car.y - p.y) * Math.sin(a);
        if (along > 0 && along < bestD) { bestD = along; hit = { kind: 'car', car }; }
      }
    }
    if (hit) {
      addParticles(p.x + Math.cos(a) * bestD, p.y + Math.sin(a) * bestD, 8, '#ff5d5d', 160, 0.4);
      audio.hit();
      if (hit.kind === 'ped') {
        hit.ped.hp -= PISTOL.damage;
        if (hit.ped.hp <= 0) {
          hit.ped.state = 'down';
          hit.ped.downTimer = 999;
          hooks.onPedDown?.(hit.ped);
          if (!hit.ped.thug) hooks.onCrime?.('kill', 1);
        } else {
          hit.ped.state = 'flee';
          hit.ped.fleeX = hit.ped.x + (hit.ped.x - p.x);
          hit.ped.fleeY = hit.ped.y + (hit.ped.y - p.y);
        }
      } else if (hit.kind === 'cop') {
        hit.cop.hp -= PISTOL.damage;
        hooks.onCrime?.('shootCop', 1);
        if (hit.cop.hp <= 0) hit.cop.dead = true;
      } else if (hit.kind === 'car') {
        damageCar(hit.car, PISTOL.damage, hooks);
        if (hit.car.driver === 'police') hooks.onCrime?.('shootCop', 1);
      }
    }
    if (witnessNearby(p.x, p.y, 300)) hooks.onCrime?.('shots', 1);
  }

  function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((px - x1) * dx + (py - y1) * dy) / len2;
    t = clamp(t, 0, 1);
    return dist(px, py, x1 + dx * t, y1 + dy * t);
  }

  // --- police ---------------------------------------------------------------
  function spawnCopCar(px, py, hooks) {
    const p = randomRoadPoint(rand);
    // Spawn a few blocks away, on a road, so the siren approaches.
    const a = Math.atan2(py - p.y, px - p.x);
    const car = makeCar(
      clamp(px + Math.cos(a + Math.PI) * 700, 80, WORLD.width - 80),
      clamp(py + Math.sin(a + Math.PI) * 700, 80, WORLD.beachY - 80),
      a, { type: CAR_TYPES[0], color: '#1c2733', driver: 'police' },
    );
    car.speed = 300;
    return car;
  }

  function spawnFootCop(px, py) {
    const a = range(rand, 0, Math.PI * 2);
    const cop = {
      x: clamp(px + Math.cos(a) * 320, 40, WORLD.width - 40),
      y: clamp(py + Math.sin(a) * 320, 40, WORLD.beachY - 40),
      angle: 0, speed: 0, hp: 60, dead: false, fireTimer: range(rand, 0, 1),
    };
    E.footCops.push(cop);
    return cop;
  }

  // --- per-frame update -----------------------------------------------------
  function update(dt, G) {
    E.time += dt;
    const p = E.player;
    const input = G.input;
    const hooks = G.hooks;
    p.fireTimer = Math.max(0, p.fireTimer - dt);
    p.punchTimer = Math.max(0, p.punchTimer - dt);

    // Health regen after a quiet stretch.
    if (E.time - p.lastDamage > PLAYER.regenDelay && p.hp > 0 && p.hp < PLAYER.health) {
      p.hp = Math.min(PLAYER.health, p.hp + PLAYER.regenRate * dt);
    }

    if (p.inCar) {
      updatePlayerCar(dt, G);
    } else {
      updatePlayerFoot(dt, G);
    }

    updateTraffic(dt, G);
    updatePeds(dt, G);
    updatePolice(dt, G);
    updateParticles(dt);
    updatePickups(dt, G);
  }

  function updatePlayerFoot(dt, G) {
    const p = E.player;
    const input = G.input;
    const hooks = G.hooks;
    const ax = input.axis();
    const running = input.down('shift');
    const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
    let vx = ax.x * speed;
    let vy = ax.y * speed;
    if (vx !== 0 && vy !== 0) { vx *= 0.7071; vy *= 0.7071; }
    p.speed = Math.hypot(vx, vy);
    let nx = p.x + vx * dt;
    let ny = p.y + vy * dt;
    const hit = collideCircle(G.world.buildings, nx, ny, PLAYER.radius);
    nx = hit.x; ny = hit.y;
    if (isWater(nx, ny)) { nx = p.x; ny = p.y; }
    if (!inBounds(nx, ny, 24)) { nx = clamp(nx, 24, WORLD.width - 24); ny = clamp(ny, 24, WORLD.height - 24); }
    p.x = nx; p.y = ny;
    if (p.speed > 10) p.angle = Math.atan2(vy, vx);

    // Aim follows the mouse.
    const m = G.mouseWorld();
    p.aim = Math.atan2(m.y - p.y, m.x - p.x);

    if (input.wasPressed('e')) tryEnterCar(hooks);
    if (input.wasPressed('1')) p.weapon = 'fists';
    if (input.wasPressed('2') && p.hasPistol) p.weapon = 'pistol';

    // Punch: F, or click while unarmed. Shoot: click while armed.
    if (input.wasPressed('f') || (input.mousePressed && p.weapon === 'fists')) {
      if (p.punchTimer <= 0) {
        p.punchTimer = 0.35;
        audio.punch();
        const target = nearestPed(p.x + Math.cos(p.aim) * 26, p.y + Math.sin(p.aim) * 26, PLAYER.punchRange);
        const cop = E.footCops.find((c) => !c.dead && dist(p.x, p.y, c.x, c.y) < PLAYER.punchRange + 14);
        if (target) {
          target.hp -= PLAYER.punchDamage;
          addParticles(target.x, target.y, 6, '#ffe135', 140, 0.3);
          if (target.hp <= 0) {
            target.state = 'down';
            target.downTimer = 999;
            hooks.onPedDown?.(target);
            if (!target.thug) hooks.onCrime?.('kill', 1);
          } else {
            target.state = 'flee';
            target.fleeX = target.x + (target.x - p.x) * 2;
            target.fleeY = target.y + (target.y - p.y) * 2;
          }
        } else if (cop) {
          cop.hp -= PLAYER.punchDamage;
          if (cop.hp <= 0) cop.dead = true;
          hooks.onCrime?.('hitCop', 1);
        }
      }
    }
    if (input.mouseDown && p.weapon === 'pistol') {
      shootAt(m.x, m.y, hooks);
    }
  }

  function updatePlayerCar(dt, G) {
    const p = E.player;
    const car = p.inCar;
    const input = G.input;
    const hooks = G.hooks;
    const ax = input.axis();
    const throttle = -ax.y; // W = forward
    const steerInput = ax.x;
    const handbrake = input.down('space');

    if (throttle > 0) car.speed += CAR.accel * dt;
    else if (throttle < 0) {
      if (car.speed > 10) car.speed -= CAR.brake * dt;
      else car.speed -= CAR.reverseAccel * dt;
    }
    car.speed -= car.speed * CAR.drag * dt;
    if (handbrake) {
      car.speed -= car.speed * 2.2 * dt;
      addSkid(car.x - Math.cos(car.angle) * 18, car.y - Math.sin(car.angle) * 18, car.angle);
    }
    car.speed = clamp(car.speed, -CAR.topReverse, car.type.top);
    const steerAmount = steerInput * CAR.steer * clamp(Math.abs(car.speed) / 160, 0, 1) * (car.speed < 0 ? -1 : 1) * (handbrake ? 1.5 : 1);
    car.angle += steerAmount * dt;
    // Grip: velocity follows the heading, with a little drift.
    const fx = Math.cos(car.angle);
    const fy = Math.sin(car.angle);
    car.x += fx * car.speed * dt;
    car.y += fy * car.speed * dt;
    car.steer = steerInput;

    // Collide with buildings (two circles: nose and tail).
    for (const s of [16, -16]) {
      const cx = car.x + fx * s;
      const cy = car.y + fy * s;
      const hit = collideCircle(G.world.buildings, cx, cy, 15);
      if (hit.hit) {
        const pushX = hit.x - cx;
        const pushY = hit.y - cy;
        car.x += pushX;
        car.y += pushY;
        if (Math.abs(car.speed) > 120) {
          damageCar(car, Math.abs(car.speed) * 0.06, hooks);
          audio.crash();
          addParticles(cx, cy, 8, '#ccc', 140, 0.4);
          hooks.onCrime?.('crash', 0);
        }
        car.speed *= -0.25;
      }
    }
    if (isWater(car.x, car.y)) {
      car.x -= fx * car.speed * dt;
      car.y -= fy * car.speed * dt;
      car.speed *= -0.4;
    }
    car.x = clamp(car.x, 30, WORLD.width - 30);
    car.y = clamp(car.y, 30, WORLD.height - 30);
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.speed = Math.abs(car.speed);

    if (car.smoking && Math.random() < dt * 2) {
      addParticles(car.x, car.y - 6, 1, '#666', 30, 1.2);
    }
    if (input.wasPressed('e')) exitCar();
    if (input.wasPressed('f')) {
      // Drive-by: shoot out of the window at the mouse.
      if (p.hasPistol && p.weapon === 'pistol') shootAt(G.mouseWorld().x, G.mouseWorld().y, hooks);
    }
    audio.setEngine(true, Math.abs(car.speed) / CAR.topSpeed);
  }

  function updateTraffic(dt, G) {
    const p = E.player;
    for (const car of E.cars) {
      if (car.dead) continue;
      if (car.driver === 'player') continue;
      if (car.driver === 'police') {
        updateCopCar(car, dt, G);
        continue;
      }
      if (car.driver === 'none') continue; // parked
      // NPC driver: follow the road toward its target, slow for cars ahead.
      if (!car.target || dist(car.x, car.y, car.target.x, car.target.y) < 40) {
        car.target = randomRoadPoint(rand);
      }
      const want = Math.atan2(car.target.y - car.y, car.target.x - car.x);
      car.angle = angleLerp(car.angle, want, clamp(2.2 * dt, 0, 1));
      // Slow for the car ahead.
      let ahead = false;
      for (const o of E.cars) {
        if (o === car || o.dead) continue;
        const dx = o.x - car.x;
        const dy = o.y - car.y;
        const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
        const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
        if (along > 0 && along < 70 && side < 26) { ahead = true; break; }
      }
      const targetSpeed = ahead ? 0 : TRAFFIC.carSpeed;
      car.speed += (targetSpeed - car.speed) * clamp(1.5 * dt, 0, 1);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      const hit = collideCircle(G.world.buildings, car.x, car.y, 16);
      if (hit.hit) {
        car.x = hit.x; car.y = hit.y;
        car.angle += Math.PI / 2;
        car.target = randomRoadPoint(rand);
      }
      // Ran over a pedestrian? That is on the driver, not the player.
      for (const ped of E.peds) {
        if (ped.state === 'down') continue;
        if (dist(car.x, car.y, ped.x, ped.y) < 24 && Math.abs(car.speed) > 40) {
          ped.state = 'down';
          ped.downTimer = 999;
          addParticles(ped.x, ped.y, 10, '#ff5d5d', 160, 0.5);
        }
      }
    }
    // Car-car bumps.
    for (let i = 0; i < E.cars.length; i++) {
      const a = E.cars[i];
      if (a.dead) continue;
      for (let j = i + 1; j < E.cars.length; j++) {
        const b = E.cars[j];
        if (b.dead) continue;
        const d = dist(a.x, a.y, b.x, b.y);
        if (d < 40 && d > 0.01) {
          const push = (40 - d) / 2;
          const nx = (b.x - a.x) / d;
          const ny = (b.y - a.y) / d;
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
          if (a.driver === 'player' || b.driver === 'player') {
            const pc = a.driver === 'player' ? a : b;
            if (Math.abs(pc.speed) > 150) {
              damageCar(pc, 6, G.hooks);
              audio.crash();
            }
            pc.speed *= 0.6;
          }
        }
      }
    }
    // Player on foot hit by a moving car.
    if (!p.inCar && !p.dead) {
      for (const car of E.cars) {
        if (car.dead || car.driver === 'player') continue;
        if (Math.abs(car.speed) > 60 && dist(car.x, car.y, p.x, p.y) < 26) {
          hurtPlayer(30, G);
          // Knock the player aside.
          p.x += (p.x - car.x) * 0.6;
          p.y += (p.y - car.y) * 0.6;
          addParticles(p.x, p.y, 10, '#ff5d5d', 180, 0.5);
          break;
        }
      }
    }
  }

  function updateCopCar(car, dt, G) {
    const p = E.player;
    const want = Math.atan2(p.y - car.y, p.x - car.x);
    // Pursuit with a little prediction and wobble so it feels alive.
    const predX = p.x + Math.cos(p.angle) * (p.inCar ? p.inCar.speed * 0.3 : 0);
    const predY = p.y + Math.sin(p.angle) * (p.inCar ? p.inCar.speed * 0.3 : 0);
    const aim = Math.atan2(predY - car.y, predX - car.x);
    car.angle = angleLerp(car.angle, aim, clamp(2.6 * dt, 0, 1));
    const targetSpeed = dist(car.x, car.y, p.x, p.y) > 300 ? 480 : 380;
    car.speed += (targetSpeed - car.speed) * clamp(1.2 * dt, 0, 1);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    const hit = collideCircle(G.world.buildings, car.x, car.y, 16);
    if (hit.hit) {
      car.x = hit.x; car.y = hit.y;
      car.speed *= 0.4;
      car.angle = angleLerp(car.angle, want + Math.PI / 2, 0.5);
    }
    // Ram the player's car.
    if (p.inCar && dist(car.x, car.y, p.x, p.y) < 42) {
      damageCar(p.inCar, 8 * dt * 10, G.hooks);
      car.speed *= 0.7;
    }
    // On foot and close: a cop gets out and chases on foot.
    if (!p.inCar && dist(car.x, car.y, p.x, p.y) < 90 && E.footCops.length < WANTED.maxFootCops) {
      car.driver = 'none';
      car.speed = 0;
      spawnFootCop(car.x, car.y);
    }
    if (Math.random() < dt * 0.5) audio.sirenBlip();
  }

  function updatePeds(dt, G) {
    const p = E.player;
    for (const ped of E.peds) {
      if (ped.state === 'down') {
        ped.downTimer -= dt;
        continue;
      }
      if (ped.state === 'flee') {
        const a = Math.atan2(ped.fleeY - ped.y, ped.fleeX - ped.x);
        ped.angle = a;
        ped.x += Math.cos(a) * 170 * dt;
        ped.y += Math.sin(a) * 170 * dt;
        const hit = collideCircle(G.world.buildings, ped.x, ped.y, 10);
        ped.x = hit.x; ped.y = hit.y;
        if (dist(ped.x, ped.y, ped.fleeX, ped.fleeY) < 40 || dist(ped.x, ped.y, p.x, p.y) > 500) {
          ped.state = 'walk';
          ped.target = randomSidewalkPoint(rand);
        }
        continue;
      }
      if (!ped.target || dist(ped.x, ped.y, ped.target.x, ped.target.y) < 24) {
        ped.target = randomSidewalkPoint(rand);
      }
      const a = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
      ped.angle = angleLerp(ped.angle, a, clamp(4 * dt, 0, 1));
      ped.speed = TRAFFIC.pedSpeed;
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      const hit = collideCircle(G.world.buildings, ped.x, ped.y, 10);
      ped.x = hit.x; ped.y = hit.y;
      // Flee gunfire and fast cars.
      if (dist(ped.x, ped.y, p.x, p.y) < 200 && p.weapon === 'pistol' && G.input.mouseDown) {
        ped.state = 'flee';
        ped.fleeX = ped.x + (ped.x - p.x) * 2;
        ped.fleeY = ped.y + (ped.y - p.y) * 2;
      }
    }
    // Thugs (mission spawns) shoot back at the player.
    for (const ped of E.peds) {
      if (!ped.thug || ped.state === 'down') continue;
      const d = dist(ped.x, ped.y, p.x, p.y);
      if (d < 420 && !p.dead) {
        ped.fireTimer = (ped.fireTimer || 0) - dt;
        if (ped.fireTimer <= 0) {
          ped.fireTimer = range(rand, 0.9, 1.6);
          const a = Math.atan2(p.y - ped.y, p.x - ped.x) + range(rand, -0.15, 0.15);
          E.particles.push({ x: ped.x, y: ped.y, vx: 0, vy: 0, life: 0.06, maxLife: 0.06, color: '#ffe135', size: 5, tracer: { x: ped.x + Math.cos(a) * 420, y: ped.y + Math.sin(a) * 420 } });
          audio.shoot();
          if (Math.random() < 0.35) hurtPlayer(8, G);
        }
      }
    }
  }

  function updatePolice(dt, G) {
    const p = E.player;
    const wanted = G.wanted;
    // Spawn cop cars up to the wanted level.
    const copCars = E.cars.filter((c) => c.driver === 'police' && !c.dead);
    const wantCars = Math.min(wanted, WANTED.maxCopCars);
    if (copCars.length < wantCars && Math.random() < dt * 1.2) {
      spawnCopCar(p.x, p.y, G.hooks);
    }
    if (wanted === 0) {
      // Cops give up and drive off.
      for (const c of copCars) {
        c.driver = 'npc';
        c.target = randomRoadPoint(rand);
      }
      for (const cop of E.footCops) cop.dead = true;
    }
    // Foot cops chase and try to bust the player.
    for (const cop of E.footCops) {
      if (cop.dead) continue;
      const d = dist(cop.x, cop.y, p.x, p.y);
      if (p.inCar) {
        // Run back to the nearest police car.
        const car = E.cars.find((c) => c.driver === 'police' && !c.dead);
        if (car) {
          const a = Math.atan2(car.y - cop.y, car.x - cop.x);
          cop.x += Math.cos(a) * 240 * dt;
          cop.y += Math.sin(a) * 240 * dt;
          if (dist(cop.x, cop.y, car.x, car.y) < 30) cop.dead = true;
        }
        continue;
      }
      const a = Math.atan2(p.y - cop.y, p.x - cop.x);
      cop.angle = a;
      const chaseSpeed = 235;
      cop.x += Math.cos(a) * chaseSpeed * dt;
      cop.y += Math.sin(a) * chaseSpeed * dt;
      const hit = collideCircle(G.world.buildings, cop.x, cop.y, 11);
      cop.x = hit.x; cop.y = hit.y;
      if (d < 28) {
        p.bustTimer += dt;
        if (p.bustTimer >= WANTED.bustTime) {
          p.bustTimer = 0;
          G.hooks.onBusted?.();
        }
      } else {
        p.bustTimer = Math.max(0, p.bustTimer - dt * 2);
      }
      // A foot cop close enough shoots if the player is armed and wanted is high.
      if (wanted >= 3 && d < 380 && d > 60) {
        cop.fireTimer -= dt;
        if (cop.fireTimer <= 0) {
          cop.fireTimer = range(rand, 1.2, 2.0);
          const sa = Math.atan2(p.y - cop.y, p.x - cop.x) + range(rand, -0.12, 0.12);
          E.particles.push({ x: cop.x, y: cop.y, vx: 0, vy: 0, life: 0.06, maxLife: 0.06, color: '#ffe135', size: 5, tracer: { x: cop.x + Math.cos(sa) * 380, y: cop.y + Math.sin(sa) * 380 } });
          audio.shoot();
          if (Math.random() < 0.3) hurtPlayer(7, G);
        }
      }
    }
    E.footCops = E.footCops.filter((c) => !c.dead);
  }

  function updateParticles(dt) {
    for (const pt of E.particles) {
      pt.life -= dt;
      pt.x += (pt.vx || 0) * dt;
      pt.y += (pt.vy || 0) * dt;
      if (pt.vx) pt.vx *= 0.98;
      if (pt.vy) pt.vy *= 0.98;
    }
    E.particles = E.particles.filter((pt) => pt.life > 0);
    for (const s of E.skids) s.life -= dt;
    E.skids = E.skids.filter((s) => s.life > 0);
  }

  function updatePickups(dt, G) {
    const p = E.player;
    for (const pk of E.pickups) {
      if (pk.taken) continue;
      if (!p.inCar && dist(p.x, p.y, pk.x, pk.y) < 30) {
        pk.taken = true;
        if (pk.kind === 'health') {
          p.hp = Math.min(PLAYER.health, p.hp + pk.amount);
          G.hooks.onPickup?.('health');
        } else if (pk.kind === 'ammo') {
          p.reserveAmmo += pk.amount;
          G.hooks.onPickup?.('ammo');
        } else if (pk.kind === 'cash') {
          G.hooks.onCash?.(pk.amount);
        }
        audio.pickup();
        addParticles(pk.x, pk.y, 10, '#ffd166', 120, 0.5);
      }
    }
    E.pickups = E.pickups.filter((pk) => !pk.taken);
  }

  function hurtPlayer(amount, G) {
    const p = E.player;
    if (p.dead) return;
    p.hp -= amount;
    p.lastDamage = E.time;
    addParticles(p.x, p.y, 8, '#ff5d5d', 150, 0.4);
    if (p.hp <= 0) {
      p.hp = 0;
      p.dead = true;
      G.hooks.onDown?.();
    }
  }

  return {
    ...E,
    makeCar, makePed, spawnCopCar, spawnFootCop,
    nearestCar, nearestPed, witnessNearby,
    tryEnterCar, exitCar, damageCar, addParticles, addSkid, hurtPlayer,
    update,
  };
}
