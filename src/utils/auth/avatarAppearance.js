const AVATAR_PALETTES = [
  { end: '#2563eb', shadow: 'rgba(37, 99, 235, 0.32)', start: '#60a5fa' },
  { end: '#0f766e', shadow: 'rgba(15, 118, 110, 0.28)', start: '#34d399' },
  { end: '#0369a1', shadow: 'rgba(3, 105, 161, 0.28)', start: '#38bdf8' },
  { end: '#c2410c', shadow: 'rgba(194, 65, 12, 0.28)', start: '#fb923c' },
  { end: '#be185d', shadow: 'rgba(190, 24, 93, 0.28)', start: '#f472b6' },
  { end: '#0f766e', shadow: 'rgba(13, 148, 136, 0.26)', start: '#2dd4bf' },
  { end: '#b45309', shadow: 'rgba(180, 83, 9, 0.28)', start: '#fbbf24' },
  { end: '#1d4ed8', shadow: 'rgba(29, 78, 216, 0.28)', start: '#93c5fd' },
]

function normalizeSeed(value) {
  return String(value || '').trim().toLowerCase()
}

function hashSeed(value) {
  const seed = normalizeSeed(value)
  if (!seed) {
    return 0
  }

  let hash = 0
  for (const char of seed) {
    hash = ((hash << 5) - hash) + char.charCodeAt(0)
    hash |= 0
  }

  return Math.abs(hash)
}

export function getAvatarInitial(value, fallback = 'U') {
  const normalized = String(value || '').trim()
  const firstCharacter = Array.from(normalized)[0]
  return (firstCharacter || fallback).toUpperCase()
}

export function getAvatarStyle(value) {
  const palette = AVATAR_PALETTES[hashSeed(value) % AVATAR_PALETTES.length]
  return {
    '--avatar-accent-end': palette.end,
    '--avatar-accent-shadow': palette.shadow,
    '--avatar-accent-start': palette.start,
  }
}
