import { useEffect, useSyncExternalStore } from 'react'
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth'
import { auth, lazyDb, registerFcmTokenWithBackend } from '../lib/firebase'
import { api, clearToken, saveToken } from '../lib/api'

interface User extends FirebaseUser {
  role?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  verifiedEmail?: boolean;
  backendUserId?: number | null;
}

// ─── Tiny shared store (avoids duplicate listeners per component) ───
const AUTH_CACHE_KEY = 'playmate_auth'

function getCachedRole(): string {
  try {
    const cached = localStorage.getItem(AUTH_CACHE_KEY)
    return cached ? JSON.parse(cached).role || 'user' : 'user'
  } catch { return 'user' }
}

function getCachedAuth(): boolean {
  try {
    const cached = localStorage.getItem(AUTH_CACHE_KEY)
    return cached ? JSON.parse(cached).isAuthenticated === true : false
  } catch { return false }
}

function getCachedVerifiedEmail(): boolean {
  try {
    const cached = localStorage.getItem(AUTH_CACHE_KEY)
    return cached ? JSON.parse(cached).verifiedEmail === true : false
  } catch { return false }
}

function getCachedBackendUserId(): number | null {
  try {
    const cached = localStorage.getItem(AUTH_CACHE_KEY)
    return cached ? JSON.parse(cached).backendUserId || null : null
  } catch { return null }
}

function getCachedFirebaseUid(): string {
  try {
    const cached = localStorage.getItem(AUTH_CACHE_KEY)
    return cached ? JSON.parse(cached).firebaseUid || '' : ''
  } catch { return '' }
}

let state: AuthState = {
  user: null,
  isAuthenticated: getCachedAuth(),
  loading: !getCachedAuth(),
  verifiedEmail: getCachedVerifiedEmail(),
  backendUserId: getCachedBackendUserId(),
}

const listeners = new Set<() => void>()
function notify() { listeners.forEach(l => l()) }

function setState(next: Partial<AuthState>) {
  state = { ...state, ...next }
  notify()
}

// ─── One-time Firebase listener ───
let listenerStarted = false
let fcmRegistered = false

function startAuthListener() {
  if (listenerStarted) return
  listenerStarted = true

  onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      // 1) Show the app IMMEDIATELY with cached role (no Firestore wait)
      const cachedRole = getCachedRole()
      const userWithRole: User = Object.assign(firebaseUser, { role: cachedRole })
      setState({ user: userWithRole, isAuthenticated: true, loading: false })

      // 2) Register FCM device token once per session
      if (!fcmRegistered) {
        fcmRegistered = true
        registerFcmTokenWithBackend(firebaseUser.uid).catch(() => {})
      }

      // 3) Sync Firebase user with backend
      try {
        if (localStorage.getItem('skip_firebase_sync') !== '1') {
          const isGoogle = firebaseUser.providerData.some(p => p.providerId === 'google.com');
          const fallbackName =
            firebaseUser.displayName?.trim() ||
            firebaseUser.email?.split('@')[0] ||
            'PlayMate User'
          const { data } = await api.post('/auth/firebase-sync', {
            firebaseUid: firebaseUser.uid,
            email: firebaseUser.email,
            name: fallbackName,
            photoUrl: firebaseUser.photoURL,
            provider: isGoogle ? 'google' : 'email',
          });
          if (data.token) {
            saveToken(data.token);
            // Re-trigger FCM registration if it failed the first time without a token
            if (!fcmRegistered) {
              registerFcmTokenWithBackend(firebaseUser.uid).catch(() => {});
            }
          }
          // Use the role from the backend response (source of truth)
          const backendRole = data.role || 'user'
          if (backendRole !== cachedRole) {
            Object.assign(firebaseUser, { role: backendRole })
            setState({ user: firebaseUser as User, backendUserId: data.id || data.userId || null, verifiedEmail: !!data.verifiedEmail })
          } else {
            setState({ backendUserId: data.id || data.userId || null, verifiedEmail: !!data.verifiedEmail })
          }
          localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({ isAuthenticated: true, role: backendRole, verifiedEmail: !!data.verifiedEmail, backendUserId: data.id || data.userId || null, firebaseUid: firebaseUser.uid }))
          return // Backend is the source of truth — skip Firestore role fetch
        }
      } catch (error) {
        console.error('Error syncing Firebase user with backend:', error);
      }

      // 4) Fetch actual role from Firestore in the BACKGROUND
      try {
        const db = await lazyDb()
        const { doc, getDoc } = await import('firebase/firestore')
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
        const role = snap.exists() ? snap.data()?.role || 'user' : 'user'

        if (role !== cachedRole) {
          Object.assign(firebaseUser, { role })
          setState({ user: firebaseUser as User })
        }

        localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({ isAuthenticated: true, role }))
      } catch {
        localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({ isAuthenticated: true, role: cachedRole }))
      }
    } else {
      // No Firebase user — but a form-login JWT session may still be valid.
      const token = localStorage.getItem('playmate_token')
      const cached = localStorage.getItem(AUTH_CACHE_KEY)
      if (token && cached) {
        try {
          const parsed = JSON.parse(cached)
          if (parsed.isAuthenticated) {
            // Validate the JWT is still good by calling /auth/me
            const { data } = await api.get('/auth/me')
            const fakeUser = {
              email: data.email,
              displayName: data.name,
              role: data.role || parsed.role || 'user',
              uid: data.firebaseUid || parsed.firebaseUid || '',
            } as unknown as User
            setState({ user: fakeUser, isAuthenticated: true, loading: false, verifiedEmail: !!data.verifiedEmail, backendUserId: data.id })
            localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({ isAuthenticated: true, role: data.role || 'user', verifiedEmail: !!data.verifiedEmail, backendUserId: data.id, firebaseUid: data.firebaseUid || '' }))
            return
          }
        } catch {
          // JWT is invalid/expired — fall through to clear
        }
      }
      fcmRegistered = false
      setState({ user: null, isAuthenticated: false, loading: false })
      localStorage.removeItem(AUTH_CACHE_KEY)
      clearToken()
    }
  })
}

/**
 * Call after a successful backend-only login (email/password).
 * Sets auth state without requiring Firebase signInWithEmailAndPassword,
 * which would produce an unavoidable 400 console error if the user
 * doesn't exist in Firebase or credentials differ.
 */
export function markAuthenticated(backendUser: { id: number; email: string; name: string; role: string; verifiedEmail?: boolean; firebaseUid?: string }) {
  const fakeUser = { email: backendUser.email, displayName: backendUser.name, role: backendUser.role, uid: backendUser.firebaseUid || '' } as unknown as User
  setState({ user: fakeUser, isAuthenticated: true, loading: false, verifiedEmail: !!backendUser.verifiedEmail, backendUserId: backendUser.id })
  localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({ isAuthenticated: true, role: backendUser.role, verifiedEmail: !!backendUser.verifiedEmail, backendUserId: backendUser.id, firebaseUid: backendUser.firebaseUid || '' }))
}

/** Call on explicit logout to clear state immediately. */
export function markLoggedOut() {
  setState({ user: null, isAuthenticated: false, loading: false })
  localStorage.removeItem(AUTH_CACHE_KEY)
  clearToken()
}

// ─── Hook ───
export const useAuth = (): AuthState => {
  useEffect(() => { startAuthListener() }, [])

  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb) },
    () => state,
  )
}
