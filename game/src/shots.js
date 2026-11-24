// Staged screenshots behind ?shot=title|chase|mission|play. Each one plays
// the real rules forward from a fresh world for a fixed number of steps,
// steered by a simple autopilot, so the frame is what real play looks like
// and the same seed always gives the same frame.

import { STEP } from './config.js';
import { startMission } from './missions.js';
import { nearestParked, addWanted } from './world.js';
import { SCREEN_TITLE, SCREEN_PLAY } from './render.js';

/**
 * Steer toward a point: returns held keys. On foot the keys are the screen
 * direction itself; in a car the angle grows clockwise (y is down), so a
 * target clockwise of the heading needs the RIGHT key.
 */
function steerToward(world, tx, ty) {
  const p = world.player;
  const dx = tx - p.x;
  const dy = ty - p.y;
  if (Math.hypot(dx, dy) < 60) return {};
  if (!p.inCar) {
    const held = {};
    if (dy < -20) held.up = true;
    else if (dy > 20) held.down = true;
    if (dx < -20) held.left = true;
    else if (dx > 20) held.right = true;
    return held;
  }
  const want = Math.atan2(dy, dx);
  let da = want - p.angle;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  const held = { up: true };
  if (da > 0.35) held.right = true;
  else if (da < -0.35) held.left = true;
  return held;
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * `stepFn` is the world's step function (stepWorld with a fire callback).
 */
export function stageShot(name, world, stepFn) {
  const run = (seconds, steer) => {
    const input = { held: {}, pressed: {}, mouse: { x: 640, y: 360, down: false, clicked: false } };
    for (let i = 0; i < seconds / STEP; i += 1) {
      input.held = steer(i);
      input.pressed = {};
      world.events.length = 0;
      stepFn(world, input, STEP);
    }
  };

  if (name === 'chase') {
    // Rico in a stolen car at 3 stars, cops in pursuit, mid-chase.
    const car = nearestParked(world, 1400, 1000, 100000);
    car.taken = true;
    world.player.inCar = car;
    world.player.x = car.x;
    world.player.y = car.y;
    car.speed = 300;
    addWanted(world, 3);
    startMission(world, 0);
    world.mission.line = world.mission.dialogue.length - 1;
    run(16, () => steerToward(world, 2300, 1400));
    return { screen: SCREEN_PLAY };
  }

  if (name === 'mission') {
    // Mission 5 at the Bank of Solport: on foot, 4 stars, a foot cop closing in.
    startMission(world, 4);
    world.mission.line = world.mission.dialogue.length - 1;
    world.player.x = world.places.bank.x - 260;
    world.player.y = world.places.bank.y + 120;
    world.player.hasPistol = true;
    world.player.ammo = 12;
    addWanted(world, 4);
    run(7, () => steerToward(world, world.places.bank.x, world.places.bank.y));
    return { screen: SCREEN_PLAY };
  }

  if (name === 'play') {
    // Mission 1: driving the stolen car toward the Garage.
    const car = nearestParked(world, 700, 1200, 100000);
    car.taken = true;
    world.player.inCar = car;
    world.player.x = car.x;
    world.player.y = car.y;
    car.speed = 260;
    addWanted(world, 1);
    startMission(world, 0);
    world.mission.line = world.mission.dialogue.length - 1;
    run(13, () => steerToward(world, world.places.garage.x, world.places.garage.y));
    return { screen: SCREEN_PLAY };
  }

  // Title: the city alive for a few seconds behind the title screen.
  run(5, () => ({}));
  return { screen: SCREEN_TITLE };
}
