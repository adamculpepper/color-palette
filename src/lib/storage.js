// Namespaced localStorage helpers. Every key this app writes is prefixed with
// `palette-` so the site can share an origin with other tools without collisions.
// Access is guarded: localStorage throws when storage is disabled or full, and a
// preference failing to persist must never take the app down.

const NAMESPACE = 'palette'

export const STORAGE_KEYS = {
  theme: 'theme',
  sidebarSections: 'sections',
  exportOptions: 'export-options',
}

function namespacedKey(name) {
  return `${NAMESPACE}-${name}`
}

export function readStoredString(name, fallback = null) {
  try {
    const raw = localStorage.getItem(namespacedKey(name))
    return raw === null ? fallback : raw
  } catch {
    return fallback
  }
}

export function writeStoredString(name, value) {
  try {
    localStorage.setItem(namespacedKey(name), value)
  } catch {
    /* storage unavailable — the preference simply will not survive a reload */
  }
}

export function readStoredJson(name, fallback) {
  const raw = readStoredString(name)
  if (raw === null) return fallback
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function writeStoredJson(name, value) {
  try {
    writeStoredString(name, JSON.stringify(value))
  } catch {
    /* value could not be serialized — nothing to persist */
  }
}

export function removeStored(name) {
  try {
    localStorage.removeItem(namespacedKey(name))
  } catch {
    /* storage unavailable */
  }
}
