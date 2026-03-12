import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// ─── Service Worker Registration ────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/firebase-messaging-sw.js', { scope: '/' })
      .then((registration) => {
        console.log('SW registered:', registration.scope)

        // Check for updates periodically (every 60 min)
        setInterval(() => {
          registration.update()
        }, 60 * 60 * 1000)

        // Listen for push notifications in foreground
        if ('PushManager' in window && 'Notification' in window) {
          import('firebase/messaging').then(({ getMessaging, onMessage }) => {
            const messaging = getMessaging()
            onMessage(messaging, (payload) => {
              // Show toast notification
              import('react-toastify').then(({ toast }) => {
                const { title, body } = payload.notification || {}
                toast.info(<div><strong>{title || 'PlayMate'}</strong><br />{body || 'You have a new notification'}</div>, {
                  autoClose: 6000,
                  position: 'top-right',
                })
              })
            })
          })
        }
      })
      .catch((error) => {
        console.error('SW registration failed:', error)
      })
  })

  // Handle SW update (skip waiting)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // New SW took control — could reload, but let the usePWA hook handle UX
  })
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
