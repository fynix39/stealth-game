// The museum at night: one fixed level, guards on patrol, and the rules of being seen.
// Pure simulation — no DOM, no canvas — so the same step runs in the browser, in the
// screenshot scenes, and in a headless test. Guards walk fixed routes you can learn;
// their cones sweep while they wait at each waypoint.

import { FIELD, PLAYER, GUARD, DETECTION, LOOT, TIME_BONUS } from './config.js';

export const EVENT_NONE = 0;
export const EVENT_ALARM = 1;
export const EVENT_CAUGHT = 2;
export const EVENT_LOOT = 4;
export const EVENT_WIN = 8;
export const EVENT_OVER = 16;

export const STATUS_PLAYING = 'playing';
export const STATUS_WON = 'won';
export const STATUS_OVER = 'over';

// ---------------------------------------------------------------- level layout
// Walls and crates block movement and line of sight. Shadows slow detection.
// All coordinates are in the 1280x720 logical field.
const WALLS = [
  { x: 0, y: 0, w: 1280, h: 24 }, // top border
  { x: 0, y: 696, w: 1280, h: 24 }, // bottom border
  { x: 0, y: 0, w: 24, h: 720 }, // left border
  { x: 1256, y: 0, w: 24, h: 720 }, // right border
  { x: 24, y: 340, w: 536, h: 24 }, // mid wall, left of the doorway
  { x: 720, y: 340, w: 536, h: 24 }, // mid wall, right of the doorway
  { x: 900, y: 24, w: 24, h: 216 }, // vault wall (gap below it, y 240-340)
  { x: 200, y: 480, w: 80, h: 80 }, // pillar, lower hall
  { x: 980, y: 480, w: 80, h: 80 }, // pillar, lower hall
];

const CRATES = [
  { x: 300, y: 480, w: 56, h: 56 },
  { x: 460, y: 600, w: 56, h: 56 },
  { x: 700, y: 470, w: 56, h: 56 },
  { x: 850, y: 540, w: 56, h: 56 },
  { x: 150, y: 180, w: 56, h: 56 },
  { x: 500, y: 150, w: 56, h: 56 },
  { x: 1050, y: 300, w: 56, h: 56 },
];

const SHADOWS = [
  { x: 100, y: 420, w: 180, h: 120 },
  { x: 950, y: 100, w: 200, h: 120 },
  { x: 600, y: 600, w: 220, h: 80 },
];

const GEMS = [
  { x: 140, y: 100 },
  { x: 640, y: 200 },
  { x: 1150, y: 620 },
];

const EXIT = { x: 1180, y: 40, w: 60, h: 60 };
const PLAYER_START = { x: 80, y: 640 };
/** The doorway between the two halls: guards route through it when returning to patrol. */
const DOORWAY = { x: 640, y: 352 };

const GUARD_ROUTES = [
  // Lower hall, back and forth along the corridor.
  [{ x: 200, y: 380 }, { x: 1080, y: 380 }],
  // Upper hall, up and down the left side.
  [{ x: 330, y: 120 }, { x: 330, y: 300 }],
  // The vault: a loop around the exit room.
  [{ x: 950, y: 280 }, { x: 1150, y: 280 }, { x: 1150, y: 120 }, { x: 950, y: 120 }],
];

// ---------------------------------------------------------------- geometry
function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function segmentsCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
  const d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  const d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function segmentHitsRect(x1, y1, x2, y2, r) {
  if (pointInRect(x1, y1, r) || pointInRect(x2, y2, r)) return true;
  const { x, y, w, h } = r;
  return (
    segmentsCross(x1, y1, x2, y2, x, y, x + w, y) ||
    segmentsCross(x1, y1, x2, y2, x + w, y, x + w, y + h) ||
    segmentsCross(x1, y1, x2, y2, x + w, y + h, x, y + h) ||
    segmentsCross(x1, y1, x2, y2, x, y + h, x, y)
  );
}

/** True when nothing solid stands between two points. */
function hasLineOfSight(x1, y1, x2, y2) {
  for (const wall of WALLS) if (segmentHitsRect(x1, y1, x2, y2, wall)) return false;
  for (const crate of CRATES) if (segmentHitsRect(x1, y1, x2, y2, crate)) return false;
  return true;
}

/** Push a circle out of a rectangle, axis by axis; returns the corrected position. */
function collideCircle(x, y, radius, dx, dy) {
  let nx = x + dx;
  let ny = y + dy;
  for (const solid of [...WALLS, ...CRATES]) {
    const nearestX = Math.max(solid.x, Math.min(nx, solid.x + solid.w));
    const nearestY = Math.max(solid.y, Math.min(ny, solid.y + solid.h));
    const ox = nx - nearestX;
    const oy = ny - nearestY;
    const distSq = ox * ox + oy * oy;
    if (distSq >= radius * radius) continue;
    if (distSq === 0) {
      // Centre inside the rectangle: push out along the smallest overlap.
      const left = nx - solid.x;
      const right = solid.x + solid.w - nx;
      const top = ny - solid.y;
      const bottom = solid.y + solid.h - ny;
      const min = Math.min(left, right, top, bottom);
      if (min === left) nx = solid.x - radius;
      else if (min === right) nx = solid.x + solid.w + radius;
      else if (min === top) ny = solid.y - radius;
      else ny = solid.y + solid.h + radius;
      continue;
    }
    const dist = Math.sqrt(distSq);
    nx = nearestX + (ox / dist) * radius;
    ny = nearestY + (oy / dist) * radius;
  }
  return { x: nx, y: ny };
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function turnToward(angle, target, rate, dt) {
  const diff = angleDiff(target, angle);
  const step = rate * dt;
  if (Math.abs(diff) <= step) return target;
  return angle + Math.sign(diff) * step;
}

// ---------------------------------------------------------------- world
/** `random` seeds the guards' pace, so ?seed=N gives each run its own patrol rhythm. */
export function createWorld(random) {
  const pace = random || (() => 0.5);
  const state = {
    time: 0,
    score: 0,
    loot: 0,
    lives: PLAYER.lives,
    suspicion: 0,
    /** Seconds left on the alarm; 0 means no alarm. */
    alarm: 0,
    status: STATUS_PLAYING,
    player: { x: PLAYER_START.x, y: PLAYER_START.y, angle: -Math.PI / 2, moving: false, sneaking: false },
    guards: [],
    gems: GEMS.map((g) => ({ ...g, taken: false })),
    walls: WALLS,
    crates: CRATES,
    shadows: SHADOWS,
    exit: EXIT,
    start: PLAYER_START,
  };

  function resetGuards() {
    state.guards = GUARD_ROUTES.map((route) => ({
      x: route[0].x,
      y: route[0].y,
      angle: Math.atan2(route[1].y - route[0].y, route[1].x - route[0].x),
      route,
      waypoint: 1,
      wait: 0,
      sweepT: 0,
      mode: 'patrol',
      chaseX: 0,
      chaseY: 0,
      returnTarget: null,
      sees: false,
      /** Each guard walks at 92-108% of the base pace: learnable, never identical. */
      pace: 0.92 + pace() * 0.16,
    }));
  }

  function reset() {
    state.time = 0;
    state.score = 0;
    state.loot = 0;
    state.lives = PLAYER.lives;
    state.suspicion = 0;
    state.alarm = 0;
    state.status = STATUS_PLAYING;
    state.player.x = PLAYER_START.x;
    state.player.y = PLAYER_START.y;
    state.player.angle = -Math.PI / 2;
    state.player.moving = false;
    state.player.sneaking = false;
    state.gems = GEMS.map((g) => ({ ...g, taken: false }));
    resetGuards();
  }

  function respawnAfterCaught() {
    state.player.x = PLAYER_START.x;
    state.player.y = PLAYER_START.y;
    state.player.angle = -Math.PI / 2;
    state.suspicion = 0;
    state.alarm = 0;
    resetGuards();
  }

  function guardSeesPlayer(guard) {
    const dx = state.player.x - guard.x;
    const dy = state.player.y - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist > GUARD.coneRange) return false;
    if (Math.abs(angleDiff(Math.atan2(dy, dx), guard.angle)) > GUARD.coneHalfAngle) return false;
    return hasLineOfSight(guard.x, guard.y, state.player.x, state.player.y);
  }

  function playerInShadow() {
    return SHADOWS.some((s) => pointInRect(state.player.x, state.player.y, s));
  }

  function moveGuard(guard, targetX, targetY, speed, dt) {
    const dx = targetX - guard.x;
    const dy = targetY - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return true;
    const step = Math.min(dist, speed * dt);
    const nx = guard.x + (dx / dist) * step;
    const ny = guard.y + (dy / dist) * step;
    const fixed = collideCircle(guard.x, guard.y, GUARD.radius, nx - guard.x, ny - guard.y);
    guard.x = fixed.x;
    guard.y = fixed.y;
    guard.angle = turnToward(guard.angle, Math.atan2(dy, dx), 9, dt);
    return dist <= step + 1;
  }

  function nearestWaypoint(guard) {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < guard.route.length; i += 1) {
      const d = Math.hypot(guard.route[i].x - guard.x, guard.route[i].y - guard.y);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }

  function updateGuard(guard, dt) {
    if (guard.mode === 'chase') {
      const arrived = moveGuard(guard, guard.chaseX, guard.chaseY, GUARD.chaseSpeed * guard.pace, dt);
      if (arrived) {
        // Reached the last seen spot and found no one: hold, then give up when the
        // alarm ends. The wait keeps the guard looking around the spot.
        guard.wait += dt;
      }
      return;
    }
    if (guard.mode === 'return') {
      const target = guard.returnTarget;
      if (!target) {
        guard.mode = 'patrol';
        return;
      }
      if (moveGuard(guard, target.x, target.y, GUARD.patrolSpeed * guard.pace, dt)) {
        if (target === DOORWAY) {
          guard.returnTarget = guard.route[guard.waypoint];
        } else {
          guard.mode = 'patrol';
          guard.returnTarget = null;
        }
      }
      return;
    }
    // Patrol: walk the route, pausing at each waypoint to sweep the cone.
    if (guard.wait > 0) {
      guard.wait -= dt;
      guard.sweepT += dt;
      const next = guard.route[guard.waypoint];
      const base = Math.atan2(next.y - guard.y, next.x - guard.x);
      guard.angle = base + Math.sin(guard.sweepT * 2.2) * 0.55;
      return;
    }
    const target = guard.route[guard.waypoint];
    if (moveGuard(guard, target.x, target.y, GUARD.patrolSpeed * guard.pace, dt)) {
      guard.waypoint = (guard.waypoint + 1) % guard.route.length;
      guard.wait = GUARD.pauseAtWaypoint;
      guard.sweepT = 0;
    }
  }

  function step(dt, move, sneak, attract) {
    if (state.status !== STATUS_PLAYING) return EVENT_NONE;
    let events = EVENT_NONE;
    if (!attract) state.time += dt;

    // --- player
    if (!attract) {
      const len = Math.hypot(move.x, move.y);
      const speed = sneak ? PLAYER.sneakSpeed : PLAYER.speed;
      state.player.sneaking = sneak && len > 0.1;
      state.player.moving = len > 0.1;
      if (len > 0.1) {
        const nx = state.player.x + (move.x / len) * speed * dt;
        const ny = state.player.y + (move.y / len) * speed * dt;
        const fixed = collideCircle(state.player.x, state.player.y, PLAYER.radius, nx - state.player.x, ny - state.player.y);
        state.player.x = fixed.x;
        state.player.y = fixed.y;
        state.player.angle = turnToward(state.player.angle, Math.atan2(move.y, move.x), 14, dt);
      }
    }

    // --- guards
    for (const guard of state.guards) updateGuard(guard, dt);

    if (attract) return EVENT_NONE;

    // --- detection
    let seen = false;
    for (const guard of state.guards) {
      guard.sees = guardSeesPlayer(guard);
      if (guard.sees) seen = true;
    }
    if (seen) {
      let rate = DETECTION.fillRate;
      if (state.player.sneaking) rate *= DETECTION.sneakFactor;
      if (playerInShadow()) rate *= DETECTION.shadowFactor;
      state.suspicion = Math.min(1, state.suspicion + rate * dt);
    } else {
      state.suspicion = Math.max(0, state.suspicion - DETECTION.drainRate * dt);
    }

    if (state.suspicion >= 1 && state.alarm <= 0) {
      state.alarm = DETECTION.alarmSeconds;
      for (const guard of state.guards) {
        guard.mode = 'chase';
        guard.chaseX = state.player.x;
        guard.chaseY = state.player.y;
        guard.wait = 0;
      }
      events |= EVENT_ALARM;
    }

    if (state.alarm > 0) {
      state.alarm -= dt;
      // A guard that spots the player mid-chase updates the hunt.
      for (const guard of state.guards) {
        if (guard.sees) {
          guard.chaseX = state.player.x;
          guard.chaseY = state.player.y;
        }
        if (Math.hypot(guard.x - state.player.x, guard.y - state.player.y) < GUARD.catchDistance) {
          state.lives -= 1;
          events |= EVENT_CAUGHT;
          if (state.lives <= 0) {
            state.status = STATUS_OVER;
            return events | EVENT_OVER;
          }
          respawnAfterCaught();
          return events;
        }
      }
      if (state.alarm <= 0) {
        state.alarm = 0;
        state.suspicion = 0;
        for (const guard of state.guards) {
          guard.mode = 'return';
          guard.waypoint = nearestWaypoint(guard);
          const target = guard.route[guard.waypoint];
          // If a wall stands between the guard and its route, go via the doorway.
          guard.returnTarget = hasLineOfSight(guard.x, guard.y, target.x, target.y) ? target : DOORWAY;
        }
      }
    }

    // --- loot
    for (const gem of state.gems) {
      if (!gem.taken && Math.hypot(gem.x - state.player.x, gem.y - state.player.y) < LOOT.radius) {
        gem.taken = true;
        state.loot += 1;
        state.score += LOOT.points;
        events |= EVENT_LOOT;
      }
    }

    // --- exit
    if (pointInRect(state.player.x, state.player.y, EXIT)) {
      state.status = STATUS_WON;
      state.score += Math.max(0, TIME_BONUS.seconds - Math.floor(state.time)) * TIME_BONUS.perSecond;
      return events | EVENT_WIN;
    }

    return events;
  }

  reset();
  return { state, reset, step };
}
