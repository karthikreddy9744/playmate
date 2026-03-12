import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword, signInWithPopup, updateProfile } from 'firebase/auth'
import { auth, googleProvider, lazyDb } from '../lib/firebase'
import { toast } from 'react-toastify'
import { api, saveToken } from '../lib/api'
import { markAuthenticated } from '../hooks/useAuth'
import { motion } from 'framer-motion'
import { FiUser, FiMail, FiPhone, FiLock } from 'react-icons/fi'
import { FcGoogle } from 'react-icons/fc'

export default function Register() {
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => setFormData(p => ({ ...p, [key]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = formData.name.trim()
    if (!trimmedName) {
      toast.error('Name is required')
      return
    }
    if (trimmedName.length < 2) {
      toast.error('Name must be at least 2 characters')
      return
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match!')
      return
    }
    setLoading(true)
    try {
      // Check email availability in our backend BEFORE creating Firebase user
      // to prevent orphan Firebase entries when email is already taken
      const { data: emailCheck } = await api.get(`/auth/check-email?email=${encodeURIComponent(formData.email)}`)
      if (emailCheck?.exists) {
        toast.error('This email is already registered. Please sign in instead.')
        setLoading(false)
        return
      }

      // Prevent the global auth listener from auto-syncing before
      // we finish our registration flow and provide a proper name.
      localStorage.setItem('skip_firebase_sync', '1')
      const cred = await createUserWithEmailAndPassword(auth, formData.email, formData.password)
      await updateProfile(cred.user, { displayName: trimmedName })

      // Write role to Firestore (for role-caching in useAuth) — non-blocking.
      // Firestore is just a local cache for the role; the backend DB is the source of truth.
      // If Firestore rules reject the write (403), registration must still proceed.
      Promise.all([lazyDb(), import('firebase/firestore')])
        .then(([db, { doc, setDoc }]) =>
          setDoc(doc(db, 'users', cred.user.uid), { name: trimmedName, email: formData.email, role: 'user', createdAt: new Date() })
        )
        .catch(err => console.warn('[Register] Firestore role-cache write failed (non-critical):', err))

      // Register in our backend with the REAL password so form-login works later
      const { data } = await api.post('/auth/register', {
        firebaseUid: cred.user.uid,
        name: trimmedName,
        email: formData.email,
        password: formData.password,
      })
      if (!data?.token) {
        throw new Error('Backend registration failed: missing auth token')
      }
      saveToken(data.token)
      if (data.refreshToken) localStorage.setItem('playmate_refresh', data.refreshToken)

      toast.success('Account created successfully!')
      navigate('/profile')
    } catch (err: any) {
      console.error('[Register] registration error:', err)
      toast.error(err?.message || 'Failed to create account')
    } finally {
      // Allow the global auth listener to resume normal behavior
      localStorage.removeItem('skip_firebase_sync')
      setLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    setLoading(true)
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const user = result.user
      const resolvedName = user.displayName?.trim() || user.email?.split('@')[0] || 'PlayMate User'
      // Run Firestore write + backend sync IN PARALLEL
      const [db, { doc, setDoc }] = await Promise.all([lazyDb(), import('firebase/firestore')])
      const [, syncResult] = await Promise.allSettled([
        setDoc(doc(db, 'users', user.uid), { name: resolvedName, email: user.email || '', role: 'user', createdAt: new Date() }),
        api.post('/auth/firebase-sync', { firebaseUid: user.uid, name: resolvedName, email: user.email || '', provider: 'google', photoUrl: user.photoURL || '' })
      ])
      if (syncResult.status === 'fulfilled' && syncResult.value.data?.token) {
        const data = syncResult.value.data
        saveToken(data.token)
        if (data.refreshToken) localStorage.setItem('playmate_refresh', data.refreshToken)
        markAuthenticated({
          id: data.id || data.userId,
          email: data.email || user.email || '',
          name: data.name || resolvedName,
          role: data.role || 'user',
          verifiedEmail: !!data.verifiedEmail,
          firebaseUid: user.uid,
        })
      }
      toast.success('Account created successfully!')
      navigate('/profile')
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') toast.error(error.message)
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-white via-surface to-accentLight/20">
      <div className="fixed -top-32 -right-32 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed -bottom-32 -left-32 w-96 h-96 bg-info/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-accent to-accentDark rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-glow">
            <span className="text-white text-2xl font-bold">P</span>
          </div>
          <h2 className="text-3xl font-bold text-textPrimary">Join PlayMate</h2>
          <p className="text-textSecondary mt-1">Create your account and start playing</p>
        </div>

        <div className="glass-card-solid p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-textPrimary mb-1.5">Full Name</label>
              <div className="relative">
                <FiUser className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-textSecondary" />
                <input type="text" value={formData.name} onChange={set('name')} className="input-field !pl-10" placeholder="John Doe" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-textPrimary mb-1.5">Email Address</label>
              <div className="relative">
                <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-textSecondary" />
                <input type="email" value={formData.email} onChange={set('email')} className="input-field !pl-10" placeholder="you@example.com" required />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-textPrimary mb-1.5">Password</label>
              <div className="relative">
                <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-textSecondary" />
                <input type="password" value={formData.password} onChange={set('password')} className="input-field !pl-10" placeholder="Create a password" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-textPrimary mb-1.5">Confirm Password</label>
              <div className="relative">
                <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-textSecondary" />
                <input type="password" value={formData.confirmPassword} onChange={set('confirmPassword')} className="input-field !pl-10" placeholder="Confirm your password" required />
              </div>
            </div>

            <label className="flex items-start gap-2 pt-1 cursor-pointer">
              <input type="checkbox" required className="mt-0.5 w-4 h-4 rounded border-border text-accent focus:ring-accent/30" />
              <span className="text-xs text-textSecondary leading-snug">I agree to the <a href="#" className="text-accent hover:underline">Terms</a> and <a href="#" className="text-accent hover:underline">Privacy Policy</a></span>
            </label>

            <button type="submit" disabled={loading} className="btn-primary w-full !py-3.5 text-base">
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center"><span className="px-3 text-xs text-textSecondary bg-white">Or sign up with</span></div>
          </div>

          <div className="flex justify-center">
            <button type="button" onClick={handleGoogleSignUp} disabled={loading} className="btn-secondary flex items-center justify-center gap-2 !py-2.5 w-full">
              <FcGoogle className="w-4 h-4" /> Sign up with Google
            </button>
          </div>
        </div>

        <p className="text-center text-sm text-textSecondary mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-accent font-semibold hover:underline">Sign in</Link>
        </p>
      </motion.div>
    </div>
  )
}
