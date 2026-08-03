import { Capacitor } from '@capacitor/core'
import { SpeechRecognition } from '@capacitor-community/speech-recognition'

const hub = new Set()
let listeners = null
const subs = new Set()

async function ensureListeners() {
  if (listeners || !Capacitor.isNativePlatform()) return
  try {
    await SpeechRecognition.requestPermissions()
  } catch {}
  let onResult, onPartial, onError, onEnd
  const regs = []
  try {
    onResult = await SpeechRecognition.addListener('onResult', (data) => {
      if (data.matches && data.matches.length) {
        const first = data.matches[0]
        hub.forEach((cb) => cb.onResult && cb.onResult(first))
      }
    })
    regs.push(onResult)
  } catch {}
  try {
    onPartial = await SpeechRecognition.addListener('partialResults', (data) => {
      if (data.matches && data.matches.length) {
        const first = data.matches[0]
        hub.forEach((cb) => cb.onPartial && cb.onPartial(first))
      }
    })
    regs.push(onPartial)
  } catch {}
  try {
    onError = await SpeechRecognition.addListener('onError', (data) => {
      hub.forEach((cb) => cb.onError && cb.onError(data))
    })
    regs.push(onError)
  } catch {}
  try {
    onEnd = await SpeechRecognition.addListener('onEnd', () => {
      hub.forEach((cb) => cb.onEnd && cb.onEnd())
    })
    regs.push(onEnd)
  } catch {}
  listeners = () => regs.forEach((l) => l && l.remove())
}

export async function speechAvailable() {
  try {
    if (!Capacitor.isNativePlatform()) return true
    const r = await SpeechRecognition.available()
    return r.available
  } catch {
    return false
  }
}

export async function speechPermissionState() {
  try {
    const r = await SpeechRecognition.checkPermissions()
    return r.speechRecognition
  } catch {
    return 'prompt'
  }
}

export function subscribeSpeech(cb) {
  hub.add(cb)
  return () => hub.delete(cb)
}

let activeLang = 'en-US'

export async function startListening(lang) {
  await ensureListeners()
  if (lang) activeLang = lang
  if (!Capacitor.isNativePlatform()) {
    return {
      ok: false,
      dev: true,
      reason: 'dev'
    }
  }
  try {
    await SpeechRecognition.start({
      language: activeLang,
      maxResults: 5,
      partialResults: true,
      popup: false
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: e.message || 'unknown' }
  }
}

export async function stopListening() {
  try {
    await SpeechRecognition.stop()
  } catch {}
}