// Every tuning number and colour in one place. The playfield is a fixed 1280x720
// logical area; the renderer scales it to the window, so no rule below depends on
// the screen size. The world is a sun-soaked coastal city, 2800x2000 units.

export const VIEW = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const WORLD = { width: 2800, height: 2000, beachY: 1820, seaY: 1930 };

export const PLAYER = {
  radius: 13,
  walkSpeed: 210,
  runSpeed: 300,
  health: 100,
  regenDelay: 5,
  regenRate: 3,
  punchDamage: 22,
  punchRange: 34,
  punchArc: 1.1,
};

export const PISTOL = {
  damage: 34,
  range: 460,
  fireInterval: 0.22,
  spread: 0.045,
  magSize: 12,
  startAmmo: 36,
  price: 120,
  ammoPrice: 40,
};

export const CAR = {
  // Arcade car physics: acceleration, top speed, grip, steering.
  accel: 420,
  brake: 700,
  reverseAccel: 260,
  topSpeed: 520,
  topReverse: 180,
  steer: 2.6,
  grip: 3.2,
  drag: 0.55,
  radius: 20,
  health: 100,
  stealWanted: 1,
};

export const WANTED = {
  maxStars: 5,
  decayDelay: 10, // seconds out of police sight before a star drops
  decayInterval: 12,
  copCarsPerStar: 1,
  maxCopCars: 6,
  footCopsPerStar: 1,
  maxFootCops: 4,
  bustTime: 1.0, // seconds of cop contact on foot to get caught
  sightRange: 420,
};

export const TRAFFIC = { cars: 26, peds: 46, carSpeed: 150, pedSpeed: 55 };

export const MONEY = {
  startCash: 50,
  taxiFare: 60,
  respray: 100,
  repair: 50,
  hospital: 80,
  deathPenalty: 100,
};

export const PALETTE = {
  sky: '#8ec9ee',
  grass: '#7ec850',
  sand: '#f2dd9e',
  sea: '#2f9fd8',
  seaDeep: '#1f7fb8',
  road: '#3a3f4a',
  roadEdge: '#2c3038',
  sidewalk: '#b9bec7',
  crosswalk: '#e8eaf0',
  lane: '#f5d76e',
  buildingRoof: '#8a6f5c',
  panel: 'rgba(12, 16, 24, 0.82)',
  panelEdge: '#ffd166',
  text: '#f4f6f8',
  muted: '#aab4c0',
  gold: '#ffd166',
  star: '#ffd94d',
  health: '#58d68d',
  danger: '#ff5d5d',
  police: '#3f8cff',
  mission: '#ff9f1c',
  taxi: '#ffe135',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save is kept between visits (this browser only). */
export const SAVE_KEY = 'solport.save.v1';
export const BEST_KEY = 'solport.best.v1';
