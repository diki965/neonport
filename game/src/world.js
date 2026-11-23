// Solport: a sun-soaked coastal city. Roads form a grid; blocks hold buildings,
// one park, and the named places the story uses. Everything is seeded, so the
// same seed builds the same city for every player and every screenshot.
import { WORLD } from './config.js';
import { createRandom, pick, range, int } from './random.js';

export const ROAD_W = 92;

export const AVENUES = [200, 600, 1000, 1400, 1800, 2200, 2600];
export const STREETS = [200, 550, 900, 1250, 1600];

const ROOF_COLORS = ['#b5674e', '#7a8ba0', '#a08b6d', '#6d8a7a', '#96705a', '#5d6b8c', '#b08a4f'];
const WALL_COLORS = ['#f2e3c9', '#e8d5b5', '#d9e2ec', '#f5d7d0', '#dcead9', '#e6d9f2', '#f7e8c8'];
const SIGNS = [
  'TACO JOINT', 'LAUNDROMAT', 'CORNER STORE', 'PIZZA', 'DONUTS', 'BARBER',
  'SURF SHOP', 'GYM', 'FLOWERS', 'BOOKS', 'ARCADE', 'LIQUOR', 'PHARMACY',
  'BURGER BAR', 'SUSHI', 'BIKES', 'RECORDS', 'CAFE', 'HOTEL', 'MOTEL',
];

export function createWorld(seed) {
  const rand = createRandom(seed);
  const buildings = [];
  const palms = [];
  const lamps = [];

  // Named story places: fixed spots the missions and the HUD point at.
  const locations = {
    safehouse: { name: "Rico's Place", x: 330, y: 330, kind: 'safehouse' },
    garage: { name: "Rosa's Garage", x: 640, y: 940, kind: 'garage' },
    bank: { name: 'Bank of Solport', x: 1440, y: 590, kind: 'bank' },
    docks: { name: 'Pier 9 Docks', x: 2560, y: 1290, kind: 'docks' },
    hotel: { name: 'Hotel Solmar', x: 1840, y: 240, kind: 'hotel' },
    gunstore: { name: 'Gun Barn', x: 1040, y: 1640, kind: 'gunstore' },
    clinic: { name: 'Solport Clinic', x: 2240, y: 590, kind: 'clinic' },
    respray: { name: 'Respray Garage', x: 1840, y: 1640, kind: 'respray' },
    taco: { name: 'Taco Joint', x: 1040, y: 240, kind: 'shop' },
    laundry: { name: 'Laundromat', x: 2240, y: 940, kind: 'shop' },
    corner: { name: 'Corner Store', x: 1440, y: 1290, kind: 'shop' },
    park: { name: 'Palm Park', x: 2000, y: 1075, kind: 'park' },
  };

  function addBuilding(x, y, w, h, opts = {}) {
    const b = {
      x, y, w, h,
      wall: opts.wall || pick(rand, WALL_COLORS),
      roof: opts.roof || pick(rand, ROOF_COLORS),
      sign: opts.sign || (rand() < 0.45 ? pick(rand, SIGNS) : null),
      signColor: pick(rand, ['#ff5d8f', '#ffd166', '#4fc3f7', '#7CFC9A', '#ff9f1c']),
      kind: opts.kind || 'building',
      name: opts.name || null,
      windows: int(rand, 2, 5),
    };
    buildings.push(b);
    return b;
  }

  // One named building per story place, sitting on its block.
  for (const key of Object.keys(locations)) {
    const L = locations[key];
    if (L.kind === 'park') continue;
    addBuilding(L.x - 70, L.y - 45, 140, 90, { name: L.name, kind: L.kind, sign: L.name.toUpperCase() });
  }

  // Fill every other block with 1-3 buildings, leaving the park block green.
  for (let ai = 0; ai < AVENUES.length - 1; ai++) {
    for (let si = 0; si < STREETS.length - 1; si++) {
      const x0 = AVENUES[ai] + ROAD_W / 2 + 14;
      const x1 = AVENUES[ai + 1] - ROAD_W / 2 - 14;
      const y0 = STREETS[si] + ROAD_W / 2 + 14;
      const y1 = STREETS[si + 1] - ROAD_W / 2 - 14;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      // Palm Park block: no buildings, just trees.
      if (Math.abs(cx - 2000) < 220 && Math.abs(cy - 1075) < 190) continue;
      // Skip blocks that already hold a named place.
      const taken = Object.values(locations).some(
        (L) => L.kind !== 'park' && L.x > x0 - 90 && L.x < x1 + 90 && L.y > y0 - 70 && L.y < y1 + 70,
      );
      if (taken) continue;
      const n = int(rand, 1, 3);
      for (let i = 0; i < n; i++) {
        const w = range(rand, 70, 150);
        const h = range(rand, 60, 120);
        const x = range(rand, x0, x1 - w);
        const y = range(rand, y0, y1 - h);
        const b = { x, y, w, h };
        if (buildings.some((o) => rectsOverlap(b, o, 18))) continue;
        addBuilding(x, y, w, h);
      }
    }
  }

  // Palm trees along sidewalks and the beach, lamps at intersections.
  for (let i = 0; i < 90; i++) {
    const av = pick(rand, AVENUES);
    const st = pick(rand, STREETS);
    const side = rand() < 0.5 ? -1 : 1;
    palms.push({ x: av + side * (ROAD_W / 2 + 10), y: range(rand, 120, WORLD.beachY - 60), lean: range(rand, -0.2, 0.2) });
    palms.push({ x: range(rand, 120, WORLD.width - 120), y: st + side * (ROAD_W / 2 + 10), lean: range(rand, -0.2, 0.2) });
  }
  for (let i = 0; i < 40; i++) {
    palms.push({ x: range(rand, 60, WORLD.width - 60), y: range(rand, WORLD.beachY + 8, WORLD.seaY - 12), lean: range(rand, -0.25, 0.25) });
  }
  for (const av of AVENUES) {
    for (const st of STREETS) lamps.push({ x: av + ROAD_W / 2 + 6, y: st - ROAD_W / 2 - 6 });
  }

  return { buildings, palms, lamps, locations, rand };
}

export function rectsOverlap(a, b, pad = 0) {
  return a.x - pad < b.x + b.w + pad && a.x + a.w + pad > b.x - pad &&
    a.y - pad < b.y + b.h + pad && a.y + a.h + pad > b.y - pad;
}

export function isRoad(x, y) {
  const onV = AVENUES.some((av) => Math.abs(x - av) <= ROAD_W / 2);
  const onH = STREETS.some((st) => Math.abs(y - st) <= ROAD_W / 2);
  return onV || onH;
}

export function isWater(x, y) {
  return y >= WORLD.seaY;
}

export function inBounds(x, y, m = 20) {
  return x >= m && x <= WORLD.width - m && y >= m && y <= WORLD.height - m;
}

/** Push a circle out of every building it overlaps; returns true if it hit one. */
export function collideCircle(buildings, x, y, r) {
  let hit = false;
  for (const b of buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = (r - d) / d;
        x += dx * push;
        y += dy * push;
      } else {
        // Dead centre: push out along the shortest side.
        const left = x - b.x;
        const right = b.x + b.w - x;
        const top = y - b.y;
        const bottom = b.y + b.h - y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) x = b.x - r;
        else if (m === right) x = b.x + b.w + r;
        else if (m === top) y = b.y - r;
        else y = b.y + b.h + r;
      }
    }
  }
  return { x, y, hit };
}

export function pointInBuilding(buildings, x, y) {
  return buildings.some((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
}

export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const av of AVENUES) {
    const d = Math.abs(x - av);
    if (d < bestD) { bestD = d; best = { x: av, y, vertical: true }; }
  }
  for (const st of STREETS) {
    const d = Math.abs(y - st);
    if (d < bestD) { bestD = d; best = { x, y: st, vertical: false }; }
  }
  return best;
}

export function randomRoadPoint(rand) {
  if (rand() < 0.5) {
    return { x: pick(rand, AVENUES), y: range(rand, 100, WORLD.beachY - 100), vertical: true };
  }
  return { x: range(rand, 100, WORLD.width - 100), y: pick(rand, STREETS), vertical: false };
}

export function randomSidewalkPoint(rand) {
  const p = randomRoadPoint(rand);
  const off = (ROAD_W / 2 + 12) * (rand() < 0.5 ? -1 : 1);
  if (p.vertical) return { x: p.x + off, y: p.y };
  return { x: p.x, y: p.y + off };
}
