import { TextToSpeech } from '@capacitor-community/text-to-speech'
import { Capacitor } from '@capacitor/core'

export async function speak(text) {
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
    lang: 'en-US',
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    category: 'alarm'
  })
}

export async function stopSpeaking() {
  try {
    await TextToSpeech.stop()
  } catch {}
}