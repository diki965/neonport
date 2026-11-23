// The story of Solport: five missions for Rico Vega, plus taxi fares on the
// side. Each mission is a list of steps; a step is done when the player reaches
// its marker, steals a car, waits out the heat, or cracks the vault. The
// module only reports progress — main.js owns cash, wanted and dialogue.
import { dist } from './random.js';
import { MONEY } from './config.js';

const DIALOGUE = {
  wheels: [
    { who: 'Rosa', text: "Rico Vega. Three years gone and you walk back into my garage like nothing happened." },
    { who: 'Rico', text: "I need wheels, Rosa. And work. The city owes me a living." },
    { who: 'Rosa', text: "Then earn it. First job's simple: get yourself a car. Any car. Bring it here." },
  ],
  courier: [
    { who: 'Rosa', text: 'A package is waiting at Pier 9. The Hotel Solmar wants it before the hour turns.' },
    { who: 'Rico', text: 'Ninety seconds across town? You always did love impossible deadlines.' },
  ],
  shakedown: [
    { who: 'Rosa', text: 'Three shops on my street stopped paying their dues. Remind them, gently. Or not so gently.' },
    { who: 'Rico', text: 'Taco Joint, the Laundromat, the Corner Store. Consider it done.' },
  ],
  heat: [
    { who: 'Rosa', text: "Dante Marlin's boys tipped off the police. You're hot, Rico — three stars hot." },
    { who: 'Rosa', text: 'Lay low. Stay out of their sight until it cools off — or get a respray at my cousin’s garage.' },
  ],
  score: [
    { who: 'Rosa', text: 'Last job, Rico. The Bank of Solport keeps its vault behind a sleepy guard and a loud alarm.' },
    { who: 'Rosa', text: 'Crack it, grab the cash, and bring it home. The whole force will be on you. Make it count.' },
  ],
  done: [
    { who: 'Rosa', text: 'That’s the last of it. Solport is yours now, Rico. Drive like you own the place — because you do.' },
    { who: 'Rico', text: 'Same time tomorrow, Rosa. There is always another job in this city.' },
  ],
};

export function createMissions(world, entities) {
  const L = world.locations;
  const defs = [
    {
      id: 'wheels', title: 'Mission 1 — Wheels', reward: 150,
      steps: [
        { kind: 'steal', text: 'Steal a car (walk up to one and press E)' },
        { kind: 'goto', text: "Drive it to Rosa's Garage", target: { x: L.garage.x, y: L.garage.y + 80, r: 70 }, label: "Rosa's Garage" },
      ],
    },
    {
      id: 'courier', title: 'Mission 2 — Courier Run', reward: 250,
      steps: [
        { kind: 'goto', text: 'Pick up the package at Pier 9', target: { x: L.docks.x, y: L.docks.y + 80, r: 60 }, label: 'Pier 9' },
        { kind: 'deliver', text: 'Deliver it to Hotel Solmar — fast!', target: { x: L.hotel.x, y: L.hotel.y + 80, r: 70 }, label: 'Hotel Solmar', time: 90 },
      ],
    },
    {
      id: 'shakedown', title: 'Mission 3 — Shakedown', reward: 350,
      steps: [
        { kind: 'collect', text: 'Collect from the Taco Joint', target: { x: L.taco.x, y: L.taco.y + 80, r: 60 }, label: 'Taco Joint' },
        { kind: 'collect', text: 'Collect from the Laundromat', target: { x: L.laundry.x, y: L.laundry.y + 80, r: 60 }, label: 'Laundromat' },
        { kind: 'collect', text: 'Collect from the Corner Store', target: { x: L.corner.x, y: L.corner.y + 80, r: 60 }, label: 'Corner Store' },
      ],
    },
    {
      id: 'heat', title: 'Mission 4 — Heat', reward: 300,
      steps: [
        { kind: 'evade', text: 'Lose the heat: stay out of police sight', time: 45 },
      ],
    },
    {
      id: 'score', title: 'Mission 5 — The Big Score', reward: 1500,
      steps: [
        { kind: 'vault', text: 'Crack the Bank of Solport vault (stand at the door)', target: { x: L.bank.x, y: L.bank.y + 80, r: 70 }, label: 'Bank of Solport', time: 6 },
        { kind: 'escape', text: 'Escape to the safehouse with the cash!', target: { x: L.safehouse.x, y: L.safehouse.y + 80, r: 70 }, label: 'Safehouse' },
      ],
    },
  ];

  const M = {
    defs,
    index: 0, // next mission to start; defs.length means the story is done
    step: 0,
    stepTimer: 0,
    dialogue: null, // {lines, i} — shown by main, advanced with E/click
    dialogueDone: false,
    active: false,
    failed: false,
    vaultHeat: false,
    taxi: null, // {passenger, dest}
    taxiTimer: 0,
  };

  M.current = () => (M.index < defs.length ? defs[M.index] : null);
  M.currentStep = () => {
    const m = M.current();
    return m ? m.steps[M.step] : null;
  };
  M.target = () => {
    const s = M.currentStep();
    return s && s.target ? s.target : null;
  };
  M.objectiveText = () => {
    if (M.dialogue) return M.dialogue.lines[M.dialogue.i].text;
    const m = M.current();
    if (!m) return 'Free roam — Solport is yours. Press M for the mission list.';
    const s = m.steps[M.step];
    return `${m.title}: ${s.text}`;
  };

  M.startMission = (i) => {
    M.index = i;
    M.step = 0;
    M.stepTimer = 0;
    M.active = true;
    M.failed = false;
    const m = defs[i];
    M.dialogue = DIALOGUE[m.id] ? { lines: DIALOGUE[m.id], i: 0 } : null;
    M.dialogueDone = false;
    if (m.id === 'heat') M.heatStarted = true;
    if (m.id === 'score') M.vaultHeat = false;
  };

  M.advanceDialogue = () => {
    if (!M.dialogue || !M.dialogue.lines) {
      M.dialogue = null;
      M.dialogueDone = true;
      return;
    }
    M.dialogue.i += 1;
    if (M.dialogue.i >= M.dialogue.lines.length) {
      M.dialogue = null;
      M.dialogueDone = true;
    }
  };

  M.completeMission = (hooks) => {
    const m = M.current();
    M.active = false;
    hooks.onCash?.(m.reward);
    hooks.onMissionComplete?.(m);
    M.index += 1;
    M.step = 0;
    if (M.index < defs.length) {
      M.startMission(M.index);
    } else {
      M.dialogue = { lines: DIALOGUE.done, i: 0 };
    }
  };

  M.failMission = (hooks, reason) => {
    M.failed = true;
    M.active = false;
    hooks.onMissionFailed?.(M.current(), reason);
  };

  // A thug appears at a shakedown shop; punch him to collect.
  M.spawnThug = (x, y) => {
    const thug = entities.makePed(x, y + 30, { thug: true });
    thug.target = { x, y: y + 30 };
    return thug;
  };

  M.update = (dt, G) => {
    const p = entities.player;
    const hooks = G.hooks;
    M.taxiTimer -= dt;

    // Taxi fares: a waiting passenger near the player, only while free-roaming
    // or between missions, and only while the player is driving.
    if (!M.taxi && !M.dialogue && p.inCar && Math.random() < dt * 0.02) {
      const a = Math.random() * Math.PI * 2;
      const px = p.x + Math.cos(a) * 260;
      const py = p.y + Math.sin(a) * 260;
      if (px > 60 && px < 2740 && py > 60 && py < 1760) {
        const dest = G.world.locations[(['hotel', 'docks', 'bank', 'clinic', 'park'][Math.floor(Math.random() * 5)])];
        M.taxi = { x: px, y: py, dest, passenger: null, state: 'waiting' };
      }
    }
    if (M.taxi) {
      if (M.taxi.state === 'waiting' && p.inCar && dist(p.x, p.y, M.taxi.x, M.taxi.y) < 60) {
        M.taxi.state = 'riding';
        hooks.onTaxiPickup?.();
      } else if (M.taxi.state === 'riding' && dist(p.x, p.y, M.taxi.dest.x, M.taxi.dest.y + 80) < 70) {
        hooks.onCash?.(MONEY.taxiFare);
        hooks.onTaxiDone?.(MONEY.taxiFare);
        M.taxi = null;
      }
    }

    if (!M.active || M.dialogue) return;
    const m = M.current();
    if (!m) return;
    const s = m.steps[M.step];
    if (!s) return;

    const doneStep = () => {
      M.step += 1;
      M.stepTimer = 0;
      if (M.step >= m.steps.length) M.completeMission(hooks);
    };

    if (s.kind === 'steal') {
      if (p.inCar) doneStep();
    } else if (s.kind === 'goto' || s.kind === 'collect') {
      if (dist(p.x, p.y, s.target.x, s.target.y) < s.target.r) {
        if (s.kind === 'collect') {
          // A thug guards the till: he must be down before the cash is yours.
          if (!s.thugSpawned) {
            s.thugSpawned = true;
            s.thug = M.spawnThug(s.target.x, s.target.y);
          }
          if (s.thug && s.thug.state === 'down') doneStep();
        } else {
          doneStep();
        }
      }
    } else if (s.kind === 'deliver') {
      M.stepTimer += dt;
      if (dist(p.x, p.y, s.target.x, s.target.y) < s.target.r) {
        doneStep();
      } else if (M.stepTimer > s.time) {
        M.failMission(hooks, 'Too slow — the client found another courier.');
      }
    } else if (s.kind === 'evade') {
      // The clock only runs while no cop can see the player.
      const seen = G.policeSight();
      if (!seen) {
        M.stepTimer += dt;
        if (M.stepTimer >= s.time) doneStep();
      }
    } else if (s.kind === 'vault') {
      if (dist(p.x, p.y, s.target.x, s.target.y) < s.target.r && !p.inCar) {
        M.stepTimer += dt;
        if (M.stepTimer >= s.time) {
          if (!M.vaultHeat) {
            M.vaultHeat = true;
            hooks.onVaultCracked?.();
          }
          doneStep();
        }
      } else {
        M.stepTimer = Math.max(0, M.stepTimer - dt * 2);
      }
    } else if (s.kind === 'escape') {
      if (dist(p.x, p.y, s.target.x, s.target.y) < s.target.r) doneStep();
    }
  };

  M.timeLeft = () => {
    const s = M.currentStep();
    if (!s || !s.time) return null;
    return Math.max(0, s.time - M.stepTimer);
  };

  return M;
}
