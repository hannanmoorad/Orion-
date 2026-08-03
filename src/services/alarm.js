import { Capacitor } from '@capacitor/core'

const OrionAlarm = Capacitor.registerPlugin('OrionAlarm')

export async function scheduleAlarm({ id, hour, minute, message, repeatDaily = false }) {
  if (!Capacitor.isNativePlatform()) return
  await OrionAlarm.schedule({ id, hour, minute, message, repeatDaily })
  const warningMinute = minute - 10
  if (warningMinute >= 0) {
    await OrionAlarm.schedule({
      id: id + 100000,
      hour,
      minute: warningMinute,
      message: `${message} Abhi 10 minute hain.`,
      repeatDaily
    })
  } else {
    await OrionAlarm.schedule({
      id: id + 100000,
      hour: hour === 0 ? 23 : hour - 1,
      minute: warningMinute + 60,
      message: `${message} Abhi 10 minute hain.`,
      repeatDaily
    })
  }
}

export async function cancelAlarm(id) {
  if (!Capacitor.isNativePlatform()) return
  try {
    await OrionAlarm.cancel({ id })
  } catch {}
  try {
    await OrionAlarm.cancel({ id: id + 100000 })
  } catch {}
}

export { OrionAlarm }

export async function requestNotificationPermission() {
  if (!Capacitor.isNativePlatform()) return true
  try {
    await OrionAlarm.requestNotificationPermission()
    return true
  } catch {
    return false
  }
}

export async function hasNotificationPermission() {
  if (!Capacitor.isNativePlatform()) return true
  try {
    const r = await OrionAlarm.checkNotificationPermission()
    return !!r.granted
  } catch {
    return false
  }
}