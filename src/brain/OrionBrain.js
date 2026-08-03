const FALLBACKS = [
  'Haan bhai, sun raha hun!',
  'Bolo bhai, kya kaam hai?',
  'Main yahan hoon. Kya chahiye?',
  'Hmm, batao — alarm, yaad-dasht, ya bas gupshup?',
  'Samajh gaya bhai. Phir zara slow bolo to?',
  'Main tumhara Orion hun — bolte jao, main sab sambhal leta hun.',
  'Nice, bhai! Aise hi bolo.',
  'Hmm... maza toh aa raha hai. Aur bolo.'
]

export const defaultWakeMessage = 'Hannan, uth ja bhai! Office jana hai.'

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

  if (/kya (time|wakt)|kitne baje|time bata/i.test(text)) {
    result.reply = `Abhi ${timeToHuman(now)} hain bhai.`
    return result
  }

  if (/kaun (hai|ho)|who are you|tum kaun/i.test(text)) {
    result.reply = `Main Orion hun — ${name} ka AI bhai. Alarm, yaad-dasht aur companies sab yahan. Tum bolo, main chalata hun.`
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