import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signInWithPopup } from 'firebase/auth'
import { auth, googleProvider } from '../lib/firebase'
import { api, saveToken } from '../lib/api'
import { markAuthenticated } from '../hooks/useAuth'
import { toast } from 'react-toastify'
import { motion } from 'framer-motion'
import { FiMail, FiLock } from 'react-icons/fi'
import { FcGoogle } from 'react-icons/fc'

export default function Login() {
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const navigate = useNavigate()



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      // Backend-only login — no Firebase signInWithEmailAndPassword call.
      // This avoids the unavoidable browser 400 console error that Firebase
      // produces when credentials don't match or the user doesn't exist there.
      const { data } = await api.post('/auth/login', {
        email: formData.email,
        password: formData.password
      })

      if (!data.token) throw new Error('Login failed: no token received')

      saveToken(data.token)
      if (data.refreshToken) localStorage.setItem('playmate_refresh', data.refreshToken)

      // Set auth state directly (no Firebase dependency for form login)
      markAuthenticated({
        id: data.id || data.userId,
        email: data.email || formData.email,
        name: data.name || formData.email.split('@')[0],
        role: data.role || 'user',
        verifiedEmail: !!data.verifiedEmail,
        firebaseUid: data.firebaseUid || '',
      })

      if (data.requiresVerification) {
        toast.info('Please verify your email from your Profile page to unlock all features.')
      } else {
        toast.success('Login successful!')
      }
      navigate('/profile')
    } catch (error: any) {
      toast.error(error?.response?.data?.error || error.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const user = result.user
      const resolvedName = user.displayName?.trim() || user.email?.split('@')[0] || 'PlayMate User'
      try {
        const { data } = await api.post('/auth/firebase-sync', {
          firebaseUid: user.uid,
          name: resolvedName,
          email: user.email || '',
          provider: 'google', // <-- Important: tell backend it's a Google sign-in
          photoUrl: user.photoURL || '',
        })
        if (data.token) saveToken(data.token)
        if (data.refreshToken) localStorage.setItem('playmate_refresh', data.refreshToken)
        markAuthenticated({
          id: data.id || data.userId,
          email: data.email || user.email || '',
          name: data.name || resolvedName,
          role: data.role || 'user',
          verifiedEmail: !!data.verifiedEmail,
          firebaseUid: user.uid,
        })
      } catch (e) { console.error('Backend sync failed:', e) }
      toast.success('Login successful!')
      // Request notification permission and register FCM token
      try {
        const { requestFcmPermissionAndToken, registerFcmTokenWithBackend } = await import('../lib/firebase')
        const token = await requestFcmPermissionAndToken()
        if (token && user?.uid) {
          await registerFcmTokenWithBackend(user.uid)
        }
      } catch (err) {
        console.warn('[Login] FCM registration failed:', err)
      }
      navigate('/')
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
        toast.error(error.message)
      }
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-white via-surface to-accentLight/20">
      {/* Decorative blobs */}
      <div className="fixed -top-32 -right-32 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed -bottom-32 -left-32 w-96 h-96 bg-info/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-accent to-accentDark rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-glow">
            <span className="text-white text-2xl font-bold">P</span>
          </div>
          <h2 className="text-3xl font-bold text-textPrimary">Welcome Back</h2>
          <p className="text-textSecondary mt-1">Sign in to your PlayMate account</p>
        </div>

        {/* Card */}
        <div className="glass-card-solid p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-textPrimary mb-1.5">Email Address</label>
              <div className="relative">
                <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-textSecondary" />
                <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="input-field !pl-10" placeholder="you@example.com" required />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-textPrimary mb-1.5">Password</label>
              <div className="relative">
                <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-textSecondary" />
                <input type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })}
                  className="input-field !pl-10" placeholder="Enter your password" required />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-accent focus:ring-accent/30" />
                <span className="text-textSecondary">Remember me</span>
              </label>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full !py-3.5 text-base">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center"><span className="px-3 text-xs text-textSecondary bg-white">Or continue with</span></div>
          </div>

          {/* Social */}
          <div className="flex justify-center">
            <button type="button" onClick={handleGoogleSignIn} disabled={loading} className="btn-secondary flex items-center justify-center gap-2 !py-2.5 w-full">
              <FcGoogle className="w-4 h-4" /> Sign in with Google
            </button>
          </div>
        </div>

        <p className="text-center text-sm text-textSecondary mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-accent font-semibold hover:underline">Sign up</Link>
        </p>
      </motion.div>
    </div>
  )
}
