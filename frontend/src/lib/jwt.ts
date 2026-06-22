// Simple browser-compatible JWT implementation using Web Crypto API

function base64UrlEncode(str: string) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(str: string) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  return atob(base64)
}

async function getCryptoKey(secret: string) {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

export async function signJWT(payload: object, secret: string) {
  const header = { alg: 'HS256', typ: 'JWT' }
  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  
  const dataToSign = `${encodedHeader}.${encodedPayload}`
  const encoder = new TextEncoder()
  const key = await getCryptoKey(secret)
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(dataToSign))
  const encodedSignature = base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)))
  
  return `${dataToSign}.${encodedSignature}`
}

export async function verifyJWT(token: string, secret: string) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    
    const [encodedHeader, encodedPayload, encodedSignature] = parts
    const dataToSign = `${encodedHeader}.${encodedPayload}`
    
    const encoder = new TextEncoder()
    const key = await getCryptoKey(secret)
    
    // Convert base64url signature back to Uint8Array
    let base64 = encodedSignature.replace(/-/g, '+').replace(/_/g, '/')
    while (base64.length % 4) base64 += '='
    const binaryStr = atob(base64)
    const signature = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) {
      signature[i] = binaryStr.charCodeAt(i)
    }
    
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      encoder.encode(dataToSign)
    )
    
    if (isValid) {
      return JSON.parse(base64UrlDecode(encodedPayload))
    }
    return null
  } catch (e) {
    console.error('JWT Verification failed:', e)
    return null
  }
}
