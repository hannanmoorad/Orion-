from datetime import datetime
import os
import random
import re

FALLBACKS = [
    "Haan bhai, sun raha hun!",
    "Bolo bhai, kya kaam hai?",
    "Main yahan hoon. Kya chahiye?",
    "Hmm, batao — alarm, yaad-dasht, call, ya bas gupshup?",
    "Samajh gaya bhai. Phir zara slow bolo to?",
    "Main tumhara Orion hun — bolte jao, main sab sambhal leta hun.",
    "Nice, bhai! Aise hi bolo.",
    "Hmm... maza toh aa raha hai. Aur bolo.",
]

DEFAULT_WAKE = "Hannan, uth ja bhai! Office jana hai."

SYSTEM_PROMPT = (
    "Tum ORION ho — Hannan ka personal AI bhai. Iron Man ka JARVIS nahi, "
    "ek apna bhai jo har waqt uske saath hai. Kaam sirf commands chalana nahi — "
    "saath dena, khayal rakhna, zindagi aasan banana. "
    "Style: Roman Urdu + thodi English mix. Tone: warm, playful, bhai jaisa. "
    'Kabhi robot/formal nahi. "Sir" nahi — "bhai" bolna. Replies short: 1-2 lines.'
)

APP_MAP = {
    "instagram": "com.instagram.android",
    "insta": "com.instagram.android",
    "whatsapp": "com.whatsapp",
    "youtube": "com.google.android.youtube",
    "chrome": "com.android.chrome",
    "browser": "com.android.chrome",
    "maps": "com.google.android.apps.maps",
    "play store": "com.android.vending",
    "settings": "com.android.settings",
    "camera": "com.android.camera",
    "photos": "com.google.android.apps.photos",
    "gallery": "com.google.android.apps.photos",
    "gmail": "com.google.android.gm",
    "facebook": "com.facebook.katana",
    "tiktok": "com.zhiliaoapp.musically",
    "snapchat": "com.snapchat.android",
    "phone": "com.google.android.dialer",
    "spotify": "com.spotify.music",
    "netflix": "com.netflix.mediaclient",
    "telegram": "org.telegram.messenger",
}


def find_app(raw):
    q = (raw or "").lower()
    best = None
    for name, pkg in APP_MAP.items():
        if name in q and (best is None or len(name) > best[1]):
            best = (pkg, len(name))
    return best[0] if best else None


def time_human(dt=None):
    dt = dt or datetime.now()
    h = dt.hour % 12 or 12
    period = "PM" if dt.hour >= 12 else "AM"
    return f"{h}:{dt.minute:02d} {period}"


def llm_reply(text, name):
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key:
        return None
    try:
        from openai import OpenAI

        client = OpenAI(api_key=key)
        r = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": text},
            ],
            max_tokens=120,
            temperature=0.9,
        )
        reply = r.choices[0].message.content.strip()
        return reply or None
    except Exception:
        return None


def run(text, name="Hannan"):
    t = (text or "").lower()
    result = None

    alarm_m = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)?", t)
    if alarm_m and re.search(r"alarm|utha|uthao|jaga|wake", t):
        hour = int(alarm_m.group(1))
        minute = int(alarm_m.group(2) or 0)
        period = (alarm_m.group(3) or "").lower()
        if period == "pm" and hour < 12:
            hour += 12
        if period == "am" and hour == 12:
            hour = 0
        when = datetime.now().replace(hour=hour, minute=minute, second=0, microsecond=0)
        result = f'Done bhai! {time_human(when)} par utha dunga. "{DEFAULT_WAKE}"'

    elif re.search(r"yaad rakh|yaad rakho|remember", t):
        memo = re.sub(r"^(ivan|orion)[,\s]*", "", text, flags=re.I)
        memo = re.sub(r"^(yaad rakhna|yaad rakh|yaad rakho|remember)[,\s]*", "", memo, flags=re.I).strip()
        result = f'Yaad rakh liya bhai: "{memo}". Jab zaroorat padegi, main bata dunga.'

    elif re.search(r"call|ko call|phone|bulao|bula", t):
        m = re.search(r"([+\d][\d\s]{6,})", t)
        if m:
            number = re.sub(r"\s+", "", m.group(1))
            result = f"Call karta hun: {number}"
        else:
            result = "Kaunsa number? Bolo: call 0300..."

    elif re.search(r"sms|message|msg|text", t):
        m = re.search(r"([+\d][\d\s]{6,})\s+(.+)", t)
        if m:
            result = f'SMS ja raha hai: "{m.group(2).strip()}" ko {re.sub(chr(32), "", m.group(1))}'
        else:
            result = "SMS ke liye bolo: sms 0300... message"

    elif re.search(r"kholo|open|launch|chalao", t):
        pkg = find_app(text)
        if pkg:
            result = "Khol raha hun bhai!"
        else:
            result = 'Kaunsa app? Bolo: "Instagram kholo", "WhatsApp kholo"...'

    elif re.search(r"kya (time|wakt)|kitne baje|time bata", t):
        result = f"Abhi {time_human()} hain bhai."

    elif re.search(r"kaun (hai|ho)|who are you|tum kaun", t):
        result = (
            f"Main Orion hun — {name} ka AI bhai. Alarm, yaad-dasht, calls, apps — "
            "sab yahan. Tum bolo, main chalata hun."
        )

    elif re.search(r"salam|salaam|hello|hey|assalam", t):
        h = datetime.now().hour
        greeting = "Subah bakhair" if h < 12 else ("Dopahar bakhair" if h < 18 else "Sham bakhair")
        result = f"{greeting} bhai! {name}, kya haal? Batao kya karna hai."

    if result is None:
        result = llm_reply(text, name) or random.choice(FALLBACKS)
    return result
