// Firebase configuration and initialization
// ONLY auth is eagerly loaded — everything else is lazy to avoid blocking initial render
import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCNCUNhrFF57xl0HcNAN3pqKAihJrBWiWk',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'playmate-4b25d.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'playmate-4b25d',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'playmate-4b25d.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '189801490683',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:189801490683:web:eb10870d14c599272fa85e',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-S2DV3CL17V'
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Auth — always needed immediately for onAuthStateChanged
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()

// ─── Lazy-loaded services (only imported when first used) ───

// Firestore — loaded on demand (saves ~324KB from initial bundle)
import type { Firestore } from 'firebase/firestore'
let _db: Firestore | null = null
export async function lazyDb(): Promise<Firestore> {
  if (!_db) {
    const { getFirestore } = await import('firebase/firestore')
    _db = getFirestore(app)
  }
  return _db
}

// Storage — loaded on demand
export async function lazyStorage() {
  const { getStorage } = await import('firebase/storage')
  return getStorage(app)
}

// Messaging — loaded on demand (only when push notifications needed)
let _messagingInstance: Awaited<ReturnType<typeof import('firebase/messaging').getMessaging>> | null = null
export async function lazyMessaging() {
  if (!_messagingInstance) {
    const { getMessaging } = await import('firebase/messaging')
    _messagingInstance = getMessaging(app)
  }
  return _messagingInstance
}

// Analytics — loaded on demand (non-critical, can wait)
export async function lazyAnalytics() {
  const { getAnalytics } = await import('firebase/analytics')
  return getAnalytics(app)
}

/**
 * Request FCM notification permission and get the device token.
 * Returns null if permission denied or unsupported.
 */
export async function requestFcmToken(): Promise<string | null> {
  try {
    if (!('Notification' in window)) return null
    if (Notification.permission === 'denied') return null

    // Only request permission if already granted (avoid "not from user gesture" error)
    // If not yet granted, return null — permission will be requested on user interaction
    if (Notification.permission !== 'granted') return null

    const { getToken } = await import('firebase/messaging')
    const messaging = await lazyMessaging()
    const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || ''
    const token = await getToken(messaging, { vapidKey: VAPID_KEY || undefined })
    return token || null
  } catch (err) {
    console.warn('[FCM] Could not get FCM token:', err)
    return null
  }
}

/**
 * Request notification permission from a user gesture (button click), then get the FCM token.
 */
export async function requestFcmPermissionAndToken(): Promise<string | null> {
  try {
    if (!('Notification' in window)) return null
    if (Notification.permission === 'denied') return null

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return null

    return requestFcmToken()
  } catch (err) {
    console.warn('[FCM] Could not request permission:', err)
    return null
  }
}

/**
 * Register the FCM device token with the backend so it can send push notifications.
 */
export async function registerFcmTokenWithBackend(firebaseUid: string): Promise<void> {
  try {
    const token = await requestFcmToken()
    if (!token) return
    const { api } = await import('./api')
    await api.post('/auth/fcm-token', { firebaseUid, fcmToken: token })
    console.log('[FCM] Device token registered with backend.')
  } catch (err) {
    console.warn('[FCM] Failed to register token:', err)
  }
}

// Export the Firebase app instance
export default app