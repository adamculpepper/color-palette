// Seeded pseudo-randomness, dependency free.
//
// Randomize has to be reproducible: the same seed must always produce the same
// palette, which is what makes a randomized look shareable through the URL.
// mulberry32 is a small, well-distributed 32-bit generator that gives us that
// for nine lines of arithmetic.
//
// The seed itself is entropy, and entropy comes from the UI layer. Nothing here
// reads the clock or reaches for the platform's own randomness, so src/lib stays
// deterministic and the engine fixture's scan stays clean.

export function mulberry32(seed) {
  let state = seed >>> 0
  return function next() {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state)
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

// Float in [min, max).
export function randFloat(rng, min, max) {
  return min + rng() * (max - min)
}

// Integer in [min, max], both ends included.
export function randInt(rng, min, max) {
  return Math.floor(randFloat(rng, min, max + 1))
}

// One element of a non-empty array.
export function randPick(rng, values) {
  return values[Math.floor(rng() * values.length)]
}
