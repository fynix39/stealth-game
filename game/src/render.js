// Canvas painting: the museum floor, the guards' cones, the player, and the screens
// over them. The playfield is a fixed 1280x720; the renderer scales it to the window
// with letterboxing, so the game looks the same at any size. Cones are drawn under
// the people but over the floor, so a cone sweeping across the player reads at once.

import { FIELD, GUARD, PLAYER, PALETTE, FONT } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WIN = 'win';
export const SCREEN_OVER = 'over';

const TILE = 80;

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const scale = Math.min(w / FIELD.width, h / FIELD.height) * dpr;
    const ox = (w * dpr - FIELD.width * scale) / 2;
    const oy = (h * dpr - FIELD.height * scale) / 2;
    ctx.setTransform(scale, 0, 0, scale, ox, oy);
  }

  function drawFloor() {
    ctx.fillStyle = PALETTE.floorA;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = PALETTE.floorB;
    for (let y = 0; y < FIELD.height / TILE; y += 1) {
      for (let x = 0; x < FIELD.width / TILE; x += 1) {
        if ((x + y) % 2 === 0) ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
    ctx.strokeStyle = PALETTE.floorLine;
    ctx.lineWidth = 2;
    for (let x = 0; x <= FIELD.width; x += TILE) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, FIELD.height);
      ctx.stroke();
    }
    for (let y = 0; y <= FIELD.height; y += TILE) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(FIELD.width, y);
      ctx.stroke();
    }
  }

  function drawShadows(state) {
    ctx.fillStyle = PALETTE.shadowZone;
    for (const s of state.shadows) {
      ctx.beginPath();
      ctx.roundRect(s.x, s.y, s.w, s.h, 18);
      ctx.fill();
    }
  }

  function drawExit(state) {
    const e = state.exit;
    const glow = ctx.createRadialGradient(
      e.x + e.w / 2, e.y + e.h / 2, 4,
      e.x + e.w / 2, e.y + e.h / 2, 90,
    );
    glow.addColorStop(0, 'rgba(61, 220, 132, 0.55)');
    glow.addColorStop(1, 'rgba(61, 220, 132, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(e.x - 60, e.y - 60, e.w + 120, e.h + 120);
    ctx.fillStyle = PALETTE.exitDark;
    ctx.fillRect(e.x, e.y, e.w, e.h);
    ctx.fillStyle = PALETTE.exit;
    ctx.fillRect(e.x + 6, e.y + 6, e.w - 12, e.h - 12);
    ctx.fillStyle = '#0d0f14';
    ctx.font = `bold 17px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EXIT', e.x + e.w / 2, e.y + e.h / 2);
  }

  function drawGems(state) {
    for (const gem of state.gems) {
      if (gem.taken) continue;
      ctx.save();
      ctx.translate(gem.x, gem.y);
      ctx.fillStyle = PALETTE.gem;
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(10, 0);
      ctx.lineTo(0, 13);
      ctx.lineTo(-10, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = PALETTE.gemDark;
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(10, 0);
      ctx.lineTo(0, 4);
      ctx.lineTo(-10, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawCrates(state) {
    for (const c of state.crates) {
      ctx.fillStyle = PALETTE.crateDark;
      ctx.fillRect(c.x + 3, c.y + 4, c.w, c.h);
      ctx.fillStyle = PALETTE.crate;
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.strokeStyle = PALETTE.crateEdge;
      ctx.lineWidth = 3;
      ctx.strokeRect(c.x + 2, c.y + 2, c.w - 4, c.h - 4);
      ctx.beginPath();
      ctx.moveTo(c.x + 4, c.y + 4);
      ctx.lineTo(c.x + c.w - 4, c.y + c.h - 4);
      ctx.moveTo(c.x + c.w - 4, c.y + 4);
      ctx.lineTo(c.x + 4, c.y + c.h - 4);
      ctx.stroke();
    }
  }

  function drawWalls(state) {
    for (const w of state.walls) {
      ctx.fillStyle = PALETTE.wall;
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = PALETTE.wallTop;
      if (w.w >= w.h) ctx.fillRect(w.x, w.y, w.w, 5);
      else ctx.fillRect(w.x, w.y, 5, w.h);
    }
  }

  function drawCone(guard, hot) {
    ctx.fillStyle = hot ? PALETTE.coneHot : PALETTE.cone;
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.arc(guard.x, guard.y, GUARD.coneRange, guard.angle - GUARD.coneHalfAngle, guard.angle + GUARD.coneHalfAngle);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = PALETTE.coneEdge;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.lineTo(
      guard.x + Math.cos(guard.angle - GUARD.coneHalfAngle) * GUARD.coneRange,
      guard.y + Math.sin(guard.angle - GUARD.coneHalfAngle) * GUARD.coneRange,
    );
    ctx.moveTo(guard.x, guard.y);
    ctx.lineTo(
      guard.x + Math.cos(guard.angle + GUARD.coneHalfAngle) * GUARD.coneRange,
      guard.y + Math.sin(guard.angle + GUARD.coneHalfAngle) * GUARD.coneRange,
    );
    ctx.stroke();
  }

  function drawGuards(state) {
    const hot = state.alarm > 0 || state.suspicion > 0.55;
    for (const guard of state.guards) drawCone(guard, hot || guard.sees);
    for (const guard of state.guards) {
      ctx.fillStyle = PALETTE.guardDark;
      ctx.beginPath();
      ctx.arc(guard.x + 2, guard.y + 3, GUARD.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.guard;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
      ctx.fill();
      // A nose showing which way the guard faces.
      ctx.fillStyle = '#ffd9d6';
      ctx.beginPath();
      ctx.arc(
        guard.x + Math.cos(guard.angle) * (GUARD.radius - 3),
        guard.y + Math.sin(guard.angle) * (GUARD.radius - 3),
        4.5, 0, Math.PI * 2,
      );
      ctx.fill();
      if (guard.sees || state.alarm > 0) {
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold 22px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('!', guard.x, guard.y - GUARD.radius - 4);
      }
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    if (p.sneaking) {
      ctx.strokeStyle = 'rgba(53, 208, 186, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, PLAYER.radius + 7, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = PALETTE.playerDark;
    ctx.beginPath();
    ctx.arc(p.x + 2, p.y + 3, PLAYER.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(p.x, p.y, PLAYER.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0d3f38';
    ctx.beginPath();
    ctx.arc(
      p.x + Math.cos(p.angle) * (PLAYER.radius - 4),
      p.y + Math.sin(p.angle) * (PLAYER.radius - 4),
      4.5, 0, Math.PI * 2,
    );
    ctx.fill();
  }

  function drawHud(state) {
    // Suspicion meter, top centre.
    const w = 260;
    const x = (FIELD.width - w) / 2;
    const y = 14;
    ctx.fillStyle = 'rgba(13, 15, 20, 0.75)';
    ctx.beginPath();
    ctx.roundRect(x - 8, y - 6, w + 16, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#2a3040';
    ctx.fillRect(x, y, w, 12);
    const suspicion = state.suspicion;
    ctx.fillStyle = state.alarm > 0 ? PALETTE.danger : suspicion > 0.55 ? '#f2c94c' : PALETTE.player;
    ctx.fillRect(x, y, w * suspicion, 12);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 13px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(state.alarm > 0 ? 'ALARM!' : 'SUSPICION', x + w / 2, y + 15);

    // Lives, top left.
    ctx.textAlign = 'left';
    ctx.font = `bold 22px ${FONT}`;
    ctx.fillStyle = PALETTE.danger;
    ctx.fillText('♥'.repeat(Math.max(0, state.lives)), 36, 16);

    // Time and sneak state, top left under the lives: the top-right corner holds
    // the exit door, so nothing is drawn over it.
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `15px ${FONT}`;
    ctx.fillText(formatTime(state.time), 36, 46);
    if (state.player.sneaking) {
      ctx.fillStyle = PALETTE.player;
      ctx.font = `bold 14px ${FONT}`;
      ctx.fillText('SNEAKING', 36, 68);
    }

    // Loot, top right (above the exit door).
    ctx.textAlign = 'right';
    ctx.font = `bold 18px ${FONT}`;
    ctx.fillStyle = PALETTE.gem;
    ctx.fillText(`◆ ${state.loot}/3`, FIELD.width - 36, 18);
  }

  function drawPanel(title, lines, accent) {
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = accent;
    ctx.font = `bold 64px ${FONT}`;
    ctx.fillText(title, FIELD.width / 2, 250);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `22px ${FONT}`;
    lines.forEach((line, i) => {
      ctx.fillText(line, FIELD.width / 2, 330 + i * 34);
    });
  }

  function drawTitle(state, best) {
    drawPanel('SILENT STEPS', [
      'A midnight museum heist. Reach the green EXIT unseen.',
      'WASD / arrows to move · hold Shift to sneak · hide behind crates',
      'Stay out of the guards\u2019 cones — or slip away before suspicion fills.',
      best > 0 ? `Best score: ${best}` : 'Three gems hide off the main path. Three lives.',
      '',
      'Press SPACE or click to start',
    ], PALETTE.player);
  }

  function drawWin(state, best) {
    drawPanel('ESCAPED!', [
      `You slipped out unseen in ${formatTime(state.time)}.`,
      `Loot: ${state.loot}/3 gems · Score: ${state.score}`,
      best > 0 ? `Best score: ${best}` : '',
      '',
      'Press SPACE to play again',
    ], PALETTE.exit);
  }

  function drawOver(state, best) {
    drawPanel('CAUGHT!', [
      'The guards finally got you.',
      `Loot: ${state.loot}/3 gems · Score: ${state.score}`,
      best > 0 ? `Best score: ${best}` : '',
      '',
      'Press SPACE to try again',
    ], PALETTE.danger);
  }

  function drawPaused() {
    drawPanel('PAUSED', ['Press P or SPACE to keep sneaking.'], PALETTE.text);
  }

  function draw(state, screen, best) {
    resize();
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(-100, -100, FIELD.width + 200, FIELD.height + 200);
    drawFloor();
    drawShadows(state);
    drawExit(state);
    drawGems(state);
    drawCrates(state);
    drawWalls(state);
    drawGuards(state);
    drawPlayer(state);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(state);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_WIN) drawWin(state, best);
    else if (screen === SCREEN_OVER) drawOver(state, best);
    else if (screen === SCREEN_PAUSED) drawPaused();
  }

  return { draw };
}
