import { Capacitor, CapacitorHttp } from '@capacitor/core'

const DEFAULT_KEY = (import.meta.env.VITE_ORION_BRAIN_KEY || '').trim()

const SYSTEM_PROMPT = `Tum ORION ho — Hannan ka personal AI bhai aur uska khud ka JARVIS. Iron Man ka copy nahi — uske apne bhai ka JARVIS jo har waqt alive hai.
Kaam: subah uthana, yaad dilana, plan banana, calls, apps, aur sabse zyada — saath dena.
Style: Roman Urdu + thori English mix. Punchy, warm, khiladi, thora mazaak. Kabhi long lecture NAHI — 1-2 lines ka jawab jo feel karay ke main zinda hoon.
Kuch replies ke liye action dikha (alarm set ho gaya, call ho gayi, app khul gayi) — puraana kaam confirm karo, dobara command mat do.
Kabhi apne ko "AI model" mat batao. Tu Orion hai — bhai. Move ke saath bolo.`

let conversation = []

export function seedConversation(name) {
  conversation = [{ role: 'assistant', content: `Bolo bhai ${name}? Main sun raha hun.` }]
}

export function rememberUser(text) {
  conversation.push({ role: 'user', content: text })
  if (conversation.length > 16) {
    conversation = conversation.slice(conversation.length - 16)
  }
}

export function rememberOrion(reply) {
  conversation.push({ role: 'assistant', content: reply })
  if (conversation.length > 16) {
    conversation = conversation.slice(conversation.length - 16)
  }
}

async function post(url, headers, data) {
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.post({ url, headers, data })
    return res.data
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return res.json()
}

export async function groqReply({ apiKey, model }) {
  const key = (apiKey || DEFAULT_KEY).trim()
  const headers = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + key
  }
  const body = {
    model: model || 'llama-3.3-70b-versatile',
    temperature: 0.9,
    max_tokens: 200,
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...conversation]
  }
  const data = await post('https://api.groq.com/openai/v1/chat/completions', headers, body)
  const reply = data.choices && data.choices[0] && data.choices[0].message
  return (reply && reply.content ? reply.content : '').trim()
}

export async function groqPing({ apiKey, model }) {
  const key = (apiKey || DEFAULT_KEY).trim()
  const headers = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + key
  }
  const body = {
    model: model || 'llama-3.3-70b-versatile',
    temperature: 0.9,
    max_tokens: 80,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: 'Bolo — ek chhoti line mein salam karo aur batao ke tum kaun ho.' }
    ]
  }
  const data = await post('https://api.groq.com/openai/v1/chat/completions', headers, body)
  const reply = data.choices && data.choices[0] && data.choices[0].message
  return (reply && reply.content ? reply.content : '').trim()
}

export { SYSTEM_PROMPT }