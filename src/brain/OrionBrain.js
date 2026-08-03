const FALLBACKS = [
  'Haan bhai, sun raha hun!',
  'Bolo bhai, kya kaam hai?',
  'Main yahan hoon. Kya chahiye?',
  'Hmm, batao — alarm, yaad-dasht, call, ya bas gupshup?',
  'Samajh gaya bhai. Phir zara slow bolo to?',
  'Main tumhara Orion hun — bolte jao, main sab sambhal leta hun.',
  'Nice, bhai! Aise hi bolo.',
  'Hmm... maza toh aa raha hai. Aur bolo.'
]

export const defaultWakeMessage = 'Hannan, uth ja bhai! Office jana hai.'

export const APP_MAP = [
  { names: ['instagram', 'insta'], pkg: 'com.instagram.android' },
  { names: ['whatsapp', 'wap'], pkg: 'com.whatsapp' },
  { names: ['youtube', 'yt'], pkg: 'com.google.android.youtube' },
  { names: ['chrome', 'browser'], pkg: 'com.android.chrome' },
  { names: ['maps', 'map', 'navigator'], pkg: 'com.google.android.apps.maps' },
  { names: ['play store', 'playstore'], pkg: 'com.android.vending' },
  { names: ['settings', 'seting'], pkg: 'com.android.settings' },
  { names: ['camera'], pkg: 'com.android.camera' },
  { names: ['gallery', 'photos'], pkg: 'com.google.android.apps.photos' },
  { names: ['gmail', 'mail'], pkg: 'com.google.android.gm' },
  { names: ['facebook', 'fb'], pkg: 'com.facebook.katana' },
  { names: ['tiktok'], pkg: 'com.zhiliaoapp.musically' },
  { names: ['snapchat'], pkg: 'com.snapchat.android' },
  { names: ['phone', 'dialer', 'calls'], pkg: 'com.google.android.dialer' },
  { names: ['spotify'], pkg: 'com.spotify.music' },
  { names: ['netflix'], pkg: 'com.netflix.mediaclient' },
  { names: ['telegram'], pkg: 'org.telegram.messenger' }
]

export function findApp(raw) {
  const q = (raw || '').toLowerCase()
  let best = null
  for (const app of APP_MAP) {
    for (const n of app.names) {
      if (q.includes(n)) {
        if (!best || n.length > best.nameLen) {
          best = { pkg: app.pkg, nameLen: n.length }
        }
      }
    }
  }
  return best ? best.pkg : null
}

export function timeToHuman(d) {
  let h = d.getHours()
  const m = d.getMinutes()
  const period = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${String(m).padStart(2, '0')} ${period}`
}

export function respond(raw, { name = 'Hannan', now = new Date() } = {}) {
  const text = (raw || '').toLowerCase()
  const result = { reply: '', action: null }

  const alarmMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i)
  const wantsAlarm = /alarm|utha|uthao|jaga|wake/i.test(text)
  if (wantsAlarm && alarmMatch) {
    let hour = parseInt(alarmMatch[1], 10)
    let minute = alarmMatch[2] ? parseInt(alarmMatch[2], 10) : 0
    const period = (alarmMatch[3] || '').toLowerCase()
    if (period === 'pm' && hour < 12) hour += 12
    if (period === 'am' && hour === 12) hour = 0
    const when = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute)
    result.reply = `Done bhai! ${timeToHuman(when)} par utha dunga. "${defaultWakeMessage}"`
    result.action = { type: 'alarm', hour, minute, message: defaultWakeMessage, repeatDaily: /roz|daily|every|har/i.test(text) }
    return result
  }

  if (/yaad rakh|yaad rakho|remember/i.test(text)) {
    const memo = raw.replace(/^(ivan|orion)[,\s]*/i, '').replace(/^(yaad rakh|yaad rakho|remember)[,\s]*/i, '').replace(/^:/, '').trim() || raw.trim()
    result.reply = `Yaad rakh liya: "${memo}". Jab zaroorat padegi, main bata dunga.`
    result.action = { type: 'memory', text: memo }
    return result
  }

  const callMatch = text.match(/(?:call|ko call|phone|bulao|bula)\s*([+\d][\d\s]{6,})/)
  if (callMatch) {
    const number = callMatch[1].replace(/\s+/g, '')
    result.reply = `Call karta hun: ${number}.`
    result.action = { type: 'call', number }
    return result
  }

  const smsMatch = text.match(/(?:sms|message|msg|text)\s+([+\d][\d\s]{6,})\s+(.+)/i)
  if (smsMatch) {
    const number = smsMatch[1].replace(/\s+/g, '')
    result.reply = `SMS ja raha hai: "${smsMatch[2].trim()}" ko ${number}.`
    result.action = { type: 'sms', number, text: smsMatch[2].trim() }
    return result
  }

  if (/kholo|open|launch|chalao|khol|on karo|dikhao/i.test(text) && !/type/i.test(text)) {
    const pkg = findApp(raw)
    if (pkg) {
      result.reply = 'Khol raha hun bhai!'
      result.action = { type: 'open', pkg }
      return result
    }
    result.reply = 'Kaunsa app? Bolo: "Instagram kholo", "WhatsApp kholo"...'
    return result
  }

  if (/screen|screen read|kya likha|kya dikh|dikh raha|padho/i.test(text)) {
    result.reply = 'Screen parh raha hun...'
    result.action = { type: 'screen' }
    return result
  }

  if (/notification|notifications|kya aaya|koi message aaya|koi baat aayi/i.test(text)) {
    result.reply = 'Notifications dekh raha hun...'
    result.action = { type: 'notifs' }
    return result
  }

  if (/^type\s+(.+)/i.test(raw)) {
    const t = raw.replace(/^type\s+/i, '').trim()
    result.reply = `Type kar raha hun: "${t}"`
    result.action = { type: 'type', text: t }
    return result
  }

  if (/contacts|kis kis ke pas/i.test(text)) {
    result.reply = 'Contacts khol raha hun...'
    result.action = { type: 'contacts' }
    return result
  }

  if (/kya (time|wakt)|kitne baje|time bata/i.test(text)) {
    result.reply = `Abhi ${timeToHuman(now)} hain bhai.`
    return result
  }

  if (/kaun (hai|ho)|who are you|tum kaun/i.test(text)) {
    result.reply = `Main Orion hun — ${name} ka AI bhai. Alarm, yaad-dasht, call, SMS, apps — sab yahan. Tum bolo, main chalata hun.`
    return result
  }

  if (/salam|salaam|hello|hey|assalam|^hi/i.test(text)) {
    const h = now.getHours()
    const greeting = h < 12 ? 'Subah bakhair' : h < 18 ? 'Dopahar bakhair' : 'Sham bakhair'
    result.reply = `${greeting} bhai! ${name}, kya haal? Batao kya karna hai.`
    return result
  }

  if (/shukriya|thanks|thank|mashallah/i.test(text)) {
    result.reply = 'Haan bhai, yehi kaam hai. Kabhi bhi bolo, main hoon.'
    return result
  }

  result.reply = FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)]
  return result
}