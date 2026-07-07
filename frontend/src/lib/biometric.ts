import { BiometricAuth } from '@aparajita/capacitor-biometric-auth'

function getDeviceId(): string {
  let deviceId = localStorage.getItem('britledger_device_id')
  if (!deviceId) {
    deviceId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36)
    localStorage.setItem('britledger_device_id', deviceId)
  }
  return deviceId
}

async function tryNativeBiometric(): Promise<string | null> {
  try {
    const result = await BiometricAuth.checkBiometry()
    if (!result.isAvailable) {
      console.log('Native biometric not available:', result.reason)
      return null
    }
    await BiometricAuth.authenticate({ reason: 'Authenticate to access BritLedger', allowDeviceCredential: true })
    const deviceId = getDeviceId()
    return `bio:${deviceId}`
  } catch (err: any) {
    console.log('Native biometric failed:', err.code || err.message)
    return null
  }
}

export async function registerBiometric(_userName: string): Promise<{ credentialId: string } | null> {
  const bioId = await tryNativeBiometric()
  if (bioId) return { credentialId: bioId }

  const deviceId = getDeviceId()
  return { credentialId: `device:${deviceId}` }
}

export async function authenticateBiometric(): Promise<{ credentialId: string } | null> {
  const bioId = await tryNativeBiometric()
  if (bioId) return { credentialId: bioId }

  const deviceId = getDeviceId()
  return { credentialId: `device:${deviceId}` }
}
