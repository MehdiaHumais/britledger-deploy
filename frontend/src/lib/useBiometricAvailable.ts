import { useEffect, useState } from 'react'

// Show fingerprint auth on touch devices (phones/tablets, including the native
// APK) and hide it on desktop/laptop with a mouse. We use pointer/hover media
// queries instead of Capacitor's native-platform check, which can read false
// inside some APK builds before the native bridge is ready.
function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  return !window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

export function useBiometricAvailable(): boolean {
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    let active = true
    if (active) setAvailable(isTouchDevice())
    return () => {
      active = false
    }
  }, [])

  return available
}
