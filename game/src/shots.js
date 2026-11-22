// The screenshot scenes behind ?shot=play|title|alarm|win. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by an
// autopilot that follows waypoints and backs away when a guard's cone finds it, so
// the frame is what a short game really looks like and the same seed always gives
// the same frame. The cover shot (play) ends mid-sneak, deep in the museum.

import { STEP } from './config.js';
import { EVENT_ALARM, EVENT_OVER, EVENT_WIN, STATUS_WON } from './world.js';
import { SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const PLAY_SECONDS = 10;
const TITLE_SECONDS = 4;
const ALARM_LIMIT_SECONDS = 14;
const WIN_LIMIT_SECONDS = 45;
/** Frames to keep rolling after the alarm starts, so the shot catches the chase. */
const ALARM_HOLD_STEPS = 24;

/** The patient route to the exit: through the doorway, past the middle gem, into the vault. */
const ROUTE_TO_EXIT = [
  { x: 400, y: 560 },
  { x: 640, y: 470 },
  { x: 640, y: 300 },
  { x: 640, y: 200 },
  { x: 820, y: 220 },
  { x: 1000, y: 280 },
  { x: 1100, y: 180 },
  { x: 1210, y: 70 },
];

/**
 * Steer toward the current waypoint. A cautious pilot backs away from a guard that
 * has spotted it (and sneaks while doing so) until suspicion drains, then carries on.
 */
function autopilot(state, waypoints, cursor, cautious) {
  const player = state.player;
  if (cautious) {
    const threat = state.guards.find((g) => g.sees);
    if (threat || state.suspicion > 0.15) {
      const gx = threat ? threat.x : state.guards[0].x;
      const gy = threat ? threat.y : state.guards[0].y;
      const dx = player.x - gx;
      const dy = player.y - gy;
      const len = Math.hypot(dx, dy) || 1;
      return { move: { x: dx / len, y: dy / len }, sneak: true, cursor };
    }
  }
  const target = waypoints[cursor];
  if (!target) return { move: { x: 0, y: 0 }, sneak: false, cursor };
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 22) return { move: { x: 0, y: 0 }, sneak: false, cursor: cursor + 1 };
  return { move: { x: dx / dist, y: dy / dist }, sneak: false, cursor };
}

/**
 * Set `world` to the named scene (play, title, alarm or win; any other name is play)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'title') {
    for (let i = 0; i < TITLE_SECONDS / STEP; i += 1) {
      world.step(STEP, { x: 0, y: 0 }, false, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'alarm') {
    // Walk just off the lower guard's patrol line and stand there: the cone finds
    // the player, suspicion fills, and the frame catches the alarm going up.
    let cursor = 0;
    let hold = -1;
    for (let i = 0; i < ALARM_LIMIT_SECONDS / STEP; i += 1) {
      const pilot = autopilot(world.state, [{ x: 640, y: 420 }], cursor, false);
      cursor = pilot.cursor;
      const events = world.step(STEP, pilot.move, pilot.sneak, false);
      if (events & EVENT_ALARM) hold = ALARM_HOLD_STEPS;
      if (hold === 0) break;
      if (hold > 0) hold -= 1;
      if (events & (EVENT_OVER | EVENT_WIN)) break;
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'win') {
    let cursor = 0;
    for (let i = 0; i < WIN_LIMIT_SECONDS / STEP; i += 1) {
      const pilot = autopilot(world.state, ROUTE_TO_EXIT, cursor, true);
      cursor = pilot.cursor;
      const events = world.step(STEP, pilot.move, pilot.sneak, false);
      if (events & (EVENT_WIN | EVENT_OVER)) break;
    }
    return { screen: world.state.status === STATUS_WON ? SCREEN_WIN : SCREEN_PLAY, best: world.state.score };
  }
  // The play scene: the cover shot. The pilot sneaks the whole way, so the frame
  // catches it mid-level, deep in the museum, with the sneak indicator showing.
  let cursor = 0;
  for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
    const pilot = autopilot(world.state, ROUTE_TO_EXIT, cursor, true);
    cursor = pilot.cursor;
    const events = world.step(STEP, pilot.move, true, false);
    if (events & (EVENT_WIN | EVENT_OVER)) break;
  }
  return { screen: SCREEN_PLAY, best: 0 };
}
