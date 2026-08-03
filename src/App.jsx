import React, { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { SpeechRecognition } from '@capacitor-community/speech-recognition'
import { getJSON, setJSON } from './services/storage'
import { speak, stopSpeaking } from './services/voice'
import { scheduleAlarm, cancelAlarm, OrionAlarm, requestNotificationPermission } from './services/alarm'
import { respond, timeToHuman, defaultWakeMessage } from './brain/OrionBrain'

const PHRASE = 'orion wake up'

function normalize(s) {
  return (s || '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()
}

function matchesPhrase(s) {
  const n = normalize(s)
  return /orion/.test(n) && /(wake|suno|uth|listen)/i.test(s)
}

function useSpeech(onFinal, lang = 'en-US') {
  const [listening, setListening] = useState(false)
  const [live, setLive] = useState('')
  const listeningRef = useRef(false)
  const liveRef = useRef('')
  const gotFinalRef = useRef(false)
  const langRef = useRef(lang)
  langRef.current = lang
  const finalRef = useRef(onFinal)
  finalRef.current = onFinal

  function setLiveText(t) {
    liveRef.current = t
    setLive(t)
  }

  useEffect(() => {
    const listeners = []
    ;(async () => {
      try {
        await SpeechRecognition.requestPermissions()
      } catch {}
      if (!Capacitor.isNativePlatform()) return
      listeners.push(await SpeechRecognition.addListener('onResult', (data) => {
        gotFinalRef.current = true
        setLiveText('')
        if (data.matches && data.matches.length) finalRef.current(data.matches[0])
      }))
      listeners.push(await SpeechRecognition.addListener('partialResults', (data) => {
        if (data.matches && data.matches.length) setLiveText(data.matches[0])
      }))
      listeners.push(await SpeechRecognition.addListener('onError', () => {
        gotFinalRef.current = true
        setLiveText('')
      }))
      listeners.push(await SpeechRecognition.addListener('onEnd', () => {
        if (!gotFinalRef.current && liveRef.current) {
          finalRef.current(liveRef.current)
        }
        gotFinalRef.current = false
        listeningRef.current = false
        setListening(false)
        setLiveText('')
      }))
    })()
    return () => {
      listeners.forEach((l) => l && l.remove())
    }
  }, [])

  async function start() {
    if (listeningRef.current) {
      try {
        await SpeechRecognition.stop()
      } catch {}
      listeningRef.current = false
      setListening(false)
      setLiveText('')
      return
    }
    if (!Capacitor.isNativePlatform()) {
      setListening(true)
      listeningRef.current = true
      setLiveText('')
      setTimeout(() => {
        const t = window.prompt('Dev mode — boliye: Orion wake up')
        listeningRef.current = false
        setListening(false)
        setLiveText('')
        if (t) finalRef.current(t)
      }, 300)
      return
    }
    try {
      await SpeechRecognition.start({ language: langRef.current, maxResults: 3, partialResults: true, popup: false })
      listeningRef.current = true
      setListening(true)
      setLiveText('')
    } catch {
      listeningRef.current = false
      setListening(false)
      setLiveText('')
    }
  }

  return { listening, live, start }
}

function LiveLine({ listening, live }) {
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

function ChatScreen({ config, onAlarm, onMemory }) {
  const [messages, setMessages] = useState([
    { role: 'orion', text: `Haan bhai ${config.name}, main Orion hun. Bolo — "12 baje utha dena", ya "yaad rakhna dinner lana", ya bas gupshup.` }
  ])
  const endRef = useRef(null)

  useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleInput(raw) {
    if (!raw || !raw.trim()) return
    const text = raw.trim()
    setMessages((m) => [...m, { role: 'user', text }])
    const now = new Date()
    const { reply, action } = respond(text, { name: config.name, now })
    setTimeout(() => {
      setMessages((m) => [...m, { role: 'orion', text: reply }])
      speak(reply, config.lang)
    }, 300)
    if (action && action.type === 'alarm') onAlarm(action)
    if (action && action.type === 'memory') onMemory(action.text)
  }

  const { listening, live, start } = useSpeech(handleInput, config.lang)

  return (
    <div className="screen">
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
        <LiveLine listening={listening} live={live} />
        <button className={`mic ${listening ? 'live' : ''}`} onClick={start}>
          {listening ? 'Sun raha hun...' : 'Mic dabao aur bolo'}
        </button>
        <p className="mic-hint">Bolo: "Ros 12 baje utha dena" • "Yaad rakhna dawai 2 baje"</p>
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

function SettingsScreen({ config, setConfig, notify }) {
  const [name, setName] = useState(config.name)
  const [lock, setLock] = useState(config.voiceLock)
  const [lang, setLang] = useState(config.lang || 'en-US')
  const [testing, setTesting] = useState(false)

  async function saveName() {
    const nm = name.trim() || 'Hannan'
    setConfig((c) => ({ ...c, name: nm }))
    setJSON('config', { ...config, name: nm })
    notify('Naam save ho gaya bhai.')
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

  async function testVoice() {
    setTesting(true)
    await speak('Haan bhai! Main Orion hun, tumhara bhai. Ye meri awaaz hai.', config.lang)
    setTimeout(() => setTesting(false), 6000)
  }

  return (
    <div className="screen">
      <div className="panel">
        <h2>Settings</h2>
        <label className="lbl">Tumhara naam</label>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="primary" onClick={saveName}>Naam save karo</button>

        <label className="lbl">Awaaz ki language (voice recognition)</label>
        <select className="field" value={lang} onChange={(e) => setLang(e.target.value)}>
          <option value="en-US">English (US) — recommended</option>
          <option value="ur-PK">Urdu (Pakistan)</option>
          <option value="hi-IN">Hindi</option>
        </select>
        <button className="ghost" onClick={saveLang}>Language save karo</button>

        <label className="row spacer">
          <input type="checkbox" checked={lock} onChange={toggleLock} />
          <span>Voice lock — sirf aapki awaaz ("Orion wake up")</span>
        </label>

        <button className="ghost" onClick={testVoice}>{testing ? 'Bol raha hun...' : 'Awaaz test karo'}</button>
        <button className="ghost" onClick={() => stopSpeaking()}>Bolna band karo</button>

        <p className="about">Orion v1.1 — aapka AI bhai. Alarm, yaad-dasht, awaaz. Kuch bhi bolo.</p>
      </div>
      <PermissionsBox notify={notify} />
    </div>
  )
}

function VoiceGate({ onUnlocked, notify, lang }) {
  const [tries, setTries] = useState(0)
  const { listening, live, start } = useSpeech((t) => {
    if (matchesPhrase(t)) {
      notify('Mil gaya bhai!')
      onUnlocked()
    } else {
      setTries((s) => s + 1)
    }
  }, lang)

  return (
    <div className="gate">
      <h1>ORION</h1>
      <p className="gate-sub">Voice lock ON hai. Boliye: "Orion wake up"</p>
      <button className={`mic big ${listening ? 'live' : ''}`} onClick={start}>
        {listening ? 'Sun raha hun...' : 'Mic dabao aur bolo'}
      </button>
      <LiveLine listening={listening} live={live} />
      {tries > 0 && <p className="gate-hint">Nahi samjha — phir se bolo, sukoon se.</p>}
    </div>
  )
}

function SetupScreen({ onDone, notify }) {
  const [name, setName] = useState('Hannan')
  const [sample, setSample] = useState(0)
  const [lock, setLock] = useState(true)
  const { listening, live, start } = useSpeech((t) => {
    if (sample >= 3) return
    if (matchesPhrase(t)) {
      setSample((s) => s + 1)
    } else {
      notify('Nahi samjha — "Orion wake up" bolo.')
    }
  })

  async function finish() {
    const nm = name.trim() || 'Hannan'
    setJSON('config', { name: nm, voiceLock: lock, setupDone: true, samples: sample, lang: 'en-US' })
    onDone()
  }

  return (
    <div className="gate setup">
      <h1>ORION</h1>
      <p className="gate-sub">Chalo pehle milte hain. Aapka naam?</p>
      <input className="field center" value={name} onChange={(e) => setName(e.target.value)} placeholder="Hannan" />

      <p className="gate-group">Ab awaaz match karein — "Orion wake up" boliye, 3 baar:</p>
      <button className={`mic big ${listening ? 'live' : ''}`} onClick={start} disabled={sample >= 3}>
        {listening ? 'Record ho raha hai...' : sample >= 3 ? 'Ho gaya!' : `Boliye: "${PHRASE}" — (${sample}/3)`}
      </button>
      <LiveLine listening={listening} live={live} />
      {sample < 3 && <p className="gate-hint">Mic dabayen, phir bolo: Orion wake up</p>}

      {sample >= 3 && (
        <div className="setup-final">
          <label className="row">
            <input type="checkbox" checked={lock} onChange={(e) => setLock(e.target.checked)} />
            <span>Voice lock ON — sirf meri awaaz</span>
          </label>
          <PermissionsBox notify={notify} />
          <button className="primary" onClick={finish}>Orion shuru karo</button>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [config, setConfig] = useState({ name: 'Hannan', voiceLock: true, setupDone: false, lang: 'en-US' })
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
    return <SetupScreen onDone={() => { setConfig((c) => ({ ...c, setupDone: true })); setUnlocked(true) }} notify={notify} />
  }

  if (config.voiceLock && !unlocked) {
    return <VoiceGate onUnlocked={() => setUnlocked(true)} notify={notify} lang={config.lang} />
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1 className="logo">ORION</h1>
          <p className="logo-sub">aapka AI bhai — {config.name}</p>
        </div>
        <span className={`dot ${config.voiceLock && unlocked ? 'on' : ''}`} />
      </header>

      <main className="main">
        {tab === 'chat' && <ChatScreen config={config} onAlarm={handleAlarm} onMemory={handleMemory} />}
        {tab === 'alarm' && <AlarmScreen notify={notify} />}
        {tab === 'memory' && <MemoryScreen notify={notify} />}
        {tab === 'settings' && <SettingsScreen config={config} setConfig={setConfig} notify={notify} />}
      </main>

      {toast && <div className="toast">{toast}</div>}
      <TabBar tab={tab} setTab={setTab} />
    </div>
  )
}