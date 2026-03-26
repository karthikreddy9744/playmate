import React, { useState, useRef, useEffect } from 'react'
import ProfileLocationPicker from '../components/ProfileLocationPicker'
import { useAuth } from '../hooks/useAuth'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiMail, FiPhone, FiMapPin, FiClock, FiShield, FiUser,
  FiStar, FiActivity, FiPlus, FiX, FiCamera, FiCheck,
  FiAlertCircle, FiLoader, FiCheckCircle, FiRefreshCw
} from 'react-icons/fi'
import { MdSportsTennis, MdVerified, MdEmail } from 'react-icons/md'
import { api } from '../lib/api'
import { auth } from '../lib/firebase'
import { toast } from 'react-toastify'

const SPORTS = [
  'Badminton', 'Cricket', 'Football', 'Tennis', 'Basketball', 'Volleyball',
  'Table Tennis', 'Squash', 'Running', 'Cycling', 'Swimming', 'Yoga',
  'Gym/Fitness', 'Trekking', 'Ultimate Frisbee', 'Skating', 'Golf',
  'Hockey', 'Baseball', 'Rugby', 'Boxing', 'Martial Arts'
]

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } }
const stagger = { show: { transition: { staggerChildren: 0.08 } } }

function Card({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {


  return (
    <motion.div variants={fadeUp} className="glass-card-solid p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-accentLight flex items-center justify-center">
          <Icon className="w-4 h-4 text-accentDark" />
        </div>
        <h3 className="text-lg font-semibold text-textPrimary">{title}</h3>
      </div>
      {children}
    </motion.div>
  )
}

function StatRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
      <span className="text-sm text-textSecondary">{label}</span>
      <span className={`text-sm font-medium ${highlight ? 'text-accent' : 'text-textPrimary'}`}>{value}</span>
    </div>
  )
}

// Phone verification removed — no frontend phone OTP modal

interface EmailOtpModalProps {
  email: string
  name: string
  firebaseUid: string
  onVerified: () => void
  onClose: () => void
}

function EmailOtpModal({ email, name, firebaseUid, onVerified, onClose }: EmailOtpModalProps) {
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [step, setStep] = useState<'send' | 'verify' | 'success'>('send')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendTimer, setResendTimer] = useState(0)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const [isVerifying, setIsVerifying] = useState(false)

  // Auto-focus first input when verify step starts
  useEffect(() => {
    if (step === 'verify' && inputRefs.current[0]) {
      inputRefs.current[0]?.focus()
    }
  }, [step])

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendTimer])

  const sendOtp = async () => {
    const normalizedEmail = email.trim().toLowerCase()
    console.log('🔍 Sending Profile OTP:', { email: normalizedEmail, name });
    
    setLoading(true); setError('')
    try {
      console.log('🌐 Making API request to:', '/auth/send-email-otp')
      console.log('📤 Request payload:', { email: normalizedEmail, name })
      
      const response = await api.post(
        '/auth/send-email-otp',
        { email: normalizedEmail, name },
        { skipAuth: true } as any
      )
      console.log('✅ Profile OTP sent response:', response.data);
      setStep('verify')
      setResendTimer(300) // 5 minute cooldown
      toast.success('OTP sent to ' + normalizedEmail)
    } catch (err: any) {
      console.error('❌ Failed to send Profile OTP:', err);
      console.error('❌ Error details:', {
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        url: err.config?.url,
        method: err.config?.method
      });
      
      // Handle 404 specifically
      if (err.response?.status === 404) {
        setError('Email service not available. Please try again later.')
      } else if (err.response?.status === 429) {
        const ttl = Number(err.response?.data?.ttl)
        if (!Number.isNaN(ttl) && ttl > 0) {
          setResendTimer(Math.min(300, ttl))
        }
        setError(err.response?.data?.error || 'OTP already sent. Please wait before requesting again.')
      } else {
        setError(err.response?.data?.error || err.message || 'Failed to send OTP')
      }
    } finally { setLoading(false) }
  }

  const handleOtpChange = (index: number, value: string) => {
    // Only allow numbers
    const numericValue = value.replace(/\D/g, '').slice(0, 1)
    const newOtp = [...otp]
    newOtp[index] = numericValue
    setOtp(newOtp)

    // Auto-focus next input
    if (numericValue && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all 6 digits are entered
    if (newOtp.every(digit => digit !== '')) {
      setTimeout(() => {
        verifyOtp(newOtp.join(''))
      }, 300)
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    // Handle backspace to go to previous input
    if (e.key === 'Backspace' && !otp[index] && index > 0 && inputRefs.current[index - 1]) {
      inputRefs.current[index - 1]?.focus()
    }
    
    // Handle paste
    if (e.key === 'Enter') {
      const fullOtp = otp.join('')
      if (fullOtp.length === 6) {
        verifyOtp(fullOtp)
      }
    }
  }

  const verifyOtp = async (otpValue?: string) => {
    const normalizedEmail = email.trim().toLowerCase()
    const otpToVerify = (otpValue || otp.join('')).replace(/\D/g, '')
    
    if (otpToVerify.length !== 6) { 
      console.error('❌ OTP length validation failed:', { otp: otpToVerify, length: otpToVerify.length });
      setError('Please enter all 6 digits'); 
      return; 
    }
    
    console.log('🔍 Starting Profile OTP verification:', { 
      email, 
      firebaseUid, 
      otp: otpToVerify, 
      otpLength: otpToVerify.length 
    });
    
    setIsVerifying(true); setError('')
    try {
      console.log('🌐 Making API request to:', '/auth/verify-email-otp')
      console.log('📤 Request payload:', { firebaseUid, email: normalizedEmail, otp: otpToVerify })
      console.log('🌐 Full API URL:', api.defaults.baseURL + '/auth/verify-email-otp')
      
      const { data } = await api.post(
        '/auth/verify-email-otp',
        { firebaseUid, email: normalizedEmail, otp: otpToVerify },
        { skipAuth: true } as any
      )
      console.log('✅ Profile OTP verification response:', data);
      
      // Show success animation before closing
      setStep('success')
      toast.success('Email verified successfully!')
      
      // Wait for success animation before calling onVerified
      setTimeout(() => {
        onVerified()
      }, 2000)
      
    } catch (err: any) {
      console.error('❌ Profile OTP verification error:', err);
      console.error('❌ Error details:', {
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        url: err.config?.url,
        method: err.config?.method
      });
      const errorMessage = err.response?.data?.error || err.message || 'Invalid or expired OTP'

      // If verification request failed but backend may have still processed it
      // (race, network hiccup), attempt a quick check of backend user verification
      try {
        const statusResp = await api.get(`/users/firebase/${firebaseUid}`, { skipAuth: true } as any)
        if (statusResp?.data?.verifiedEmail) {
          console.log('✅ Backend reports email verified despite verify call error, treating as success')
          setStep('success')
          toast.success('Email verified successfully!')
          setTimeout(() => onVerified(), 2000)
          return
        }
      } catch (probeErr) {
        console.debug('Probe for verification status failed', probeErr)
      }

      // If user not found by firebaseUid, attempt fallback verification by email only
      if (err.response?.data?.code === 'USER_NOT_FOUND' || err.response?.status === 404) {
        try {
          console.log('🔁 Backend returned USER_NOT_FOUND for firebaseUid; trying email-only verify')
          const { data: fallback } = await api.post(
            '/auth/verify-email-otp',
            { email: normalizedEmail, otp: otpToVerify },
            { skipAuth: true } as any
          )
          console.log('✅ Email-only verify response:', fallback)
          setStep('success')
          toast.success('Email verified successfully!')
          setTimeout(() => onVerified(), 2000)
          return
        } catch (fallbackErr) {
          console.debug('Email-only verify attempt failed', fallbackErr)
        }
      }

      // Handle 404 specifically
      if (err.response?.status === 404) {
        setError('Verification service not available. Please try again later.')
      } else if (typeof errorMessage === 'string' && errorMessage.includes('Invalid or expired OTP')) {
        setError('The code you entered is incorrect or has expired. Please check your email and try again.')
        // Clear OTP on error
        setOtp(['', '', '', '', '', ''])
        inputRefs.current[0]?.focus()
      } else if (typeof errorMessage === 'string' && errorMessage.includes('too many attempts')) {
        setError('Too many incorrect attempts. Please wait 10 minutes and try again.')
      } else {
        setError(String(errorMessage))
      }
    } finally { 
      setIsVerifying(false)
    }
  }

  const handleResend = () => {
    if (resendTimer === 0) {
      setOtp(['', '', '', '', '', ''])
      sendOtp()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="glass-card-solid p-8 w-full max-w-md relative"
      >
        {/* Close button */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-textSecondary hover:text-textPrimary transition-colors"
        >
          <FiX className="w-5 h-5" />
        </button>

        {/* Success State */}
        {step === 'success' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-8"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <FiCheckCircle className="w-10 h-10 text-white" />
            </motion.div>
            <h2 className="text-2xl font-bold text-textPrimary mb-3">Email Verified!</h2>
            <p className="text-textSecondary">Your email has been successfully verified. You now have access to all features.</p>
            
            {/* Verified badge animation */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-6 inline-flex items-center gap-2 bg-accent/10 text-accent px-4 py-2 rounded-full border border-accent/20"
            >
              <MdVerified className="w-4 h-4" />
              <span className="font-medium">Verified Account</span>
            </motion.div>
          </motion.div>
        )}

        {/* Send & Verify States */}
        {step !== 'success' && (
          <>
            <div className="text-center mb-6">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-16 h-16 bg-gradient-to-br from-accent to-accentDark rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"
              >
                <MdEmail className="w-8 h-8 text-white" />
              </motion.div>
              <h2 className="text-2xl font-bold text-textPrimary mb-2">
                {step === 'send' ? 'Verify Your Email' : 'Enter Verification Code'}
              </h2>
              <p className="text-textSecondary text-sm">
                {step === 'send' 
                  ? `A 6-digit code will be sent to ${email}`
                  : `Enter the 6-digit code sent to ${email}`
                }
              </p>
            </div>

            {step === 'send' ? (
              <div>
                <button 
                  onClick={sendOtp} 
                  disabled={loading} 
                  className="btn-primary w-full !py-4 text-base font-medium flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <FiLoader className="w-5 h-5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <FiMail className="w-5 h-5" />
                      Send Verification Code
                    </>
                  )}
                </button>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
                  >
                    <p className="text-red-400 text-sm flex items-center gap-2">
                      <FiAlertCircle className="w-4 h-4 flex-shrink-0" />
                      {error}
                    </p>
                  </motion.div>
                )}
              </div>
            ) : (
              <div>
                {/* OTP Input Fields */}
                <div className="flex justify-center gap-2 mb-6">
                  {otp.map((digit, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <input
                        ref={el => inputRefs.current[index] = el}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        className={`w-12 h-14 text-center text-xl font-bold border-2 rounded-lg transition-all ${
                          digit 
                            ? 'border-accent bg-accent/10 text-accent' 
                            : 'border-border bg-surface text-textPrimary focus:border-accent/50'
                        } ${isVerifying ? 'animate-pulse' : ''}`}
                        disabled={isVerifying}
                      />
                    </motion.div>
                  ))}
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
                  >
                    <p className="text-red-400 text-sm flex items-center gap-2">
                      <FiAlertCircle className="w-4 h-4 flex-shrink-0" />
                      {error}
                    </p>
                  </motion.div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button 
                    onClick={() => verifyOtp()} 
                    disabled={isVerifying || otp.join('').length < 6} 
                    className="flex-1 btn-primary !py-3 font-medium flex items-center justify-center gap-2"
                  >
                    {isVerifying ? (
                      <>
                        <FiLoader className="w-4 h-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <FiCheckCircle className="w-4 h-4" />
                        Verify Code
                      </>
                    )}
                  </button>
                  
                  <button 
                    onClick={handleResend} 
                    disabled={resendTimer > 0 || loading}
                    className="btn-secondary !py-3 px-4 flex items-center gap-2"
                  >
                    <FiRefreshCw className={`w-4 h-4 ${resendTimer > 0 ? '' : 'rotate-180'} transition-transform`} />
                    {resendTimer > 0 ? `${resendTimer}s` : 'Resend'}
                  </button>
                </div>

                {/* Help Text */}
                <p className="text-center text-xs text-textSecondary mt-4">
                  Didn't receive the code? Check your spam folder or resend after {resendTimer}s
                </p>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  )
}
// Phone verification removed — no frontend phone OTP modal

// ── Main Profile Page ────────────────────────────────────────────────────────

export default function Profile() {
  const { user, isAuthenticated, loading, verifiedEmail: cachedVerified, backendUserId: cachedBackendUserId } = useAuth()

  const [backendUser, setBackendUser] = useState<any>(null)
  const [userSports, setUserSports] = useState<{ sport: string; skillLevel: string }[]>([])
  const [selectedSport, setSelectedSport] = useState('')
  const [customSport, setCustomSport] = useState('')
  const [skillLevel, setSkillLevel] = useState('Beginner')
  const [photoUploading, setPhotoUploading] = useState(false)
  const [showEmailOtp, setShowEmailOtp] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const [tempLocation, setTempLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [tempAddress, setTempAddress] = useState<string>('')
  const [showVerificationSuccess, setShowVerificationSuccess] = useState(false)
  const [notifMuted, setNotifMuted] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Playing preferences (persisted in localStorage)
  const [preferredRadius, setPreferredRadius] = useState(() => localStorage.getItem('playmate_radius') || '5 km (Default)')
  const [timeSlots, setTimeSlots] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('playmate_timeslots') || '[]') } catch { return [] }
  })
  const [availability, setAvailability] = useState(() => localStorage.getItem('playmate_availability') || 'Both')

  // Persist preferences changes
  useEffect(() => { localStorage.setItem('playmate_radius', preferredRadius) }, [preferredRadius])
  useEffect(() => { localStorage.setItem('playmate_timeslots', JSON.stringify(timeSlots)) }, [timeSlots])
  useEffect(() => { localStorage.setItem('playmate_availability', availability) }, [availability])

  const toggleTimeSlot = (slot: string) => {
    setTimeSlots(prev => prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot])
  }

  useEffect(() => {
    const fetchUser = (uid: string) => {
      api.get(`/users/firebase/${uid}`)
        .then(r => {
          setBackendUser(r.data)
          setNotifMuted(r.data?.notificationsMuted === true)
          if (r.data?.sports && Array.isArray(r.data.sports)) {
            setUserSports(r.data.sports.map((s: any) => ({
              sport: s.sportType || s.sport || '',
              skillLevel: s.skillLevel ? s.skillLevel.charAt(0) + s.skillLevel.slice(1).toLowerCase() : 'Beginner'
            })))
          }
        })
        .catch(() => {})
    }
    if (user?.uid) {
      fetchUser(user.uid)
    } else if (cachedBackendUserId) {
      api.get(`/users/${cachedBackendUserId}`)
        .then(r => {
          setBackendUser(r.data)
          setNotifMuted(r.data?.notificationsMuted === true)
          if (r.data?.sports && Array.isArray(r.data.sports)) {
            setUserSports(r.data.sports.map((s: any) => ({
              sport: s.sportType || s.sport || '',
              skillLevel: s.skillLevel ? s.skillLevel.charAt(0) + s.skillLevel.slice(1).toLowerCase() : 'Beginner'
            })))
          }
        })
        .catch(() => {})
    }
  }, [user?.uid, cachedBackendUserId])

  // Fetch typed ratings
  interface RatingDetail {
    id: number
    punctuality: number
    skillMatch: number
    friendliness: number
    reviewText?: string
    ratingType?: string
    rater?: { id: number; name: string; profilePictureUrl?: string }
    game?: { id: number; sportType?: string; title?: string }
  }
  const [hostRatings, setHostRatings] = useState<RatingDetail[]>([])
  const [participantRatings, setParticipantRatings] = useState<RatingDetail[]>([])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (backendUser?.id) {
      api.get(`/ratings/user/${backendUser.id}/as-host`).then(r => setHostRatings(r.data)).catch(() => {})
      api.get(`/ratings/user/${backendUser.id}/as-participant`).then(r => setParticipantRatings(r.data)).catch(() => {})
    }
  }, [backendUser?.id])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="w-12 h-12 border-4 border-accent/30 border-t-accent rounded-full animate-spin" />
    </div>
  )

  if (!isAuthenticated) return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <p className="text-textSecondary text-lg">Please log in to view your profile.</p>
    </div>
  )

  const handleAddSport = () => {
    const sport = selectedSport === 'custom' ? customSport.trim() : selectedSport
    if (sport && !userSports.some(s => s.sport === sport)) {
      setUserSports([...userSports, { sport, skillLevel }])
      setSelectedSport(''); setCustomSport(''); setSkillLevel('Beginner')
    }
  }

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.uid) return
    setPhotoUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post(`/users/firebase/${user.uid}/photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setBackendUser((prev: any) => ({ ...prev, profilePictureUrl: data.photoUrl }))
      toast.success('Profile photo updated!')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Photo upload failed')
    } finally {
      setPhotoUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // Use backend verified flag as the single source of truth for app features.
  // Falls back to cached value from login for instant display before backend loads.
  const isEmailVerified = backendUser ? Boolean(backendUser?.verifiedEmail) : Boolean(cachedVerified)
  const isVerified = isEmailVerified
  const photoUrl = backendUser?.profilePictureUrl || user?.photoURL || '/images/Profile_pic.jpg'

  // Debug logging for verification status
  console.log('🔍 Verification status:', {
    backendUserVerifiedEmail: backendUser?.verifiedEmail,
    firebaseEmailVerified: user?.emailVerified,
    isEmailVerified,
    isVerified
  })

  // Verification Success Animation Component
  const VerificationSuccessAnimation = () => (
    <AnimatePresence>
      {showVerificationSuccess && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.5, y: 50 }}
          className="fixed top-8 right-8 z-50 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
            className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center"
          >
            <FiCheckCircle className="w-5 h-5" />
          </motion.div>
          <div>
            <p className="font-semibold">Email Verified!</p>
            <p className="text-sm opacity-90">Your account is now verified</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  const refreshBackendUser = async () => {
    try {
      let response
      if (user?.uid) {
        response = await api.get(`/users/firebase/${user.uid}`)
      } else if (cachedBackendUserId) {
        response = await api.get(`/users/${cachedBackendUserId}`)
      } else {
        return
      }
      console.log('🔄 Refreshed backend user data:', response.data);
      const previousVerifiedStatus = backendUser?.verifiedEmail
      const newVerifiedStatus = response.data?.verifiedEmail
      
      setBackendUser(response.data)
      
      // Show success animation if verification status changed from false to true
      if (!previousVerifiedStatus && newVerifiedStatus) {
        setShowVerificationSuccess(true)
        setTimeout(() => setShowVerificationSuccess(false), 3000)
      }
    } catch (error) {
      console.error('❌ Failed to refresh backend user:', error);
    }
  }

  const handleSaveProfile = async () => {
    if (!user?.uid && !cachedBackendUserId) return

    setIsSaving(true)
    try {
      const resolvedName =
        backendUser?.name?.trim() ||
        user?.displayName?.trim() ||
        user?.email?.split('@')[0] ||
        'PlayMate User'
      const profileData = {
        name: resolvedName,
        age: backendUser?.age || null,
        gender: backendUser?.gender || null,
        bio: backendUser?.bio || null,
        phone: backendUser?.phone || null,
        locationCity: backendUser?.locationCity,
        locationAddress: backendUser?.locationAddress,
        locationLat: backendUser?.locationLat,
        locationLng: backendUser?.locationLng,
        sports: userSports.map(s => ({ sportType: s.sport, skillLevel: s.skillLevel.toUpperCase() }))
      }
      if (user?.uid) {
        await api.put(`/users/firebase/${user.uid}`, profileData)
      } else {
        await api.put(`/users/${cachedBackendUserId}`, profileData)
      }
      toast.success('Profile updated successfully!')
      refreshBackendUser()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update profile')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      {/* Verification Success Animation */}
      <VerificationSuccessAnimation />
      
      <div className="min-h-screen bg-surface py-10 px-4">
        <motion.div initial="hidden" animate="show" variants={stagger} className="max-w-4xl mx-auto space-y-6">

          {/* Profile Header */}
          <motion.div variants={fadeUp} className="glass-card-solid p-8 flex flex-col sm:flex-row items-center gap-6">
            <div className="relative flex-shrink-0 group">
              {/* Instagram-style outer ring */}
              <div className="p-[3px] rounded-full bg-gradient-to-tr from-accent via-emerald-300 to-teal-400 shadow-md">
                <div className="p-[2px] rounded-full bg-white">
                  <img src={photoUrl} alt="Profile"
                    className="w-24 h-24 rounded-full object-cover" />
                </div>
              </div>

              {/* Verified badge with animation */}
              <AnimatePresence>
                {isVerified && (
                  <motion.div 
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 180 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    className="absolute -top-1 -right-1 bg-accent rounded-full p-0.5 shadow-sm" 
                    title="Verified account"
                  >
                    <MdVerified className="w-4 h-4 text-white" />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Camera overlay — visible on hover, always shown on mobile */}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={photoUploading}
                title="Change photo"
                className="absolute inset-0 rounded-full flex flex-col items-center justify-end pb-2 bg-black/0 group-hover:bg-black/35 transition-all duration-200 cursor-pointer"
              >
                <span className="flex flex-col items-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  {photoUploading
                    ? <FiLoader className="w-5 h-5 text-white animate-spin" />
                    : <FiCamera className="w-5 h-5 text-white drop-shadow" />}
                  <span className="text-white text-[10px] font-semibold leading-tight drop-shadow">Edit</span>
                </span>
              </button>

              {/* Always-visible small camera badge at bottom */}
              <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-accent border-2 border-white flex items-center justify-center shadow pointer-events-none">
                {photoUploading
                  ? <FiLoader className="w-3 h-3 text-white animate-spin" />
                  : <FiCamera className="w-3 h-3 text-white" />}
              </div>

              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </div>

            <div className="text-center sm:text-left flex-1">
              <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={backendUser?.name || user?.displayName || user?.email?.split('@')[0] || ''}
                    onChange={e => setBackendUser((prev: any) => ({ ...(prev || {}), name: e.target.value }))}
                    className="text-2xl font-bold text-textPrimary bg-transparent border-none outline-none w-full"
                    placeholder="Enter your name"
                  />
                </div>
                <AnimatePresence>
                  {isVerified && (
                    <motion.span 
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      className="inline-flex items-center gap-1 bg-accent/10 text-accent text-xs font-medium px-2 py-0.5 rounded-full border border-accent/20"
                    >
                      <MdVerified className="w-3.5 h-3.5" /> Verified
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <p className="text-textSecondary mt-0.5 text-sm">{user?.email}</p>
              <p className="text-textSecondary text-xs mt-0.5">
                Role: <span className="chip chip-active text-xs">{backendUser?.role || 'user'}</span>
              </p>
            </div>
            <motion.div variants={fadeUp} className="flex justify-end mt-6">
            <button
              onClick={handleSaveProfile}
              disabled={isSaving}
              className="btn-primary flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <FiLoader className="w-4 h-4 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <FiCheck className="w-4 h-4" /> Save Changes
                </>
              )}
            </button>
          </motion.div>
        </motion.div>

          {/* Contact + Verification - Enhanced UX */}
          <motion.div variants={fadeUp} className="glass-card-solid p-6">
            <h3 className="text-lg font-semibold text-textPrimary mb-4 flex items-center gap-2">
              <FiShield className="w-5 h-5 text-accent" />
              Contact & Verification
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-surface border border-border/50 transition-all hover:border-accent/30">
                <div className="relative">
                  <FiMail className="w-5 h-5 text-accent" />
                  {isEmailVerified && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-textSecondary font-medium">Email Address</p>
                  <p className="text-sm font-medium text-textPrimary truncate">{user?.email}</p>
                </div>
                <AnimatePresence mode="wait">
                  {isEmailVerified ? (
                    <motion.span 
                      key="verified"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="flex items-center gap-1 text-xs text-green-600 font-medium flex-shrink-0"
                    >
                      <FiCheckCircle className="w-3.5 h-3.5" /> Verified
                    </motion.span>
                  ) : (
                    <motion.button 
                      key="verify"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      onClick={() => setShowEmailOtp(true)}
                      className="text-xs bg-accent/10 hover:bg-accent/20 text-accent px-3 py-1.5 rounded-full transition-all hover:scale-105 whitespace-nowrap flex-shrink-0 font-medium"
                    >
                      Verify Now
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </div>
            
            {/* Enhanced verification prompt */}
            <AnimatePresence>
              {!isVerified && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4"
                >
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/50">
                    <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <FiAlertCircle className="w-4 h-4 text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-800 mb-1">
                        Verify your email to unlock all features
                      </p>
                      <p className="text-xs text-amber-600 mb-3">
                        Get the <strong>Verified</strong> badge and enjoy full access to game creation, messaging, and premium features.
                      </p>
                      <button 
                        onClick={() => setShowEmailOtp(true)}
                        className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-full transition-all hover:scale-105 font-medium"
                      >
                        Verify Email Now
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Personal Details */}
          <motion.div variants={fadeUp} className="glass-card-solid p-6">
            <h3 className="text-lg font-semibold text-textPrimary mb-4 flex items-center gap-2">
              <FiUser className="w-5 h-5 text-accent" />
              Personal Details
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-textSecondary mb-1 block">Age</label>
                <input
                  type="number"
                  min={18}
                  max={120}
                  placeholder="Your age"
                  className="input-field text-sm w-full"
                  value={backendUser?.age || ''}
                  onChange={e => setBackendUser((prev: any) => ({ ...prev, age: e.target.value ? parseInt(e.target.value) : null }))}
                />
              </div>
              <div>
                <label className="text-xs text-textSecondary mb-1 block">Gender</label>
                <select
                  className="select-field text-sm w-full"
                  value={backendUser?.gender || ''}
                  onChange={e => setBackendUser((prev: any) => ({ ...prev, gender: e.target.value || null }))}
                >
                  <option value="">Prefer not to say</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                  <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-textSecondary mb-1 block">Bio <span className="text-textSecondary/50">({(backendUser?.bio || '').length}/200)</span></label>
                <textarea
                  maxLength={200}
                  rows={3}
                  placeholder="Tell others about yourself..."
                  className="input-field text-sm w-full resize-none"
                  value={backendUser?.bio || ''}
                  onChange={e => setBackendUser((prev: any) => ({ ...prev, bio: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-textSecondary mb-1 block">Phone</label>
                <input
                  type="tel"
                  maxLength={20}
                  placeholder="+91 9XXXXXXXXX"
                  className="input-field text-sm w-full"
                  value={backendUser?.phone || ''}
                  onChange={e => setBackendUser((prev: any) => ({ ...prev, phone: e.target.value }))}
                />
              </div>
            </div>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Sports & Skills */}
            <Card title="Sports & Skills" icon={MdSportsTennis}>
              {userSports.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {userSports.map((s, i) => (
                    <span key={i} className="chip chip-active text-xs flex items-center gap-1">
                      {s.sport} — {s.skillLevel}
                      <FiX className="w-3 h-3 cursor-pointer ml-0.5"
                        onClick={() => setUserSports(userSports.filter((_, idx) => idx !== i))} />
                    </span>
                  ))}
                </div>
              )}
              {userSports.length === 0 && <p className="text-sm text-textSecondary mb-4">No sports added yet.</p>}
              <div className="space-y-2">
                <select value={selectedSport} onChange={e => { setSelectedSport(e.target.value); setCustomSport('') }}
                  className="select-field text-sm">
                  <option value="">Select a sport</option>
                  {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
                  <option value="custom">Add Custom...</option>
                </select>
                {selectedSport === 'custom' && (
                  <input value={customSport} onChange={e => setCustomSport(e.target.value)}
                    className="input-field text-sm" placeholder="Custom sport name" />
                )}
                <select value={skillLevel} onChange={e => setSkillLevel(e.target.value)} className="select-field text-sm">
                  {['Beginner', 'Intermediate', 'Advanced'].map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <button onClick={handleAddSport} className="btn-primary text-sm w-full flex items-center justify-center gap-1.5">
                  <FiPlus className="w-4 h-4" /> Add Sport
                </button>
              </div>
            </Card>

            {/* Location */}
            <Card title="Location Preferences" icon={FiMapPin}>
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-surface flex items-center justify-between">
                  <span className="text-sm text-textSecondary">City</span>
                  <span className="text-sm text-textPrimary">{backendUser?.locationCity || 'Not set'}</span>
                </div>
                <div>
                  <label className="text-xs text-textSecondary mb-1 block">Manual City / Area</label>
                  <div className="flex gap-2">
                    <input
                      placeholder="e.g., Bangalore, HSR Layout"
                      className="input-field text-sm flex-1"
                      value={backendUser?.locationAddress || ''}
                      onChange={e => setBackendUser((prev: any) => ({ ...prev, locationAddress: e.target.value }))}
                    />
                    <button
                      type="button"
                      className="btn-secondary flex items-center gap-1"
                      onClick={() => {
                        if (backendUser?.locationLat && backendUser?.locationLng) {
                          setTempLocation({ lat: backendUser.locationLat, lng: backendUser.locationLng })
                        } else {
                          setTempLocation(null)
                        }
                        setTempAddress(backendUser?.locationAddress || '')
                        setShowMap(true)
                      }}
                    >
                      <FiMapPin />Pick
                    </button>
                  </div>
                  {showMap && (
                    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
                      <div className="bg-white rounded-lg shadow-lg p-4 max-w-xl w-full relative">
                        <button className="absolute top-2 right-2 text-lg" onClick={() => setShowMap(false)}>&times;</button>
                        <h2 className="text-lg font-semibold mb-2">Pick Location</h2>
                        <ProfileLocationPicker
                          value={tempLocation || (backendUser?.locationLat && backendUser?.locationLng ? { lat: backendUser.locationLat, lng: backendUser.locationLng } : undefined)}
                          onChange={(latlng: { lat: number; lng: number }, addr: string) => {
                            setTempLocation(latlng)
                            setTempAddress(addr)
                          }}
                        />
                        <div className="mt-3 flex items-center gap-2">
                          <input
                            type="text"
                            className="input-field flex-1 text-sm"
                            placeholder="Selected address"
                            value={tempAddress}
                            readOnly
                          />
                          <button
                            className="btn-secondary"
                            onClick={() => setShowMap(false)}
                          >
                            Cancel
                          </button>
                          <button
                            className="btn-primary"
                            disabled={!tempLocation}
                            onClick={() => {
                              if (tempLocation) {
                                setBackendUser((prev: any) => ({
                                  ...prev,
                                  locationLat: tempLocation.lat,
                                  locationLng: tempLocation.lng,
                                  locationAddress: tempAddress
                                }))
                              }
                              setShowMap(false)
                            }}
                          >
                            Use this location
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs text-textSecondary mb-1 block">Preferred Playing Radius</label>
                  <select className="select-field text-sm" value={preferredRadius} onChange={e => setPreferredRadius(e.target.value)}>
                    {['1 km', '2 km', '3 km', '5 km (Default)', '10 km', '15 km'].map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>
            </Card>

            {/* Playing Preferences */}
            <Card title="Playing Preferences" icon={FiClock}>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-textSecondary mb-2">Preferred Time Slots</p>
                  <div className="flex flex-wrap gap-2">
                    {['Morning', 'Afternoon', 'Evening', 'Night'].map(t => (
                      <label key={t} className="chip cursor-pointer hover:bg-accentLight transition text-xs flex items-center gap-1.5">
                        <input type="checkbox" checked={timeSlots.includes(t)} onChange={() => toggleTimeSlot(t)}
                          className="w-3.5 h-3.5 rounded border-border text-accent focus:ring-accent/30" />{t}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-textSecondary mb-2">Availability</p>
                  <div className="flex gap-3">
                    {['Weekday', 'Weekend', 'Both'].map(a => (
                      <label key={a} className="flex items-center gap-1.5 text-sm text-textPrimary cursor-pointer">
                        <input type="radio" name="avail" value={a} checked={availability === a}
                          onChange={() => setAvailability(a)}
                          className="text-accent focus:ring-accent/30" />{a}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Silent Notification Toggle */}
                <div className="pt-3 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-textPrimary">Mute Push Notifications</p>
                      <p className="text-xs text-textSecondary">In-app notifications still appear</p>
                    </div>
                    <button onClick={async () => {
                      if (!backendUser?.id) return
                      const next = !notifMuted
                      setNotifMuted(next)
                      try {
                        await api.put(`/users/${backendUser.id}`, { notificationsMuted: next })
                        toast.success(next ? 'Push notifications muted' : 'Push notifications enabled')
                      } catch {
                        setNotifMuted(!next)
                        toast.error('Failed to update preference')
                      }
                    }} className={`relative w-11 h-6 rounded-full transition-colors ${notifMuted ? 'bg-accent' : 'bg-gray-300'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${notifMuted ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Verification & Trust */}
            <Card title="Verification & Trust" icon={FiShield}>
              <div className="space-y-1">
                <StatRow label="Email" value={isEmailVerified ? '✓ Verified' : '✗ Not Verified'} highlight={!!isEmailVerified} />
                <StatRow label="Account Badge" value={isVerified ? '✅ Verified' : '—'} highlight={!!isVerified} />
                <StatRow label="Member Since" value={backendUser?.createdAt?.split('T')[0] || '—'} />
              </div>
              {!isVerified && (
                <div className="mt-4 flex gap-2">
                  <button onClick={() => setShowEmailOtp(true)} className="flex-1 btn-secondary text-sm">Verify Email</button>
                </div>
              )}
            </Card>

            {/* Hosting Ratings — ratings received when you created games */}
            <Card title="Hosting Ratings & Reviews" icon={FiStar}>
              <div className="space-y-1 mb-3">
                <StatRow label="Avg Hosting Rating" value={
                  hostRatings.length > 0
                    ? `${(hostRatings.reduce((s, r) => s + (r.punctuality + r.skillMatch + r.friendliness) / 3, 0) / hostRatings.length).toFixed(1)} / 5.0`
                    : 'No hosting ratings yet'
                } />
                <StatRow label="Total Reviews" value={String(hostRatings.length)} />
              </div>
              {hostRatings.length > 0 && (
                <div className="space-y-2 mt-3 max-h-48 overflow-y-auto">
                  {hostRatings.map(r => (
                    <div key={r.id} className="bg-secondary/50 rounded-lg p-3 text-sm">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium text-textPrimary">{r.rater?.name || 'Player'}</span>
                        <span className="text-amber-500 font-semibold">★ {((r.punctuality + r.skillMatch + r.friendliness) / 3).toFixed(1)}</span>
                      </div>
                      {r.reviewText && <p className="text-textSecondary text-xs">{r.reviewText}</p>}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Joining Ratings — ratings received when you joined others' games */}
            <Card title="Joining Ratings & Reviews" icon={FiStar}>
              <div className="space-y-1 mb-3">
                <StatRow label="Avg Joining Rating" value={
                  participantRatings.length > 0
                    ? `${(participantRatings.reduce((s, r) => s + (r.punctuality + r.skillMatch + r.friendliness) / 3, 0) / participantRatings.length).toFixed(1)} / 5.0`
                    : 'No joining ratings yet'
                } />
                <StatRow label="Total Reviews" value={String(participantRatings.length)} />
              </div>
              {participantRatings.length > 0 && (
                <div className="space-y-2 mt-3 max-h-48 overflow-y-auto">
                  {participantRatings.map(r => (
                    <div key={r.id} className="bg-secondary/50 rounded-lg p-3 text-sm">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium text-textPrimary">{r.rater?.name || 'Host'}</span>
                        <span className="text-amber-500 font-semibold">★ {((r.punctuality + r.skillMatch + r.friendliness) / 3).toFixed(1)}</span>
                      </div>
                      {r.reviewText && <p className="text-textSecondary text-xs">{r.reviewText}</p>}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Overall Stats */}
            <Card title="Overall Statistics" icon={FiStar}>
              <div className="space-y-1">
                <StatRow label="Overall Rating" value={backendUser?.averageRating ? `${backendUser.averageRating} / 5.0` : 'No ratings yet'} />
                <StatRow label="Total Games Played" value={String(backendUser?.totalGamesPlayed || 0)} />
                <StatRow label="No-Shows" value={String(backendUser?.noShowCount || 0)} />
                <StatRow label="Play Again %" value={backendUser?.playAgainPercentage ? `${backendUser.playAgainPercentage}%` : '0%'} highlight />
              </div>
            </Card>

            {/* Activity */}
            <Card title="Activity & Reliability" icon={FiActivity}>
              <div className="space-y-1">
                <StatRow label="Games Created" value={String(backendUser?.gamesCreated || 0)} />
                <StatRow label="Games Cancelled" value={String(backendUser?.gamesCancelled || 0)} />
                <StatRow label="Last Minute Cancels" value={String(backendUser?.lastMinuteCancellations || 0)} />
                <StatRow label="Host Reliability" value={backendUser?.hostReliabilityScore ? `${backendUser.hostReliabilityScore}%` : '100%'} highlight />
                <StatRow label="Account Status" value={backendUser?.isActive ? 'Active' : 'Inactive'} />
              </div>
            </Card>
          </div>
          <motion.div variants={fadeUp} className="flex justify-end">
            <button onClick={handleSaveProfile} disabled={isSaving} className="btn-primary px-6 py-3 text-lg">
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </motion.div>
        </motion.div>
      </div>

      {/* OTP Modals */}
      <AnimatePresence>
        {showEmailOtp && user && (
          <EmailOtpModal
            email={user.email!}
            name={backendUser?.name || user.displayName || user.email?.split('@')[0] || 'Player'}
            firebaseUid={user.uid}
            onVerified={async () => { 
              setShowEmailOtp(false)
              // Add a small delay to ensure backend has processed the verification
              setTimeout(async () => {
                await refreshBackendUser()
              }, 500)
            }}
            onClose={() => setShowEmailOtp(false)}
          />
        )}
        {/* Phone verification removed */}
      </AnimatePresence>
    </>
  )
}
