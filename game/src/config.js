// Solport — every tuning number and colour in one place.
// The world is a fixed 2800x2000 coastal city; the renderer scales the view
// to the window, so no rule below depends on the screen size.

export const WORLD = { width: 2800, height: 2000 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** Logical view size the camera frames around the player. */
export const VIEW = { width: 1280, height: 720 };

export const PLAYER = {
  radius: 14,
  walkSpeed: 230,
  runSpeed: 330,
  accel: 2400,
  health: 100,
  fistDamage: 34,
  fistRange: 46,
  fistRate: 0.45,
};

export const CAR = {
  length: 64,
  width: 30,
  accel: 520,
  brake: 900,
  reverseAccel: 300,
  maxSpeed: 560,
  maxReverse: 180,
  steer: 2.6,
  grip: 6.5,
  ramDamage: 26,
};

export const PISTOL = {
  damage: 34,
  range: 520,
  rate: 0.28,
  magSize: 12,
  price: 500,
  ammoPrice: 40,
  ammoPack: 24,
};

export const WANTED = {
  max: 5,
  stealCar: 1,
  shoot: 1,
  hitPed: 2,
  killCop: 2,
  decaySeconds: 26,
  bustRadius: 42,
  copSpawnInterval: 4,
  maxCops: 9,
};

export const MONEY = {
  start: 200,
  taxiFare: 60,
  healPrice: 100,
  resprayPrice: 200,
  sellCar: 350,
  missionReward: [400, 500, 600, 700, 1500],
};

export const SAVE_KEY = 'solport.save.v1';
export const BEST_KEY = 'solport.best';

export const PALETTE = {
  sea: '#2e7f9e',
  sand: '#e8d39a',
  grass: '#5d8a4a',
  road: '#33373d',
  roadLine: '#d8c25a',
  sidewalk: '#8d8578',
  building: ['#b0563e', '#c07a3e', '#7d8aa0', '#a03e5c', '#4e7d6b', '#8a6fb0', '#5b7fa6'],
  roof: ['#6e3a2c', '#54423a', '#3a4a5a'],
  player: '#f2c94c',
  playerShirt: '#2e86de',
  ped: ['#e74c3c', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#f39c12'],
  cop: '#24344d',
  copCar: '#1f2a3a',
  taxi: '#f5c542',
  carColors: ['#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#e67e22', '#16a085', '#d5dbdb', '#7f8c8d'],
  hud: '#10141b',
  panel: 'rgba(12,16,22,0.86)',
  text: '#eef1f5',
  muted: '#9aa4b2',
  star: '#ffd94d',
  marker: '#ffcf3d',
  bank: '#c9a227',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
