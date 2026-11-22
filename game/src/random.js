// A small seeded random number generator (mulberry32): the same seed gives the same
// sequence, which is what makes the screenshot scenes repeatable. The level itself is
// fixed, so the seed only shuffles cosmetic details such as floor sparkle.

export function createRandom(seed) {
  let state = seed | 0;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}
