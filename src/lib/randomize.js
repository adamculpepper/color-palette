// Randomize, driven entirely by the param registry.
//
// A param takes part only if it carries `randomize: true`, and its bounds come
// from `randomMin`/`randomMax` (sliders) or `randomValues` (selects) when the
// full range would produce ugly palettes. Nothing is listed by name here, so
// adding a knob to the roll is a flag in params.js.
//
// Which group gets rolled depends on where the colors come from. A generated
// rainbow rolls the Generator knobs, because that is the whole palette. A custom
// palette rolls the Adjustments instead: those re-tint the colors the user
// pasted rather than throwing them away. Either way the color count, the step
// ladder, the display options, the naming options and customColors are left
// exactly as they were.
//
// The seed is an argument. Entropy belongs to the UI layer, and passing it in is
// what makes a randomized palette reproducible and therefore shareable.

import { PARAM_REGISTRY, stepPrecision } from '../data/params.js'
import { mulberry32, randFloat, randPick } from './prng.js'

const DEFAULT_TOGGLE_PROBABILITY = 0.3

export const GENERATED_RANDOM_GROUP = 'Generator'
export const CUSTOM_RANDOM_GROUP = 'Adjustments'

export function randomGroupFor(paletteSource) {
  return paletteSource === 'custom' ? CUSTOM_RANDOM_GROUP : GENERATED_RANDOM_GROUP
}

function randomSlider(rng, param) {
  const low = param.randomMin ?? param.min
  const high = param.randomMax ?? param.max
  const snapped = Math.round(randFloat(rng, low, high) / param.step) * param.step
  const bounded = Math.min(param.max, Math.max(param.min, snapped))
  return Number(bounded.toFixed(stepPrecision(param.step)))
}

export function randomizeSettings(settings, seed) {
  const rng = mulberry32(seed >>> 0)
  const group = randomGroupFor(settings.paletteSource)
  const next = { ...settings }

  // Registry order, so the same seed always spends its numbers on the same
  // params and the result is reproducible.
  for (const param of PARAM_REGISTRY) {
    if (!param.randomize || param.group !== group) continue

    switch (param.type) {
      case 'slider':
        next[param.key] = randomSlider(rng, param)
        break
      case 'select':
      case 'segmented':
        next[param.key] = randPick(rng, param.randomValues || param.options.map((option) => option.value))
        break
      case 'toggle':
        next[param.key] = rng() < (param.randomProb ?? DEFAULT_TOGGLE_PROBABILITY)
        break
      default:
        break
    }
  }

  return next
}
