import { Preferences } from '@capacitor/preferences'

const KEY_PREFIX = 'orion'

export async function getItem(key) {
  const { value } = await Preferences.get({ key: `${KEY_PREFIX}_${key}` })
  return value
}

export async function setItem(key, value) {
  await Preferences.set({ key: `${KEY_PREFIX}_${key}`, value })
}

export async function removeItem(key) {
  await Preferences.remove({ key: `${KEY_PREFIX}_${key}` })
}

export async function getJSON(key, fallback = null) {
  const raw = await getItem(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export async function setJSON(key, value) {
  await setItem(key, JSON.stringify(value))
}