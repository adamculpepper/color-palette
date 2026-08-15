// Reading colors the user typed or pasted. Nothing here throws: bad tokens come
// back as rejections carrying their line number so the import UI can point at
// the exact line instead of failing the whole paste.

import { hexToRgb, rgbToHex } from './oklch.js'

// A functional notation is one token even though it contains commas and spaces;
// everything else breaks on whitespace, commas, semicolons and pipes.
const TOKEN_PATTERN = /[a-z]+\([^)]*\)|[^\s,;|]+/gi
const FUNCTIONAL_PATTERN = /^(rgba?)\(([^)]*)\)$/i
const NUMBER_PATTERN = /-?\d*\.?\d+%?/g
const TRIMMABLE_EDGES = /^["'`:<>[\]{}]+|["'`:<>[\]{}]+$/g
// English is full of words spelled in hex: cafe, decade, beef, added, facade.
// A token that skips the hash has to look like a machine wrote it — full six or
// eight digit length, and at least one actual digit in it. With the hash the
// user has said what they meant, so every CSS hex form is still read.
const BARE_HEX_PATTERN = /^[0-9a-f]{6}(?:[0-9a-f]{2})?$/i
const CONTAINS_DIGIT = /\d/

function channelFromToken(token) {
  if (token.endsWith('%')) return (parseFloat(token) / 100) * 255
  return parseFloat(token)
}

export function normalizeHex(input) {
  if (typeof input !== 'string') return null
  const token = input.trim().replace(TRIMMABLE_EDGES, '')
  if (!token) return null

  const functional = FUNCTIONAL_PATTERN.exec(token)
  if (functional) {
    const parts = functional[2].match(NUMBER_PATTERN)
    if (!parts || parts.length < 3) return null
    const [r, g, b] = parts.slice(0, 3).map(channelFromToken)
    if ([r, g, b].some((channel) => !Number.isFinite(channel))) return null
    return rgbToHex({ r, g, b })
  }

  if (!token.startsWith('#') && !(BARE_HEX_PATTERN.test(token) && CONTAINS_DIGIT.test(token))) {
    return null
  }

  const rgb = hexToRgb(token)
  return rgb ? rgbToHex(rgb) : null
}

export function parseColorList(text) {
  const source = typeof text === 'string' ? text : ''
  const colors = []
  const rejected = []
  TOKEN_PATTERN.lastIndex = 0

  let match = TOKEN_PATTERN.exec(source)
  while (match) {
    const token = match[0]
    const hex = normalizeHex(token)
    if (hex) {
      colors.push(hex)
    } else {
      const line = source.slice(0, match.index).split('\n').length
      rejected.push({ token, line })
    }
    match = TOKEN_PATTERN.exec(source)
  }

  return { colors, rejected }
}
