// Save and load through localStorage. A save holds cash, story progress, the
// player's health and pistol, and where the player stood. Nothing else — the
// city itself is rebuilt from the seed on every load.
import { SAVE_KEY } from './config.js';

export function hasSave() {
  try {
    return !!window.localStorage.getItem(SAVE_KEY);
  } catch {
    return false;
  }
}

export function saveGame(G) {
  try {
    const p = G.entities.player;
    const data = {
      v: 1,
      cash: G.cash,
      missionIndex: G.missions.index,
      hp: Math.round(p.hp),
      hasPistol: p.hasPistol,
      ammo: p.ammo,
      reserveAmmo: p.reserveAmmo,
      x: Math.round(p.x),
      y: Math.round(p.y),
      time: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    /* storage unavailable */
  }
}
