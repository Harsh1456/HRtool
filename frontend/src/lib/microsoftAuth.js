/**
 * Microsoft OAuth 2.0 PKCE helper (public-client / SPA flow).
 * No client secret is needed — the code_verifier proves identity.
 */

const CLIENT_ID = import.meta.env.VITE_MICROSOFT_CLIENT_ID || ''
const TENANT_ID = import.meta.env.VITE_MICROSOFT_TENANT_ID || 'common'
const REDIRECT_URI = window.location.origin + '/login'
const SCOPES = 'openid profile email User.Read'

const AUTHORITY = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0`

// ── PKCE helpers ─────────────────────────────────────────────────────────────

function generateRandom(length = 64) {
    const array = new Uint8Array(length)
    crypto.getRandomValues(array)
    return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
}

async function sha256(plain) {
    const encoder = new TextEncoder()
    const data = encoder.encode(plain)
    return crypto.subtle.digest('SHA-256', data)
}

function base64UrlEncode(buffer) {
    const bytes = new Uint8Array(buffer)
    let str = ''
    bytes.forEach((b) => (str += String.fromCharCode(b)))
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Kick off the Microsoft login redirect.
 * Stores code_verifier + state in sessionStorage for the callback.
 */
export async function loginWithMicrosoft() {
    if (!CLIENT_ID) {
        throw new Error('VITE_MICROSOFT_CLIENT_ID is not set in .env')
    }

    const codeVerifier = generateRandom(64)
    const state = generateRandom(16)

    const hashed = await sha256(codeVerifier)
    const codeChallenge = base64UrlEncode(hashed)

    sessionStorage.setItem('ms_code_verifier', codeVerifier)
    sessionStorage.setItem('ms_state', state)

    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: 'code',
        redirect_uri: REDIRECT_URI,
        response_mode: 'query',
        scope: SCOPES,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
    })

    window.location.href = `${AUTHORITY}/authorize?${params}`
}

/**
 * Call this when the page loads and `?code=...` is in the URL.
 * Returns `{ id_token, access_token }` or throws on failure.
 */
export async function handleMicrosoftCallback(code, returnedState) {
    const expectedState = sessionStorage.getItem('ms_state')
    const codeVerifier = sessionStorage.getItem('ms_code_verifier')

    // Clean up immediately
    sessionStorage.removeItem('ms_state')
    sessionStorage.removeItem('ms_code_verifier')

    if (!expectedState || returnedState !== expectedState) {
        throw new Error('OAuth state mismatch — possible CSRF attack.')
    }
    if (!codeVerifier) {
        throw new Error('Missing PKCE code verifier.')
    }

    const body = new URLSearchParams({
        client_id: CLIENT_ID,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: codeVerifier,
        scope: SCOPES,
    })

    const res = await fetch(`${AUTHORITY}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    })

    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error_description || 'Token exchange failed')
    }

    const data = await res.json()
    return { id_token: data.id_token, access_token: data.access_token }
}
