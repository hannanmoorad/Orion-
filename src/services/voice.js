import { TextToSpeech } from '@capacitor-community/text-to-speech'
import { Capacitor } from '@capacitor/core'

export async function speak(text, lang = 'en-US') {
  if (!Capacitor.isNativePlatform()) {
    try {
      window.speechSynthesis.cancel()
    } catch {}
    return
  }
  try {
    await TextToSpeech.stop()
  } catch {}
  await TextToSpeech.speak({
    text,
    lang,
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    category: 'media'
  })
}

export async function ttsLanguages() {
  try {
    const r = await TextToSpeech.getSupportedLanguages()
    const list = (r && r.languages ? r.languages : []) || []
    return list.length
  } catch (e) {
    return 'ERR: ' + (e.message || e)
  }
}

export async function stopSpeaking() {
  try {
    await TextToSpeech.stop()
  } catch {}
}