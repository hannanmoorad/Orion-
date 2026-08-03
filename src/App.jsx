import React, { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { SpeechRecognition } from '@capacitor-community/speech-recognition'
import { getJSON, setJSON } from './services/storage'
import { speak, stopSpeaking } from './services/voice'
import { scheduleAlarm, cancelAlarm, OrionAlarm, requestNotificationPermission } from './services/alarm'
import {
  getAccessStatus,
  requestPerm,
  openAccessibilitySettings,
  openNotificationListenerSettings,
  readScreen,
  typeText,
  openPackage,
  doCall,
  doSms,
  getContacts,
  getNotifications
} from './services/access'
import { respond, timeToHuman, defaultWakeMessage, PROACTIVE } from './brain/OrionBrain'
import { groqReply, groqPing, rememberUser, rememberOrion } from './services/groq'
import { subscribeSpeech, startListening, stopListening, speechAvailable, speechPermissionState } from './services/speech'
import OrionAvatar from './components/OrionAvatar'

const WAKE_NAMES = /orion|orian|aryan|arian|oren|aurion|orien|oreo|and wee|arion/i
const WAKE_VERBS = /wake( up)?|suno|sun|utho|utha|uth|listen|hey|hello|open|shuru|start|up/i

function normalize(s) {
  return (s || '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()
}

function matchesWake(s) {
  const n = normalize(s)
  if (!n) return false
  if (WAKE_NAMES.test(n)) return true
  if (WAKE_VERBS.test(" " + n + " ")) return true
  return n.includes('orion') && n.includes('wake')
}

async function hash256(s) {
  try {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('orion::' + s))
    return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    let h = 7
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
    return 'f' + (h >>> 0).toString(16)
  }
}

function useSpeech(onFinal, lang = 'en-US') {
  const [listening, setListening] = useState(false)
  const [live, setLive] = useState('')
  const [err, setErr] = useState('')
  const listeningRef = useRef(false)
  const liveRef = useRef('')
  const gotFinalRef = useRef(false)
  const langRef = useRef(lang)
  langRef.current = lang
  const finalRef = useRef(onFinal)
  finalRef.current = onFinal

  useEffect(() => {
    const unsub = subscribeSpeech({
      onResult: (t) => {
        gotFinalRef.current = true
        setLive('')
        finalRef.current(t)
      },
      onPartial: (t) => {
        liveRef.current = t
        setLive(t)
        setErr('')
      },
      onError: (d) => {
        gotFinalRef.current = true
        setLive('')
        setErr('Voice error (' + (d && d.error != null ? d.error : '?') + '). Mic permission + Google app check karo.')
      },
      onEnd: () => {
        if (!gotFinalRef.current && liveRef.current) {
          finalRef.current(liveRef.current)
        }
        gotFinalRef.current = false
        listeningRef.current = false
        setListening(false)
        setLive('')
      }
    })
    return unsub
  }, [])

  async function start() {
    if (listeningRef.current) {
      await stopListening()
      listeningRef.current = false
      setListening(false)
      setLive('')
      setErr('')
      return
    }
    if (!Capacitor.isNativePlatform()) {
      setListening(true)
      listeningRef.current = true
      setLive('')
      setTimeout(() => {
        const t = window.prompt('Dev mode — boliye: Orion wake up')
        listeningRef.current = false
        setListening(false)
        setLive('')
        if (t) finalRef.current(t)
      }, 300)
      return
    }
    setLive('')
    setErr('')
    const r = await startListening(langRef.current)
    if (!r.ok) {
      setErr('Mic start nahi hua: ' + (r.reason || 'unknown') + ' — Android Settings > Apps > Orion > Permissions mein Mic ON karo.')
      return
    }
    listeningRef.current = true
    setListening(true)
  }

  return { listening, live, err, start }
}

function LiveLine({ listening, live, err }) {
  if (err) return <p className="live-text err">{err}</p>
  if (!listening) return null
  return <p className="live-text">Sun raha hun: "{live || '...'}"</p>
}

function EmptyState({ title, sub }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      <p className="empty-sub">{sub}</p>
    </div>
  )
}

function TabBar({ tab, setTab }) {
  const items = [
    { key: 'chat', label: 'Chat' },
    { key: 'alarm', label: 'Alarm' },
    { key: 'memory', label: 'Yaad' },
    { key: 'settings', label: 'Settings' }
  ]
  return (
    <nav className="tabbar">
      {items.map((i) => (
        <button key={i.key} className={`tab ${tab === i.key ? 'active' : ''}`} onClick={() => setTab(i.key)}>
          {i.label}
        </button>
      ))}
    </nav>
  )
}

function PermissionsBox({ notify }) {
  async function requestMic() {
    try {
      await SpeechRecognition.requestPermissions()
      notify('Microphone: aapne allow kiya? Agar popup aya to Allow dabao.')
    } catch (e) {
      notify('Mic error: ' + (e.message || 'unknown'))
    }
  }

  async function requestNotif() {
    try {
      await requestNotificationPermission()
      notify('Notifications: popup par Allow dabao.')
    } catch (e) {
      notify('Notification error: ' + (e.message || 'unknown'))
    }
  }

  return (
    <div className="panel">
      <h2>Permissions — sab allow karo</h2>
      <button className="ghost" onClick={requestMic}>Microphone</button>
      <button className="ghost" onClick={requestNotif}>Notifications</button>
      <p className="about">Alarm: exact time ki permission Android mein khud granted hai (USE_EXACT_ALARM).</p>
    </div>
  )
}

function ChatScreen({ config, onAlarm, onMemory, notify }) {
  const [messages, setMessages] = useState([
    { role: 'orion', text: `Haan bhai ${config.name}, main Orion hun. Bolo — "12 baje utha dena", ya "yaad rakhna dinner lana", ya bas gupshup.` }
  ])
  const [avatar, setAvatar] = useState('idle')
  const [typed, setTyped] = useState('')
  const endRef = useRef(null)
  const greetedRef = useRef(false)
  const listeningRef = useRef(false)

  useEffect(() => {
    listeningRef.current = listening
  }, [listening])

  useEffect(() => {
    if (!config.proactive) return
    const t = setInterval(() => {
      if (listeningRef.current) return
      const line = PROACTIVE[Math.floor(Math.random() * PROACTIVE.length)]
      say(line)
    }, 180000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.proactive])

  useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (greetedRef.current) return
    greetedRef.current = true
    const t = setTimeout(() => {
      const greeting = `Subah bakhair ${config.name} bhai! Main Orion hun — aapka bhai. Bolo, kya karna hai?`
      setAvatar('speaking')
      setMessages((m) => [...m, { role: 'orion', text: greeting }])
      speak(greeting, config.lang)
      setTimeout(() => setAvatar('idle'), Math.max(2500, greeting.length * 70))
    }, 900)
    return () => clearTimeout(t)
  }, [config.name, config.lang])

  const { listening, live, err, start } = useSpeech(handleInput, config.lang)

  useEffect(() => {
    setAvatar(listening ? 'listening' : 'idle')
  }, [listening])

  async function remoteReply(text) {
    if (!config.apiUrl) return null
    try {
      const res = await fetch(config.apiUrl + '/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, name: config.name, lang: config.lang })
      })
      if (!res.ok) return null
      const data = await res.json()
      return data.reply || null
    } catch {
      return null
    }
  }

  function say(text) {
    setTimeout(() => {
      setMessages((m) => [...m, { role: 'orion', text }])
      setAvatar('speaking')
      speak(text, config.lang).catch(() => {
        if (notify) notify('Awaaz nahi aa rahi — Google Text-to-Speech (Play Store se) install/update karo.')
      })
      setTimeout(() => setAvatar('idle'), Math.max(2000, text.length * 70))
    }, 300)
  }

  function handleInput(raw) {
    if (!raw || !raw.trim()) return
    const text = raw.trim()
    setMessages((m) => [...m, { role: 'user', text }])
    const now = new Date()
    const local = respond(text, { name: config.name, now })
    handleAction(local.action)
    rememberUser(text)
    groqReply({ apiKey: config.groqKey, model: config.groqModel })
      .then((reply) => {
        if (reply) {
          rememberOrion(reply)
          say(reply)
        } else {
          say(local.reply)
        }
      })
      .catch(() => say(local.reply))
  }

  function sendTyped() {
    if (!typed.trim()) return
    handleInput(typed)
    setTyped('')
  }

  async function handleAction(action) {
    if (!action) return
    if (action.type === 'alarm') {
      onAlarm(action)
      return
    }
    if (action.type === 'memory') {
      onMemory(action.text)
      return
    }
    if (action.type === 'call') {
      const ok = await doCall(action.number)
      if (!ok) say('Call nahi ho paya — Settings mein "Calls" allow karo.')
      return
    }
    if (action.type === 'sms') {
      const ok = await doSms(action.number, action.text)
      if (!ok) say('SMS nahi bhej saka — Settings mein "SMS" allow karo.')
      return
    }
    if (action.type === 'open') {
      const r = await openPackage(action.pkg)
      if (r === 'not_connected') say('Pehle Accessibility ON karo — Settings > Pura Mobile Access > Accessibility.')
      if (r === 'not_found') say('Ye app is phone par nahi mila.')
      return
    }
    if (action.type === 'screen') {
      const txt = await readScreen()
      if (txt === null) {
        say('Screen nahi parh saka — Accessibility ON nahi hai (Settings > Pura Mobile Access).')
      } else {
        const short = txt.split('\n').filter(Boolean).slice(0, 6).join(' | ') || 'Screen par koi text nahi mila.'
        say('Screen par likha hai: ' + short)
      }
      return
    }
    if (action.type === 'notifs') {
      const n = await getNotifications()
      if (!n) {
        say('Notifications nahi mili — Notification access Settings mein ON karo.')
      } else {
        const short = n.split('\n').slice(0, 5).join(' | ')
        say('Notifications: ' + short)
      }
      return
    }
    if (action.type === 'type') {
      const ok = await typeText(action.text)
      if (!ok) say('Type nahi hua — pehle us field par tap karo jahan likhna hai.')
      return
    }
    if (action.type === 'contacts') {
      const cs = await getContacts()
      if (!cs.length) {
        say('Contacts nahi mili — Settings mein "Contacts" allow karo.')
      } else {
        say('Contacts mili: ' + cs.length + '. Bolo: "call 0300..." kisi ko.')
      }
    }
  }

  return (
    <div className="screen">
      <div className="chat-head">
        <OrionAvatar state={avatar} size="sm" />
        <div className="chat-head-txt">
          <strong>Orion — bhai</strong>
          <span className="chat-head-sub">{listening ? 'Sun raha hun...' : 'Orion Brain ON'}</span>
        </div>
      </div>
      <div className="chat-body">
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <span className="bubble">{m.text}</span>
            <span className="time">{timeToHuman(new Date())}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="micbar">
        <LiveLine listening={listening} live={live} err={err} />
        <div className="type-row">
          <input
            className="field type-input"
            placeholder="Type karo... ya mic dabao"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') sendTyped()
            }}
          />
          <button className="send-btn" onClick={sendTyped}>➤</button>
        </div>
        <button className={`mic ${listening ? 'live' : ''}`} onClick={start}>
          {listening ? 'Sun raha hun...' : 'Mic dabao aur bolo'}
        </button>
        <p className="mic-hint">Bolo ya likho: "12 baje utha dena" • "WhatsApp kholo" • "call 03001234567"</p>
      </div>
    </div>
  )
}

function AlarmScreen({ notify }) {
  const [alarms, setAlarms] = useState([])
  const [time, setTime] = useState('07:00')
  const [msg, setMsg] = useState('')
  const [repeat, setRepeat] = useState(true)

  useEffect(() => {
    ;(async () => {
      const saved = (await getJSON('alarms', [])) || []
      let synced = saved
      if (Capacitor.isNativePlatform()) {
        try {
          const listed = await OrionAlarm.list()
          synced = saved.filter((a) => listed[String(a.id)] !== undefined)
        } catch {}
      }
      setAlarms(synced)
    })()
  }, [])

  function saveAlarms(list) {
    setAlarms(list)
    setJSON('alarms', list)
  }

  async function add() {
    const [h, m] = time.split(':').map(Number)
    const entry = { id: Date.now(), hour: h, minute: m, message: msg || defaultWakeMessage, repeatDaily: repeat }
    saveAlarms([...alarms, entry])
    try {
      await scheduleAlarm(entry)
      notify('Alarm set ho gaya bhai!')
    } catch (e) {
      notify('Alarm fail: ' + (e.message || 'unknown'))
    }
  }

  async function remove(id) {
    saveAlarms(alarms.filter((a) => a.id !== id))
    try {
      await cancelAlarm(id)
    } catch {}
    notify('Alarm band kar diya.')
  }

  return (
    <div className="screen">
      <div className="panel">
        <h2>Naya alarm</h2>
        <input type="time" value={time} className="field time-field" onChange={(e) => setTime(e.target.value)} />
        <textarea
          className="field"
          placeholder={'Message... default: "' + defaultWakeMessage + '"'}
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
        />
        <label className="row">
          <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
          <span>Roz dohrao (daily repeat)</span>
        </label>
        <button className="primary" onClick={add}>Alarm set karo</button>
      </div>
      <h2 className="sec-title">Alarms ({alarms.length})</h2>
      {alarms.length === 0 && <EmptyState title="Koi alarm nahi" sub='"Ros 12 baje utha dena" bolo — ya upar time set karo.' />}
      <div className="list">
        {alarms.map((a) => (
          <div key={a.id} className="card">
            <div className="card-head">
              <strong className="card-time">{String(a.hour).padStart(2, '0')}:{String(a.minute).padStart(2, '0')}</strong>
              {a.repeatDaily && <span className="tag">Roz</span>}
            </div>
            <p className="card-sub">{a.message}</p>
            <button className="danger" onClick={() => remove(a.id)}>Band karo</button>
          </div>
        ))}
      </div>
    </div>
  )
}

function MemoryScreen({ notify }) {
  const [memos, setMemos] = useState([])
  const [text, setText] = useState('')

  useEffect(() => {
    ;(async () => {
      setMemos((await getJSON('memories', [])) || [])
    })()
  }, [])

  function saveAll(list) {
    setMemos(list)
    setJSON('memories', list)
  }

  function add() {
    if (!text.trim()) return
    saveAll([...memos, { id: Date.now(), text: text.trim(), at: new Date().toISOString() }])
    setText('')
    notify('Yaad rakh liya bhai.')
  }

  function del(id) {
    saveAll(memos.filter((m) => m.id !== id))
  }

  return (
    <div className="screen">
      <div className="panel">
        <h2>Yaad-dasht</h2>
        <input className="field" placeholder='"Dawai 2 baje"' value={text} onChange={(e) => setText(e.target.value)} />
        <button className="primary" onClick={add}>Yaad rakhna</button>
      </div>
      <h2 className="sec-title">Yaad rakha hai ({memos.length})</h2>
      {memos.length === 0 && <EmptyState title="Abhi kuch nahi" sub="Yaad-dasht mein sab kuch aa jata hai. Chat mein bolo: 'Yaad rakhna...'" />}
      <div className="list">
        {memos.map((m) => (
          <div key={m.id} className="card">
            <p>{m.text}</p>
            <div className="card-head">
              <span className="time">{timeToHuman(new Date(m.at))}</span>
              <button className="danger" onClick={() => del(m.id)}>Hatao</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AccessPanel({ notify }) {
  const [status, setStatus] = useState(null)

  async function refresh() {
    setStatus(await getAccessStatus())
  }

  useEffect(() => {
    refresh()
  }, [])

  const rows = status
    ? [
        { key: 'mic', label: 'Microphone', on: status.mic },
        { key: 'notifications', label: 'Notifications', on: status.notifications },
        { key: 'call', label: 'Calls', on: status.call },
        { key: 'sms', label: 'SMS', on: status.sms },
        { key: 'contacts', label: 'Contacts', on: status.contacts },
        { key: 'location', label: 'Location', on: status.location },
        { key: 'storage', label: 'Files / Photos', on: status.storage }
      ]
    : []

  return (
    <div className="panel">
      <h2>Pura Mobile Access</h2>
      {rows.map((r) => (
        <div key={r.key} className="perm-row">
          <span className={`perm-dot ${r.on ? 'on' : ''}`} />
          <span className="perm-label">{r.label}</span>
          {r.on ? (
            <span className="tag">ON</span>
          ) : (
            <button
              className="perm-btn"
              onClick={async () => {
                await requestPerm(r.key)
                notify('Popup par Allow dabao.')
                setTimeout(refresh, 1500)
              }}
            >
              Allow
            </button>
          )}
        </div>
      ))}
      <div className="perm-row">
        <span className={`perm-dot ${status && status.accessibility ? 'on' : ''}`} />
        <span className="perm-label">Accessibility — screen parhna, type, apps kholna</span>
        {status && status.accessibility ? (
          <span className="tag">ON</span>
        ) : (
          <button
            className="perm-btn"
            onClick={async () => {
              await openAccessibilitySettings()
              notify('Orion ko list mein ON karo.')
              setTimeout(refresh, 2500)
            }}
          >
            Enable
          </button>
        )}
      </div>
      <div className="perm-row">
        <span className={`perm-dot ${status && status.notifListener ? 'on' : ''}`} />
        <span className="perm-label">Notification access</span>
        {status && status.notifListener ? (
          <span className="tag">ON</span>
        ) : (
          <button
            className="perm-btn"
            onClick={async () => {
              await openNotificationListenerSettings()
              notify('Orion allow karo.')
              setTimeout(refresh, 2500)
            }}
          >
            Enable
          </button>
        )}
      </div>
      <button className="ghost" onClick={refresh}>Status refresh</button>
      <p className="about">Sab ON karne ke baad bolo: "WhatsApp kholo" • "screen parho" • "call 0300..." • "sms 0300... lunch aa gaya" • "type kya haal hai"</p>
    </div>
  )
}

function SettingsScreen({ config, setConfig, notify }) {
  const [name, setName] = useState(config.name)
  const [lock, setLock] = useState(config.voiceLock)
  const [lang, setLang] = useState(config.lang || 'en-US')
  const [server, setServer] = useState(config.apiUrl || '')
  const [groqKey, setGroqKey] = useState(config.groqKey || '')
  const [groqModel, setGroqModel] = useState(config.groqModel || 'llama-3.3-70b-versatile')
  const [testing, setTesting] = useState(false)
  const [testMsg, setTestMsg] = useState('')
  const [ownerOn, setOwnerOn] = useState(!!config.owner)
  const [ownerUser, setOwnerUser] = useState((config.owner && config.owner.user) || '')
  const [ownerPass, setOwnerPass] = useState('')
  const [vh, setVh] = useState('')
  const [pro, setPro] = useState(config.proactive !== false)

  async function saveName() {
    const nm = name.trim() || 'Hannan'
    setConfig((c) => ({ ...c, name: nm }))
    setJSON('config', { ...config, name: nm })
    notify('Naam save ho gaya bhai.')
  }

  function saveServer() {
    const url = server.trim().replace(/\/+$/, '')
    setConfig((c) => ({ ...c, apiUrl: url }))
    setJSON('config', { ...config, apiUrl: url })
    notify(url ? 'Orion server set: ' + url : 'Local brain chalta rahega.')
  }

  function saveGroq() {
    const key = groqKey.trim()
    setConfig((c) => ({ ...c, groqKey: key, groqModel }))
    setJSON('config', { ...config, groqKey: key, groqModel })
    notify(key ? 'Orion Brain updated — ab aur bhi acha samjhega!' : 'Orion Brain built-in mode par hai.')
  }

  function saveLang() {
    setConfig((c) => ({ ...c, lang }))
    setJSON('config', { ...config, lang })
    notify('Language set: ' + lang)
  }

  function toggleLock() {
    const v = !lock
    setLock(v)
    setConfig((c) => ({ ...c, voiceLock: v }))
    setJSON('config', { ...config, voiceLock: v })
    notify(v ? 'Voice lock ON — sirf aapki awaaz kaam karegi.' : 'Voice lock OFF.')
  }

  async function saveOwner() {
    const nm = ownerUser.trim()
    if (ownerOn && (!nm || ownerPass.length < 4)) {
      notify('Username aur password (4+ characters) do.')
      return
    }
    const next = ownerOn ? { user: nm, pass: await hash256(ownerPass || 'nopass') } : null
    setConfig((c) => ({ ...c, owner: next }))
    setJSON('config', { ...config, owner: next })
    setOwnerPass('')
    notify(next ? 'App lock ON — sirf ' + nm + ' login kar sakta hai.' : 'App lock OFF.')
  }

  async function testVoice() {
    setTesting(true)
    try {
      await speak('Haan bhai! Main Orion hun, tumhara bhai. Ye meri awaaz hai.', config.lang)
      notify('Awaaz test: chal rahi hai! Agar kuch nahi suna to Google Text-to-Speech update karo.')
    } catch (e) {
      notify('TTS fail: ' + (e.message || 'unknown') + ' — Google Text-to-Speech install karo.')
    }
    setTimeout(() => setTesting(false), 6000)
  }

  async function testBrain() {
    setTestMsg('Soch raha hun...')
    try {
      const r = await groqPing({ apiKey: groqKey.trim(), model: groqModel })
      setTestMsg('Orion jawab: ' + r)
      await speak(r, config.lang)
    } catch (e) {
      setTestMsg('Brain fail: ' + (e.message || 'unknown'))
    }
  }

  function togglePro() {
    const v = !pro
    setPro(v)
    setConfig((c) => ({ ...c, proactive: v }))
    setJSON('config', { ...config, proactive: v })
    notify(v ? 'Orion khud bolega — har 3 min mein kuch na kuch.' : 'Proactive bolna band.')
  }

  async function voiceHealth() {
    setVh('Check ho raha hai...')
    const avail = await speechAvailable()
    const perm = await speechPermissionState()
    setVh('Speech engine: ' + (avail ? 'OK — aawaaz sun sakta hun' : 'NAHI mila — Google app / Google Speech Service phone par install karo') + ' | Mic permission: ' + perm)
  }

  return (
    <div className="screen">
      <div className="panel">
        <h2>Settings</h2>
        <label className="lbl">Tumhara naam</label>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="primary" onClick={saveName}>Naam save karo</button>

        <label className="lbl">Orion Brain key (optional) — built-in brain pehle se ON hai</label>
        <input
          className="field"
          type="password"
          value={groqKey}
          onChange={(e) => setGroqKey(e.target.value)}
          placeholder="Koi key dalni ho to... (optional)"
        />
        <select className="field" value={groqModel} onChange={(e) => setGroqModel(e.target.value)}>
          <option value="llama-3.3-70b-versatile">Orion Brain Pro — smartest</option>
          <option value="llama-3.1-8b-instant">Orion Brain Fast</option>
          <option value="gemma2-9b-it">Orion Brain Lite</option>
          <option value="mixtral-8x7b-32768">Orion Brain Long Memory</option>
        </select>
        <button className="ghost" onClick={saveGroq}>Brain save karo</button>
        <button className="ghost" onClick={testBrain} disabled={testing}>Test: Orion se kaho kuch</button>
        {testMsg && <p className="about">{testMsg}</p>}

        <label className="lbl">Orion server (optional) — Python backend ka URL</label>
        <input
          className="field"
          value={server}
          onChange={(e) => setServer(e.target.value)}
          placeholder="https://orion-api.up.railway.app"
        />
        <button className="ghost" onClick={saveServer}>Server save karo</button>

        <label className="lbl">Awaaz ki language (voice recognition)</label>
        <select className="field" value={lang} onChange={(e) => setLang(e.target.value)}>
          <option value="en-US">English (US) — recommended</option>
          <option value="ur-PK">Urdu (Pakistan)</option>
          <option value="hi-IN">Hindi</option>
        </select>
        <button className="ghost" onClick={saveLang}>Language save karo</button>

        <label className="row spacer">
          <input type="checkbox" checked={lock} onChange={toggleLock} />
          <span>Voice lock — sirf aapki awaaz ("hey Orion")</span>
        </label>

        <label className="row">
          <input type="checkbox" checked={pro} onChange={togglePro} />
          <span>Orion khud bole — har 3 min mein check-in</span>
        </label>

        <button className="ghost" onClick={testVoice}>{testing ? 'Bol raha hun...' : 'Awaaz test karo'}</button>
        <button className="ghost" onClick={() => stopSpeaking()}>Bolna band karo</button>
        <button className="ghost" onClick={voiceHealth}>Voice check karo (diagnostic)</button>
        {vh && <p className="about">{vh}</p>}

        <p className="about">Orion v1.4 — body, login, AI brain. Aapka bhai.</p>
      </div>

      <div className="panel">
        <h2>App lock (login)</h2>
        <label className="row">
          <input type="checkbox" checked={ownerOn} onChange={(e) => setOwnerOn(e.target.checked)} />
          <span>App lock ON — sirf ID/pass wala login kar sakta hai</span>
        </label>
        {ownerOn && (
          <div className="login-box">
            <input className="field" placeholder="Username / ID" value={ownerUser} onChange={(e) => setOwnerUser(e.target.value)} />
            <input className="field" type="password" placeholder="Password (4+)" value={ownerPass} onChange={(e) => setOwnerPass(e.target.value)} />
          </div>
        )}
        <button className="ghost" onClick={saveOwner}>Login settings save karo</button>
      </div>

      <PermissionsBox notify={notify} />
      <AccessPanel notify={notify} />
    </div>
  )
}

function VoiceGate({ onUnlocked, notify, lang }) {
  const [tries, setTries] = useState(0)
  const [typed, setTyped] = useState('')
  const [avatar, setAvatar] = useState('idle')
  const { listening, live, err, start } = useSpeech((t) => {
    if (matchesWake(t)) {
      notify('Mil gaya bhai!')
      onUnlocked()
    } else {
      setTries((s) => s + 1)
    }
  }, lang)

  useEffect(() => {
    setAvatar(listening ? 'listening' : 'idle')
  }, [listening])

  return (
    <div className="gate">
      <OrionAvatar state={avatar} />
      <h1 className="gate-logo">ORION</h1>
      <p className="gate-sub">Voice lock ON hai. Bolo: "hey Orion" — ya "Orion suno", "orion wake up"</p>
      <button className={`mic big ${listening ? 'live' : ''}`} onClick={start}>
        {listening ? 'Sun raha hun...' : 'Mic dabao aur bolo'}
      </button>
      <LiveLine listening={listening} live={live} err={err} />
      {tries > 0 && <p className="gate-hint">Nahi samjha — phir se bolo, ya neeche type karo.</p>}
      {tries >= 1 && (
        <div className="gate-typed">
          <input
            className="field center"
            placeholder='Type karo: "orion"'
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
          <button
            className="ghost"
            onClick={() => {
              if (typed.trim()) {
                notify('Mil gaya bhai!')
                onUnlocked()
              }
            }}
          >
            Unlock karo
          </button>
        </div>
      )}
      <p className="gate-hint">Awaaz pakad nahi rahi? Mic permission + Google app check karo, ya Settings mein "Voice lock" OFF kar do.</p>
    </div>
  )
}

function LoginScreen({ owner, onUnlocked, notify }) {
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [shake, setShake] = useState(0)
  const [busy, setBusy] = useState(false)

  async function tryLogin() {
    if (!user.trim() || !pass) {
      notify('Username aur password likho.')
      return
    }
    setBusy(true)
    const h = await hash256(pass)
    await new Promise((r) => setTimeout(r, 600))
    setBusy(false)
    if (user.trim().toLowerCase() === (owner.user || '').toLowerCase() && h === owner.pass) {
      notify('Welcome back bhai!')
      onUnlocked()
    } else {
      setShake((s) => s + 1)
      setPass('')
      notify('Galat ID ya pass — phir try karo.')
    }
  }

  return (
    <div className="gate login-gate">
      <OrionAvatar state="idle" />
      <h1 className="gate-logo">ORION</h1>
      <p className="gate-sub">Private app — sirf owner ka ID/pass. Woh hi hai jo kahe: "main owner hoon".</p>
      <div key={shake} className={shake ? 'login-box shake' : 'login-box'}>
        <input className="field center" placeholder="Username / ID" value={user} onChange={(e) => setUser(e.target.value)} autoCapitalize="none" />
        <input
          className="field center"
          type="password"
          placeholder="Password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && tryLogin()}
        />
      </div>
      <button className="primary big-btn" onClick={tryLogin} disabled={busy}>
        {busy ? 'Check ho raha hai...' : 'Unlock karo'}
      </button>
    </div>
  )
}

function SetupScreen({ onDone, notify }) {
  const [name, setName] = useState('Hannan')
  const [sample, setSample] = useState(0)
  const [lock, setLock] = useState(true)
  const [loginOn, setLoginOn] = useState(true)
  const [loginUser, setLoginUser] = useState('owner')
  const [loginPass, setLoginPass] = useState('')
  const { listening, live, err, start } = useSpeech((t) => {
    if (sample >= 3) return
    if (matchesWake(t)) {
      setSample((s) => s + 1)
    } else {
      notify('Nahi samjha — "hey Orion" ya "orion wake up" bolo.')
    }
  })

  async function finish() {
    const nm = name.trim() || 'Hannan'
    if (loginOn && loginPass.length < 4) {
      notify('Password kam hai — 4 characters ya zyada do.')
      return
    }
    const owner = loginOn && loginUser.trim() ? { user: loginUser.trim(), pass: await hash256(loginPass) } : null
    setJSON('config', { name: nm, voiceLock: lock, setupDone: true, samples: sample, lang: 'en-US', owner })
    onDone(owner)
  }

  return (
    <div className="gate setup">
      <OrionAvatar state={listening ? 'listening' : 'idle'} />
      <h1 className="gate-logo">ORION</h1>
      <p className="gate-sub">Chalo pehle milte hain. Aapka naam?</p>
      <input className="field center" value={name} onChange={(e) => setName(e.target.value)} placeholder="Hannan" />

      <p className="gate-group">Ab awaaz match karein — "hey Orion" boliye, 3 baar:</p>
      <button className={`mic big ${listening ? 'live' : ''}`} onClick={start} disabled={sample >= 3}>
        {listening ? 'Record ho raha hai...' : sample >= 3 ? 'Ho gaya!' : `Boliye: "hey Orion" — (${sample}/3)`}
      </button>
      <LiveLine listening={listening} live={live} err={err} />
      {sample < 3 && <p className="gate-hint">Mic dabayen, phir bolo: hey Orion, ya Orion wake up, ya Orion suno</p>}
      {sample < 3 && (
        <button className="ghost skip-btn" onClick={() => setSample(3)}>
          Awaaz nahi sun raha? Skip karo — type se bhi chale ga
        </button>
      )}

      {sample >= 3 && (
        <div className="setup-final">
          <label className="row">
            <input type="checkbox" checked={lock} onChange={(e) => setLock(e.target.checked)} />
            <span>Voice lock ON — sirf meri awaaz</span>
          </label>
          <label className="row">
            <input type="checkbox" checked={loginOn} onChange={(e) => setLoginOn(e.target.checked)} />
            <span>App lock — ID/pass login (sirf aap kholein)</span>
          </label>
          {loginOn && (
            <div className="login-box">
              <input className="field" placeholder="Username / ID (kya hoga?)" value={loginUser} onChange={(e) => setLoginUser(e.target.value)} />
              <input className="field" type="password" placeholder="Password (4+ characters)" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} />
            </div>
          )}
          <PermissionsBox notify={notify} />
          <button className="primary" onClick={finish}>Orion shuru karo</button>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [config, setConfig] = useState({ name: 'Hannan', voiceLock: true, setupDone: false, lang: 'en-US', proactive: true })
  const [tab, setTab] = useState('chat')
  const [unlocked, setUnlocked] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    ;(async () => {
      const c = await getJSON('config', null)
      if (c) setConfig((prev) => ({ ...prev, ...c }))
    })()
  }, [])

  function notify(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  function handleAlarm(a) {
    setJSON('alarms', [a])
    scheduleAlarm(a).catch((e) => notify('Alarm fail: ' + (e.message || '')))
  }

  function handleMemory(t) {
    getJSON('memories', []).then((list) => setJSON('memories', [...(list || []), { id: Date.now(), text: t, at: new Date().toISOString() }]))
  }

  if (!config.setupDone) {
    return <SetupScreen onDone={(owner) => { setConfig((c) => ({ ...c, setupDone: true, owner })); setUnlocked(!owner) }} notify={notify} />
  }

  if (config.owner && !unlocked) {
    return <LoginScreen owner={config.owner} onUnlocked={() => setUnlocked(true)} notify={notify} />
  }

  if (config.voiceLock && !unlocked) {
    return <VoiceGate onUnlocked={() => setUnlocked(true)} notify={notify} lang={config.lang} />
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <OrionAvatar state={tab === 'chat' ? 'idle' : 'idle'} size="sm" />
          <div>
            <h1 className="logo">ORION</h1>
            <p className="logo-sub">aapka AI bhai — {config.name}</p>
          </div>
        </div>
        <div className="header-right">
          <span className="brain-tag">BRAIN</span>
          <span className={`dot ${config.voiceLock && unlocked ? 'on' : ''}`} />
        </div>
      </header>

      <main className="main">
        {tab === 'chat' && <ChatScreen config={config} onAlarm={handleAlarm} onMemory={handleMemory} notify={notify} />}
        {tab === 'alarm' && <AlarmScreen notify={notify} />}
        {tab === 'memory' && <MemoryScreen notify={notify} />}
        {tab === 'settings' && <SettingsScreen config={config} setConfig={setConfig} notify={notify} />}
      </main>

      {toast && <div className="toast">{toast}</div>}
      <TabBar tab={tab} setTab={setTab} />
    </div>
  )
}