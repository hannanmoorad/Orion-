# ORION

Aapka personal AI bhai — voice-match, bolta hua alarm, yaad-dasht. Phone pe hi.

## Features

- Voice lock: sirf aapki awaaz ("Orion wake up") app kholti hai
- Voice alarms: exact time par TTS aawaaz mein message bolta hai
  - 10 minute pehle warning
  - Repeat daily support
  - Reboot ke baad bhi alarm wapas set (boot receiver)
- Yaad-dasht (reminders) — chat se bolo: "Yaad rakhna dawai 2 baje"
- Chat: tap-to-talk, Roman Urdu mein jawab
- Awaaz test / settings

## Tech

- Capacitor 7 + React (Vite)
- Custom native plugin `OrionAlarm`: AlarmManager + TextToSpeech + Boot receiver
- SpeechRecognition + TextToSpeech community plugins

## Build

```bash
npm install
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```

APK: `android/app/build/outputs/apk/debug/app-debug.apk`
(ya GitHub Actions se artifact download karein)
