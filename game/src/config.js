// Every tuning number and colour in one place. The museum floor is a fixed 1280x720
// logical area; the renderer scales it to the window, so no rule below depends on the
// screen size. Guards, walls and loot live in world.js; this file only tunes them.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  /** Pixels per second on a normal stride. */
  speed: 210,
  /** Sneaking is slower but twice as hard to spot. */
  sneakSpeed: 115,
  lives: 3,
};

export const GUARD = {
  radius: 13,
  patrolSpeed: 88,
  chaseSpeed: 155,
  /** How far a guard can see, in pixels. */
  coneRange: 235,
  /** Half of the vision cone's angle, in radians (about 34 degrees each side). */
  coneHalfAngle: 0.6,
  /** A guard this close to the player during an alarm catches them. */
  catchDistance: 30,
  /** Seconds a guard waits at each patrol waypoint, sweeping its cone. */
  pauseAtWaypoint: 0.9,
};

export const DETECTION = {
  /** Suspicion per second while the player stands inside a cone in the open. */
  fillRate: 1.15,
  /** Detection fills this much slower while sneaking, and this much slower in shadow. */
  sneakFactor: 0.5,
  shadowFactor: 0.5,
  /** Suspicion per second while no guard can see the player. */
  drainRate: 0.45,
  /** Seconds an alarm lasts before the guards give up and return to patrol. */
  alarmSeconds: 4,
};

export const LOOT = { points: 100, radius: 26 };

/** Points for escaping fast: 5 per second left under ten minutes. */
export const TIME_BONUS = { seconds: 600, perSecond: 5 };

export const PALETTE = {
  backdrop: '#0d0f14',
  floorA: '#262b3a',
  floorB: '#20242f',
  floorLine: '#1a1e28',
  wall: '#3a4152',
  wallTop: '#5a6378',
  crate: '#7a5a34',
  crateDark: '#5d4426',
  crateEdge: '#96714a',
  shadowZone: 'rgba(2, 4, 10, 0.42)',
  player: '#35d0ba',
  playerDark: '#1f8f80',
  guard: '#e5534b',
  guardDark: '#a83a34',
  cone: 'rgba(242, 201, 76, 0.20)',
  coneHot: 'rgba(229, 83, 75, 0.32)',
  coneEdge: 'rgba(242, 201, 76, 0.35)',
  exit: '#3ddc84',
  exitDark: '#1f9e57',
  gem: '#f2c94c',
  gemDark: '#c79a2e',
  panel: 'rgba(13, 15, 20, 0.88)',
  text: '#eef1f5',
  muted: '#8b93a3',
  danger: '#ff6b5e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'silent-steps.best';
