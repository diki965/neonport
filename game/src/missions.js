// Rosa's story: five missions, each keyed by its own id. Dialogue lines are
// looked up by mission id — a missing key used to throw every frame, so
// startMission and advanceDialogue both guard against unknown ids.

export const MISSIONS = [
  {
    id: 'wheels',
    name: 'Wheels',
    briefing: 'Rosa needs wheels. Steal any car and bring it to the Garage.',
    dialogue: [
      'ROSA: Rico! You are back in Solport and already broke. Typical.',
      'ROSA: I need wheels for a job. Take any car on the street — press F next to one — and bring it to the Garage.',
      'ROSA: Cops care about stolen cars. Keep it clean or lose them first.',
    ],
    start(world) {
      world.mission.target = { ...world.places.garage };
      world.mission.hint = 'Steal a car (F) and drive it to the Garage';
    },
    check(world) {
      const p = world.player;
      if (p.inCar && Math.hypot(p.x - world.places.garage.x, p.y - world.places.garage.y) < 90) return true;
      return false;
    },
  },
  {
    id: 'courier',
    name: 'Courier Run',
    briefing: 'Three drops, one clock. Rosa is counting on you.',
    dialogue: [
      'ROSA: Nice ride. Now earn it: three packages, three corners of town.',
      'ROSA: Marina, Market, then the Bank. You have 150 seconds. Drive like the rent is due.',
    ],
    start(world) {
      world.mission.drops = [
        { ...world.places.marina, done: false },
        { ...world.places.market, done: false },
        { ...world.places.bank, done: false },
      ];
      world.mission.dropIndex = 0;
      world.mission.timer = 150;
      world.mission.target = world.mission.drops[0];
      world.mission.hint = 'Deliver the packages before the clock runs out';
    },
    check(world) {
      const m = world.mission;
      const p = world.player;
      if (m.timer !== undefined) {
        m.timer -= 1 / 60;
        if (m.timer <= 0) return 'fail';
      }
      const drop = m.drops[m.dropIndex];
      if (drop && Math.hypot(p.x - drop.x, p.y - drop.y) < 90) {
        drop.done = true;
        m.dropIndex += 1;
        world.events.push({ type: 'drop' });
        if (m.dropIndex >= m.drops.length) return true;
        m.target = m.drops[m.dropIndex];
      }
      return false;
    },
  },
  {
    id: 'shakedown',
    name: 'Shakedown',
    briefing: 'Three shopkeepers owe Rosa. Remind them — on foot.',
    dialogue: [
      'ROSA: Three shopkeepers owe me protection money and keep forgetting.',
      'ROSA: Walk to the Gun Barn, the Clinic and the Respray. Press E at each door. No car — this is personal.',
    ],
    start(world) {
      world.mission.stops = [
        { ...world.places.gunbarn, done: false },
        { ...world.places.clinic, done: false },
        { ...world.places.respray, done: false },
      ];
      world.mission.stopIndex = 0;
      world.mission.target = world.mission.stops[0];
      world.mission.hint = 'Visit all three shops on foot (E at each door)';
    },
    check(world) {
      const m = world.mission;
      const p = world.player;
      if (p.inCar) return false;
      const stop = m.stops[m.stopIndex];
      if (stop && Math.hypot(p.x - stop.x, p.y - stop.y) < 80) {
        stop.done = true;
        m.stopIndex += 1;
        world.events.push({ type: 'collect', amount: 150 });
        p.cash += 150;
        if (m.stopIndex >= m.stops.length) return true;
        m.target = m.stops[m.stopIndex];
      }
      return false;
    },
  },
  {
    id: 'heat',
    name: 'Lose the Heat',
    briefing: 'Three stars, then nothing. Vanish.',
    dialogue: [
      'ROSA: The cops have your face now. I need you invisible by tonight.',
      'ROSA: Get to three stars — make some noise — then lose every last one. A Respray helps. So does patience.',
    ],
    start(world) {
      world.mission.hint = 'Reach 3 stars, then lose all heat';
      world.mission.peaked = false;
    },
    check(world) {
      const m = world.mission;
      if (world.wanted >= 3) m.peaked = true;
      if (m.peaked && world.wanted === 0 && world.cops.length === 0) return true;
      return false;
    },
  },
  {
    id: 'vault',
    name: 'The Vault',
    briefing: 'The Bank of Solport. In, out, gone.',
    dialogue: [
      'ROSA: Last job, Rico. The Bank of Solport keeps its vault cash by the back door.',
      'ROSA: Walk in, grab it, and get to the Safehouse. Four stars will follow you home. Do not get busted.',
    ],
    start(world) {
      world.mission.target = { ...world.places.bank };
      world.mission.grabbed = false;
      world.mission.hint = 'Grab the vault cash at the Bank, then reach the Safehouse';
    },
    check(world) {
      const m = world.mission;
      const p = world.player;
      if (!m.grabbed && Math.hypot(p.x - world.places.bank.x, p.y - world.places.bank.y) < 90) {
        m.grabbed = true;
        m.target = { ...world.places.safehouse };
        world.events.push({ type: 'grab' });
        world.wanted = Math.max(world.wanted, 4);
        world.heat = 1;
      }
      if (m.grabbed && Math.hypot(p.x - world.places.safehouse.x, p.y - world.places.safehouse.y) < 90) return true;
      return false;
    },
  },
];

export function startMission(world, index) {
  const def = MISSIONS[index];
  if (!def) return null;
  world.mission = {
    index,
    id: def.id,
    name: def.name,
    briefing: def.briefing,
    dialogue: def.dialogue || [],
    line: 0,
    target: null,
    hint: '',
  };
  def.start(world);
  return world.mission;
}

export function advanceDialogue(world) {
  const m = world.mission;
  if (!m || !m.dialogue) return false;
  if (m.line < m.dialogue.length - 1) {
    m.line += 1;
    return true;
  }
  return false;
}

export function missionDone(world) {
  const def = MISSIONS[world.mission.index];
  if (!def) return false;
  const result = def.check(world);
  if (result === 'fail') return 'fail';
  return result === true;
}
