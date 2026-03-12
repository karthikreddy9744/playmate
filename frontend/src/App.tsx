import { Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { useState, useEffect, lazy, Suspense } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { HiOutlineMenu, HiOutlineX } from 'react-icons/hi'
import { FiLogOut, FiDownload, FiWifiOff, FiRefreshCw, FiMessageCircle, FiBell } from 'react-icons/fi'
import { useAuth } from './hooks/useAuth'
import { usePWA } from './hooks/usePWA'
import { auth } from './lib/firebase'
import { clearToken, api } from './lib/api'
import { markLoggedOut } from './hooks/useAuth'

/* ─── Lazy-loaded pages (code-split per route) ─── */
const Home = lazy(() => import('./pages/Home'))
const Games = lazy(() => import('./pages/Games'))
const CreateGame = lazy(() => import('./pages/CreateGame'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const ManageUsers = lazy(() => import('./pages/ManageUsers'))
const ViewGames = lazy(() => import('./pages/ViewGames'))
const Profile = lazy(() => import('./pages/Profile'))
const Messages = lazy(() => import('./pages/Messages'))
const HostRequests = lazy(() => import('./pages/HostRequests'))

/* ─── Route Guards ─── */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role !== 'admin') return <Navigate to="/" replace />
  return <>{children}</>
}

/* ─── 404 Page ─── */
function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <span className="text-7xl mb-4">🔍</span>
      <h1 className="text-4xl font-bold text-textPrimary mb-2">Page Not Found</h1>
      <p className="text-textSecondary mb-6">The page you're looking for doesn't exist or has been moved.</p>
      <Link to="/" className="btn-primary px-6 py-3">Go Home</Link>
    </div>
  )
}

/* ─── Page loading spinner ─── */
function PageLoader() {
  return (
    <div className="flex items-center justify-center py-32">
      <div className="w-10 h-10 border-[3px] border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.15, ease: 'easeOut' as const } },
  exit:    { opacity: 0, transition: { duration: 0.08 } },
}

export default function App() {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, isAuthenticated, loading, backendUserId: cachedBackendUserId } = useAuth()
  const { canInstall, isOnline, needsUpdate, promptInstall, updateApp } = usePWA()
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [backendUserId, setBackendUserId] = useState<number | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifCount, setNotifCount] = useState(0)
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotifPanel, setShowNotifPanel] = useState(false)

  // Close menus on route change
  useEffect(() => { setMobileOpen(false); setShowNotifPanel(false) }, [location.pathname])

  // Fetch backend user ID once authenticated
  useEffect(() => {
    if (user?.uid) {
      api.get(`/users/firebase/${user.uid}`).then(r => setBackendUserId(r.data.id)).catch(() => {
        if (cachedBackendUserId) setBackendUserId(cachedBackendUserId)
      })
    } else if (cachedBackendUserId) {
      setBackendUserId(cachedBackendUserId)
    } else {
      setBackendUserId(null)
      setUnreadCount(0)
    }
  }, [user?.uid, cachedBackendUserId])

  // Poll unread message count
  useEffect(() => {
    const token = localStorage.getItem('playmate_token')
    if (!backendUserId || !token) { setUnreadCount(0); return }
    const fetch = () => api.get(`/messages/unread-count/${backendUserId}`).then(r => setUnreadCount(r.data.count || 0)).catch(() => {})
    fetch()
    const interval = setInterval(fetch, 30000)
    return () => clearInterval(interval)
  }, [backendUserId])

  // Poll notification unread count
  useEffect(() => {
    const token = localStorage.getItem('playmate_token')
    if (!backendUserId || !token) { setNotifCount(0); return }
    const fetchCount = () => api.get(`/notifications/user/${backendUserId}/unread-count`).then(r => setNotifCount(r.data.count || 0)).catch(() => {})
    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => clearInterval(interval)
  }, [backendUserId])

  // Fetch notifications when panel opens
  useEffect(() => {
    if (showNotifPanel && backendUserId) {
      api.get(`/notifications/user/${backendUserId}`).then(r => setNotifications(r.data || [])).catch(() => {})
    }
  }, [showNotifPanel, backendUserId])

  const markNotifRead = async (id: number) => {
    await api.put(`/notifications/${id}/read`).catch(() => {})
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
    setNotifCount(prev => Math.max(0, prev - 1))
  }

  const markAllNotifRead = async () => {
    if (!backendUserId) return
    await api.put(`/notifications/user/${backendUserId}/read-all`).catch(() => {})
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    setNotifCount(0)
  }

  // Show install banner after a short delay (only if installable)
  useEffect(() => {
    if (canInstall) {
      const timer = setTimeout(() => setShowInstallBanner(true), 5000)
      return () => clearTimeout(timer)
    }
    setShowInstallBanner(false)
  }, [canInstall])

  const navigate = useNavigate()

  const handleLogout = async () => {
    markLoggedOut()
    clearToken()
    auth.signOut().catch(console.error) // Fire and forget
    toast.success('Logged out!')
    setMobileOpen(false)
    setShowNotifPanel(false)
    navigate('/login', { replace: true })
  }

  const navLinks = [
    { to: '/', label: 'Home', badge: 0 },
    { to: '/games', label: 'Games', badge: 0 },
    ...(isAuthenticated ? [{ to: '/create', label: 'Create', badge: 0 }] : []),
    ...(isAuthenticated ? [{ to: '/messages', label: 'Messages', badge: unreadCount }] : []),
    ...(isAuthenticated ? [{ to: '/host/requests', label: 'Requests', badge: 0 }] : []),
    ...(isAuthenticated && user?.role === 'admin' ? [{ to: '/admin', label: 'Admin', badge: 0 }] : []),
    ...(isAuthenticated ? [{ to: '/profile', label: 'Profile', badge: 0 }] : []),
  ]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-10 h-10 border-[3px] border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* ─── Navbar ─── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <span className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center text-white font-black text-lg shadow-glow group-hover:scale-105 transition-transform">P</span>
            <span className="text-xl font-bold text-dark tracking-tight">Play<span className="text-accent">Mate</span></span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(l => (
              <Link key={l.to} to={l.to}
                className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === l.to
                    ? 'bg-accentLight text-accentDark'
                    : 'text-textSecondary hover:text-textPrimary hover:bg-surfaceAlt'
                }`}>
                {l.to === '/messages' ? (
                  <span className="flex items-center gap-1.5">
                    <FiMessageCircle className="w-4 h-4" />
                    {l.label}
                    {l.badge > 0 && (
                      <span className="bg-accent text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">{l.badge > 99 ? '99+' : l.badge}</span>
                    )}
                  </span>
                ) : l.label}
              </Link>
            ))}
          </nav>

          {/* Desktop Auth */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated && (
              <div className="relative">
                <button
                  onClick={() => setShowNotifPanel(!showNotifPanel)}
                  className="relative p-2 rounded-lg hover:bg-surfaceAlt transition-colors text-textSecondary hover:text-textPrimary"
                >
                  <FiBell className="w-5 h-5" />
                  {notifCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
                      {notifCount > 9 ? '9+' : notifCount}
                    </span>
                  )}
                </button>
                {/* Notification Dropdown */}
                {showNotifPanel && (
                  <div className="absolute right-0 top-12 w-80 max-h-96 overflow-y-auto bg-white border border-border rounded-2xl shadow-elevated z-50">
                    <div className="sticky top-0 bg-white border-b border-border px-4 py-3 flex items-center justify-between">
                      <h3 className="font-semibold text-textPrimary text-sm">Notifications</h3>
                      {notifCount > 0 && (
                        <button onClick={markAllNotifRead} className="text-xs text-accent hover:underline">Mark all read</button>
                      )}
                    </div>
                    {notifications.length === 0 ? (
                      <p className="text-textSecondary text-sm text-center py-8">No notifications yet</p>
                    ) : (
                      <div className="divide-y divide-border">
                        {notifications.slice(0, 30).map((n: any) => (
                          <div key={n.id}
                            onClick={() => !n.isRead && markNotifRead(n.id)}
                            className={`px-4 py-3 cursor-pointer transition-colors ${n.isRead ? 'bg-white' : 'bg-accent/5 hover:bg-accent/10'}`}
                          >
                            <div className="flex items-start gap-2">
                              {!n.isRead && <span className="w-2 h-2 rounded-full bg-accent mt-1.5 flex-shrink-0" />}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-textPrimary truncate">{n.title}</p>
                                {n.message && <p className="text-xs text-textSecondary mt-0.5 line-clamp-2">{n.message}</p>}
                                <p className="text-[10px] text-textSecondary mt-1">{n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {isAuthenticated ? (
              <button onClick={handleLogout} className="btn-ghost gap-2 text-sm">
                <FiLogOut className="w-4 h-4" /> Logout
              </button>
            ) : (
              <>
                <Link to="/login" className="btn-ghost text-sm">Login</Link>
                <Link to="/register" className="btn-primary text-sm !py-2 !px-5">Register</Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button className="md:hidden p-2 rounded-lg hover:bg-surfaceAlt transition-colors" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <HiOutlineX className="w-6 h-6 text-textPrimary" /> : <HiOutlineMenu className="w-6 h-6 text-textPrimary" />}
          </button>
        </div>
      </header>

      {/* ─── Mobile Menu ─── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-b border-border overflow-hidden z-40"
          >
            <nav className="px-4 py-4 flex flex-col gap-1">
              {navLinks.map(l => (
                <Link key={l.to} to={l.to} onClick={() => setMobileOpen(false)}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors flex items-center justify-between ${
                    location.pathname === l.to ? 'bg-accentLight text-accentDark' : 'text-textSecondary hover:bg-surfaceAlt'
                  }`}>
                  <span className="flex items-center gap-2">
                    {l.to === '/messages' && <FiMessageCircle className="w-4 h-4" />}
                    {l.label}
                  </span>
                  {l.badge > 0 && (
                    <span className="bg-accent text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">{l.badge > 99 ? '99+' : l.badge}</span>
                  )}
                </Link>
              ))}
              <div className="border-t border-border mt-2 pt-3 flex flex-col gap-2">
                {isAuthenticated ? (
                  <button onClick={handleLogout} className="btn-ghost justify-center gap-2"><FiLogOut className="w-4 h-4" /> Logout</button>
                ) : (
                  <>
                    <Link to="/login" onClick={() => setMobileOpen(false)} className="btn-ghost justify-center">Login</Link>
                    <Link to="/register" onClick={() => setMobileOpen(false)} className="btn-primary justify-center text-sm">Register</Link>
                  </>
                )}
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Page Content ─── */}
      <main className="flex-1">
        <Suspense fallback={<PageLoader />}>
          <AnimatePresence mode="popLayout">
            <motion.div key={location.pathname} variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <Routes location={location}>
                <Route path="/" element={<Home />} />
                <Route path="/games" element={<Games />} />
                <Route path="/create" element={<ProtectedRoute><CreateGame /></ProtectedRoute>} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
                <Route path="/host/requests" element={<ProtectedRoute><HostRequests /></ProtectedRoute>} />
                <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                <Route path="/admin/users" element={<AdminRoute><ManageUsers /></AdminRoute>} />
                <Route path="/admin/games" element={<AdminRoute><ViewGames /></AdminRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </Suspense>
      </main>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border bg-surface">
        <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <Link to="/" className="flex items-center gap-2 mb-3">
              <span className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-white font-black text-sm">P</span>
              <span className="text-lg font-bold text-dark">PlayMate</span>
            </Link>
            <p className="text-textSecondary text-sm leading-relaxed">
              Discover nearby sports games, post your own matches, and build your local sports community.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-textPrimary mb-3 text-sm uppercase tracking-wider">Quick Links</h4>
            <div className="flex flex-col gap-2">
              <Link to="/games" className="text-sm text-textSecondary hover:text-accent transition-colors">Games</Link>
              {isAuthenticated && <Link to="/create" className="text-sm text-textSecondary hover:text-accent transition-colors">Create</Link>}
              {isAuthenticated && <Link to="/profile" className="text-sm text-textSecondary hover:text-accent transition-colors">Profile</Link>}
              {!isAuthenticated && <Link to="/login" className="text-sm text-textSecondary hover:text-accent transition-colors">Login</Link>}
              {!isAuthenticated && <Link to="/register" className="text-sm text-textSecondary hover:text-accent transition-colors">Register</Link>}
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-textPrimary mb-3 text-sm uppercase tracking-wider">Contact</h4>
            <p className="text-sm text-textSecondary">playmate2official@gmail.com</p>
            <p className="text-sm text-textSecondary mt-1">Built with passion for sports.</p>
          </div>
        </div>
        <div className="border-t border-border">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <p className="text-textSecondary text-xs text-center">&copy; {new Date().getFullYear()} PlayMate. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <ToastContainer position="top-right" autoClose={3000} hideProgressBar newestOnTop closeOnClick pauseOnHover theme="light" toastClassName="!rounded-xl !shadow-card" />

      {/* ─── Offline Indicator ─── */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] bg-amber-500 text-white px-5 py-3 rounded-2xl shadow-elevated flex items-center gap-3 text-sm font-medium"
          >
            <FiWifiOff className="w-5 h-5 flex-shrink-0" />
            <span>You're offline — some features may be limited</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── App Update Banner ─── */}
      <AnimatePresence>
        {needsUpdate && (
          <motion.div
            initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -60, opacity: 0 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] bg-accent text-white px-5 py-3 rounded-2xl shadow-elevated flex items-center gap-3 text-sm font-medium"
          >
            <FiRefreshCw className="w-5 h-5 flex-shrink-0" />
            <span>A new version is available!</span>
            <button onClick={updateApp} className="ml-2 bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition-colors font-semibold">
              Update
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Install PWA Banner ─── */}
      <AnimatePresence>
        {showInstallBanner && canInstall && (
          <motion.div
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-[100] bg-white border border-border rounded-2xl shadow-elevated p-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center text-white font-black text-xl flex-shrink-0">P</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-textPrimary text-sm">Install PlayMate</p>
                <p className="text-textSecondary text-xs mt-0.5">Add to your home screen for the best experience — works offline!</p>
              </div>
              <button onClick={() => setShowInstallBanner(false)} className="text-textSecondary hover:text-textPrimary p-1 flex-shrink-0">
                <HiOutlineX className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setShowInstallBanner(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-textSecondary hover:text-textPrimary rounded-xl hover:bg-surfaceAlt transition-colors"
              >
                Not now
              </button>
              <button
                onClick={async () => { await promptInstall(); setShowInstallBanner(false); }}
                className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-accent hover:bg-accentDark rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <FiDownload className="w-4 h-4" /> Install
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
