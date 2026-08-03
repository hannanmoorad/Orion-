import { Capacitor } from '@capacitor/core'

const OrionAccess = Capacitor.registerPlugin('OrionAccess')

export async function getAccessStatus() {
  if (!Capacitor.isNativePlatform()) return null
  try {
    return await OrionAccess.status()
  } catch {
    return null
  }
}

export async function requestPerm(kind) {
  if (!Capacitor.isNativePlatform()) return
  try {
    await OrionAccess.request({ kind })
  } catch {}
}

export async function openAccessibilitySettings() {
  if (!Capacitor.isNativePlatform()) return
  try {
    await OrionAccess.openAccessibilitySettings()
  } catch {}
}

export async function openNotificationListenerSettings() {
  if (!Capacitor.isNativePlatform()) return
  try {
    await OrionAccess.openNotificationSettings()
  } catch {}
}

export async function openAppSettings() {
  if (!Capacitor.isNativePlatform()) return
  try {
    await OrionAccess.openAppSettings()
  } catch {}
}

export async function readScreen() {
  if (!Capacitor.isNativePlatform()) return null
  try {
    const r = await OrionAccess.readScreen()
    return r.text
  } catch {
    return null
  }
}

export async function typeText(text) {
  if (!Capacitor.isNativePlatform()) return false
  try {
    const r = await OrionAccess.typeText({ text })
    return !!r.ok
  } catch {
    return false
  }
}

export async function tap(x, y) {
  if (!Capacitor.isNativePlatform()) return false
  try {
    const r = await OrionAccess.tap({ x, y })
    return !!r.ok
  } catch {
    return false
  }
}

export async function openPackage(pkg) {
  if (!Capacitor.isNativePlatform()) return 'no_app'
  try {
    const r = await OrionAccess.openPackage({ pkg })
    return r.result
  } catch {
    return 'not_connected'
  }
}

export async function listPackages() {
  if (!Capacitor.isNativePlatform()) return []
  try {
    const r = await OrionAccess.listPackages()
    return r.apps || []
  } catch {
    return []
  }
}

export async function doCall(number) {
  if (!Capacitor.isNativePlatform()) return false
  try {
    await OrionAccess.call({ number })
    return true
  } catch {
    return false
  }
}

export async function doSms(number, text) {
  if (!Capacitor.isNativePlatform()) return false
  try {
    await OrionAccess.sms({ number, text })
    return true
  } catch {
    return false
  }
}

export async function getContacts() {
  if (!Capacitor.isNativePlatform()) return []
  try {
    const r = await OrionAccess.contacts()
    return r.contacts || []
  } catch {
    return []
  }
}

export async function getNotifications() {
  if (!Capacitor.isNativePlatform()) return ''
  try {
    const r = await OrionAccess.notifications()
    return r.text || ''
  } catch {
    return ''
  }
}