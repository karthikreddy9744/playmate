import React, { useEffect, useState, useCallback, useRef, memo, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, Tooltip,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts'
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps'
import {
  FiUsers, FiActivity, FiCheckCircle, FiXCircle, FiSmile, FiTrendingUp,
  FiRefreshCw, FiMap, FiAward, FiAlertCircle, FiDollarSign,
  FiMessageSquare, FiShield, FiClock, FiDownload, FiServer, FiTarget,
  FiUserX, FiStar, FiZap, FiCalendar
} from 'react-icons/fi'
import { api } from '../lib/api'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

// ── India GeoJSON (local) ───────────────────────────────────────────────────────
const INDIA_GEO = '/india-states.geojson'

// City → State mapping for choropleth (values must match st_nm in GeoJSON exactly)
const CITY_TO_STATE: Record<string, string> = {
  // Maharashtra
  Mumbai: 'Maharashtra', Pune: 'Maharashtra', Nagpur: 'Maharashtra', Nashik: 'Maharashtra',
  Thane: 'Maharashtra', Aurangabad: 'Maharashtra', Solapur: 'Maharashtra', Kolhapur: 'Maharashtra',
  'Navi Mumbai': 'Maharashtra',
  // Delhi
  Delhi: 'Delhi', 'New Delhi': 'Delhi',
  // Karnataka
  Bangalore: 'Karnataka', Bengaluru: 'Karnataka', Mysore: 'Karnataka', Mysuru: 'Karnataka',
  Mangalore: 'Karnataka', Mangaluru: 'Karnataka', Hubli: 'Karnataka', Dharwad: 'Karnataka',
  // Tamil Nadu
  Chennai: 'Tamil Nadu', Coimbatore: 'Tamil Nadu', Madurai: 'Tamil Nadu', Salem: 'Tamil Nadu',
  Tiruchirappalli: 'Tamil Nadu', Tirunelveli: 'Tamil Nadu', Vellore: 'Tamil Nadu',
  // Telangana
  Hyderabad: 'Telangana', Secunderabad: 'Telangana', Warangal: 'Telangana', Karimnagar: 'Telangana',
  // Andhra Pradesh
  Visakhapatnam: 'Andhra Pradesh', Vijayawada: 'Andhra Pradesh', Guntur: 'Andhra Pradesh',
  Tirupati: 'Andhra Pradesh', Nellore: 'Andhra Pradesh', Kakinada: 'Andhra Pradesh',
  Amaravati: 'Andhra Pradesh', Vizag: 'Andhra Pradesh',
  // West Bengal
  Kolkata: 'West Bengal', Howrah: 'West Bengal', Durgapur: 'West Bengal', Siliguri: 'West Bengal',
  Asansol: 'West Bengal',
  // Gujarat
  Ahmedabad: 'Gujarat', Surat: 'Gujarat', Vadodara: 'Gujarat', Rajkot: 'Gujarat',
  Gandhinagar: 'Gujarat', Bhavnagar: 'Gujarat',
  // Rajasthan
  Jaipur: 'Rajasthan', Jodhpur: 'Rajasthan', Udaipur: 'Rajasthan', Kota: 'Rajasthan',
  Ajmer: 'Rajasthan', Bikaner: 'Rajasthan',
  // Uttar Pradesh
  Lucknow: 'Uttar Pradesh', Kanpur: 'Uttar Pradesh', Agra: 'Uttar Pradesh', Varanasi: 'Uttar Pradesh',
  Noida: 'Uttar Pradesh', Prayagraj: 'Uttar Pradesh', Allahabad: 'Uttar Pradesh',
  Ghaziabad: 'Uttar Pradesh', Meerut: 'Uttar Pradesh', Aligarh: 'Uttar Pradesh',
  'Greater Noida': 'Uttar Pradesh',
  // Madhya Pradesh
  Bhopal: 'Madhya Pradesh', Indore: 'Madhya Pradesh', Jabalpur: 'Madhya Pradesh',
  Gwalior: 'Madhya Pradesh', Ujjain: 'Madhya Pradesh',
  // Bihar
  Patna: 'Bihar', Gaya: 'Bihar', Muzaffarpur: 'Bihar', Bhagalpur: 'Bihar',
  // Haryana
  Gurgaon: 'Haryana', Gurugram: 'Haryana', Faridabad: 'Haryana', Panipat: 'Haryana',
  Karnal: 'Haryana', Ambala: 'Haryana', Rohtak: 'Haryana', Hisar: 'Haryana',
  // Punjab
  Ludhiana: 'Punjab', Amritsar: 'Punjab', Jalandhar: 'Punjab', Patiala: 'Punjab',
  Mohali: 'Punjab', Bathinda: 'Punjab',
  // Chandigarh
  Chandigarh: 'Chandigarh',
  // Odisha
  Bhubaneswar: 'Odisha', Cuttack: 'Odisha', Rourkela: 'Odisha',
  // Assam
  Guwahati: 'Assam', Dibrugarh: 'Assam', Jorhat: 'Assam',
  // Kerala
  Thiruvananthapuram: 'Kerala', Kochi: 'Kerala', Kozhikode: 'Kerala', Thrissur: 'Kerala',
  Ernakulam: 'Kerala', Trivandrum: 'Kerala', Calicut: 'Kerala',
  // Jharkhand
  Ranchi: 'Jharkhand', Jamshedpur: 'Jharkhand', Dhanbad: 'Jharkhand', Bokaro: 'Jharkhand',
  // Chhattisgarh
  Raipur: 'Chhattisgarh', Bilaspur: 'Chhattisgarh', Durg: 'Chhattisgarh',
  // Uttarakhand
  Dehradun: 'Uttarakhand', Haridwar: 'Uttarakhand', Rishikesh: 'Uttarakhand',
  Haldwani: 'Uttarakhand',
  // Himachal Pradesh
  Shimla: 'Himachal Pradesh', Manali: 'Himachal Pradesh', Dharamshala: 'Himachal Pradesh',
  // Jammu and Kashmir
  Srinagar: 'Jammu and Kashmir', Jammu: 'Jammu and Kashmir',
  // Ladakh
  Leh: 'Ladakh',
  // Goa
  Goa: 'Goa', Panaji: 'Goa', Margao: 'Goa', Vasco: 'Goa',
  // Meghalaya
  Shillong: 'Meghalaya',
  // Manipur
  Imphal: 'Manipur',
  // Nagaland
  Kohima: 'Nagaland', Dimapur: 'Nagaland',
  // Tripura
  Agartala: 'Tripura',
  // Mizoram
  Aizawl: 'Mizoram',
  // Arunachal Pradesh
  Itanagar: 'Arunachal Pradesh',
  // Sikkim
  Gangtok: 'Sikkim',
  // Puducherry
  Puducherry: 'Puducherry', Pondicherry: 'Puducherry',
  Unknown: '',
}

// Color scale: low → high = light-green → deep-green
const getMapColor = (value: number, max: number) => {
  if (!value || max === 0) return '#e2faf1'
  const intensity = Math.min(value / max, 1)
  const r = Math.round(229 - intensity * 190)
  const g = Math.round(250 - intensity * 100)
  const b = Math.round(233 - intensity * 170)
  return `rgb(${r},${g},${b})`
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface KPI { totalUsers: number; newUsersToday: number; weeklyGrowthRate: number }
interface GameStats { totalGames: number; upcomingGames: number; liveGames: number; completedGames: number; cancelledGames: number }
interface Lifecycle { upcoming: number; live: number; completed: number; cancelled: number; full: number; completionRate: number; cancellationRate: number; funnel: { name: string; value: number }[] }
interface AreaRow { city: string; total: number; active: number; completed: number; cancelled: number; players: number }
interface Sentiment { totalRatings: number; averageScore: number; positive: number; neutral: number; negative: number; positiveRate: number }
interface Retention { dau: number; wau: number; mau: number; dauRate: number; wauRate: number; mauRate: number; weeklyGrowthRate: number }
interface TrendPoint { date: string; games: number }
interface SportLifecycle { sport: string; cancelled: number; active: number; total: number }
interface ActivityItem { id: number; user: string; action: string; sport: string; city: string; time: string }

// New types for extra features
interface RequestStats { totalRequests: number; accepted: number; rejected: number; pending: number; acceptanceRate: number; rejectionRate: number; avgResponseMinutes: number }
interface MessagingStats { totalMessages: number; dmConversations: number; groupChats: number; unreadMessages: number }
interface LeaderboardEntry { userId: number; name: string; gamesHosted?: number; gamesPlayed?: number; avgRating: number; city?: string; hostReliability?: number; playAgainPercentage?: number }
interface NoShowEntry { userId: number; name: string; noShows: number; gamesPlayed: number; noShowRate: number }
interface VerificationStats { totalUsers: number; emailVerified: number; emailUnverified: number; idVerified: number; idUnverified: number; fullyVerified: number; emailVerifiedRate: number; idVerifiedRate: number }
interface CancellationEntry { userId: number; name: string; cancelled: number; lastMinute: number; reliability: number }
interface GhostingStats { totalReports: number; conductedCount: number; ghostedCount: number; trustRate: number }
interface PeakHourCell { day: string; hour: number; count: number }
interface FillRateStats { avgFillRate: number; totalGames: number; fullyFilled: number; halfFilled: number; lowFill: number }
interface SystemHealth { dbStatus: string; redisStatus: string; jvmTotalMemoryMB: number; jvmFreeMemoryMB: number; jvmUsedMemoryMB: number; jvmMaxMemoryMB: number; availableProcessors: number; totalUsers: number; totalGames: number; totalMessages: number; totalRatings: number; totalRequests: number }

// ── KPI Card ──────────────────────────────────────────────────────────────────
const KPICard = ({ icon: Icon, label, value, sub, color, trend }: {
  icon: React.FC<any>; label: string; value: string | number; sub?: string; color: string; trend?: number
}) => (
  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
    className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-start gap-4">
    <div className={`p-3 rounded-xl ${color}`}>
      <Icon className="w-5 h-5 text-white" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
    {trend !== undefined && (
      <div className={`text-xs font-semibold px-2 py-0.5 rounded-full ${trend >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
        {trend >= 0 ? '+' : ''}{trend}%
      </div>
    )}
  </motion.div>
)

// ── Section heading ───────────────────────────────────────────────────────────
const SectionHeading = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-base font-bold text-gray-800 mb-4">{children}</h2>
)

// ── Charts Colours ────────────────────────────────────────────────────────────
const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']
const LIFECYCLE_COLORS: Record<string, string> = {
  Upcoming: '#3B82F6', Live: '#10B981', Completed: '#6B7280', Cancelled: '#EF4444', Full: '#F59E0B'
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [userStats,    setUserStats]    = useState<KPI | null>(null)
  const [gameStats,    setGameStats]    = useState<GameStats | null>(null)
  const [lifecycle,    setLifecycle]    = useState<Lifecycle | null>(null)
  const [areaData,     setAreaData]     = useState<AreaRow[]>([])
  const [sentiment,    setSentiment]    = useState<Sentiment | null>(null)
  const [retention,    setRetention]    = useState<Retention | null>(null)
  const [trend,        setTrend]        = useState<TrendPoint[]>([])
  const [sportLife,    setSportLife]    = useState<SportLifecycle[]>([])
  const [activity,     setActivity]     = useState<ActivityItem[]>([])
  const [sportDist,    setSportDist]    = useState<{ name: string; value: number }[]>([])
  const [revenue,       setRevenue]      = useState<{ month: string; revenue: number }[]>([])
  const [requestStats,  setRequestStats] = useState<RequestStats | null>(null)
  const [msgStats,      setMsgStats]     = useState<MessagingStats | null>(null)
  const [hostBoard,     setHostBoard]    = useState<LeaderboardEntry[]>([])
  const [playerBoard,   setPlayerBoard]  = useState<LeaderboardEntry[]>([])
  const [noShows,       setNoShows]      = useState<NoShowEntry[]>([])
  const [cancellations, setCancellations] = useState<CancellationEntry[]>([])
  const [ghosting,      setGhosting]     = useState<GhostingStats | null>(null)
  const [verification,  setVerification] = useState<VerificationStats | null>(null)
  const [peakHours,     setPeakHours]    = useState<PeakHourCell[]>([])
  const [fillRate,      setFillRate]     = useState<FillRateStats | null>(null)
  const [sysHealth,     setSysHealth]    = useState<SystemHealth | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [lastRefresh,  setLastRefresh]  = useState(new Date())
  const tooltipRef = useRef<HTMLDivElement>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const [areaSort,     setAreaSort]     = useState<keyof AreaRow>('total')

  // Prevent page scroll when wheeling over the map so ZoomableGroup zoom works
  useEffect(() => {
    const el = mapContainerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => e.preventDefault()
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [loading])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [uStats, gStats, lc, area, sent, ret, tr, sLife, act, sDist, rev,
             reqStats, mStats, hBoard, pBoard, noShow, cancl, ghost, verif, peak, fill, health] = await Promise.all([
        api.get('/admin/stats/users'),
        api.get('/admin/stats/games'),
        api.get('/admin/stats/lifecycle'),
        api.get('/admin/stats/area'),
        api.get('/admin/stats/sentiment'),
        api.get('/admin/stats/retention'),
        api.get('/admin/stats/trend'),
        api.get('/admin/stats/sport-lifecycle'),
        api.get('/admin/activity/recent'),
        api.get('/admin/stats/sport-distribution'),
        api.get('/admin/stats/revenue'),
        api.get('/admin/stats/requests'),
        api.get('/admin/stats/messaging'),
        api.get('/admin/stats/host-leaderboard'),
        api.get('/admin/stats/player-leaderboard'),
        api.get('/admin/stats/no-shows'),
        api.get('/admin/stats/cancellations'),
        api.get('/admin/stats/ghosting'),
        api.get('/admin/stats/verification'),
        api.get('/admin/stats/peak-hours'),
        api.get('/admin/stats/fill-rate'),
        api.get('/admin/stats/system-health'),
      ])
      setUserStats(uStats.data)
      setGameStats(gStats.data)
      setLifecycle(lc.data)
      setAreaData(area.data)
      setSentiment(sent.data)
      setRetention(ret.data)
      setTrend(tr.data)
      setSportLife(sLife.data)
      setActivity(act.data)
      setSportDist(sDist.data)
      setRevenue(rev.data)
      setRequestStats(reqStats.data)
      setMsgStats(mStats.data)
      setHostBoard(hBoard.data)
      setPlayerBoard(pBoard.data)
      setNoShows(noShow.data)
      setCancellations(cancl.data)
      setGhosting(ghost.data)
      setVerification(verif.data)
      setPeakHours(peak.data)
      setFillRate(fill.data)
      setSysHealth(health.data)
      setLastRefresh(new Date())
    } catch (e: any) {
      console.error('Admin fetch error', e)
      setError(e?.response?.data?.message || 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Build state-level game count from area data
  const stateGameCount: Record<string, number> = {}
  areaData.forEach(row => {
    const state = CITY_TO_STATE[row.city]
    if (state) stateGameCount[state] = (stateGameCount[state] || 0) + row.total
  })
  const maxStateGames = Math.max(...Object.values(stateGameCount), 1)

  const sortedArea = [...areaData].sort((a, b) => (b[areaSort] as number) - (a[areaSort] as number))

  const sentimentPie = sentiment
    ? [
        { name: 'Positive 😊', value: sentiment.positive, color: '#10B981' },
        { name: 'Neutral 😐',  value: sentiment.neutral,  color: '#F59E0B' },
        { name: 'Negative 😞', value: sentiment.negative, color: '#EF4444' },
      ].filter(d => d.value > 0)
    : []

  // Peak hours heatmap max for color scale
  const peakMax = Math.max(...peakHours.map(c => c.count), 1)
  const getHeatColor = (count: number) => {
    if (count === 0) return '#f3f4f6'
    const intensity = Math.min(count / peakMax, 1)
    const r = Math.round(243 - intensity * 204)
    const g = Math.round(244 - intensity * 111)
    const b = Math.round(246 - intensity * 191)
    return `rgb(${r},${g},${b})`
  }

  // Verification pie data
  const verificationPie = verification ? [
    { name: 'Fully Verified', value: verification.fullyVerified, color: '#10B981' },
    { name: 'Email Only', value: verification.emailVerified - verification.fullyVerified, color: '#3B82F6' },
    { name: 'Unverified', value: verification.emailUnverified, color: '#EF4444' },
  ].filter(d => d.value > 0) : []

  // Fill rate pie data
  const fillPie = fillRate ? [
    { name: 'Full', value: fillRate.fullyFilled, color: '#10B981' },
    { name: '50-99%', value: fillRate.halfFilled, color: '#F59E0B' },
    { name: '<50%', value: fillRate.lowFill, color: '#EF4444' },
  ].filter(d => d.value > 0) : []

  // CSV export helper
  const exportCSV = (data: any[], filename: string) => {
    if (!data.length) return
    const keys = Object.keys(data[0])
    const csv = [keys.join(','), ...data.map(row => keys.map(k => JSON.stringify(row[k] ?? '')).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${filename}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Loading analytics…</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-sm">
        <FiAlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <p className="text-gray-700 font-medium mb-1">Failed to load dashboard</p>
        <p className="text-gray-500 text-sm mb-4">{error}</p>
        <button onClick={fetchAll} className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-xl hover:bg-emerald-700 transition-colors">
          <FiRefreshCw className="w-4 h-4 inline mr-1" /> Retry
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Last updated: {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => {
              const allData = [
                ...areaData.map(r => ({ type: 'area', ...r })),
                ...hostBoard.map(r => ({ type: 'host', ...r })),
                ...playerBoard.map(r => ({ type: 'player', ...r })),
                ...noShows.map(r => ({ type: 'noShow', ...r })),
              ]
              exportCSV(allData, `playmate-admin-export-${new Date().toISOString().slice(0,10)}`)
            }}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-700 font-medium transition-colors">
              <FiDownload className="w-4 h-4" /> Export CSV
            </button>
            <button onClick={fetchAll}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-700 font-medium transition-colors">
              <FiRefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button onClick={() => navigate('/admin/users')}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium transition-colors">
              <FiUsers className="w-4 h-4" /> Manage Users
            </button>
          </div>
        </div>

        {/* ── KPI Row ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <KPICard icon={FiUsers}       label="Total Users"      value={userStats?.totalUsers ?? 0}
            sub={`+${userStats?.newUsersToday ?? 0} today`}    color="bg-blue-500"
            trend={userStats ? retention?.weeklyGrowthRate : undefined} />
          <KPICard icon={FiActivity}    label="Active Games"     value={gameStats?.upcomingGames ?? 0}
            sub={`${gameStats?.liveGames ?? 0} live now`}       color="bg-emerald-500" />
          <KPICard icon={FiCheckCircle} label="Completed"        value={gameStats?.completedGames ?? 0}
            sub={`${lifecycle?.completionRate ?? 0}% rate`}     color="bg-violet-500" />
          <KPICard icon={FiXCircle}     label="Cancelled"        value={gameStats?.cancelledGames ?? 0}
            sub={`${lifecycle?.cancellationRate ?? 0}% rate`}   color="bg-red-500" />
          <KPICard icon={FiSmile}       label="Positive Mood"    value={`${sentiment?.positiveRate ?? 0}%`}
            sub={`Avg ${sentiment?.averageScore ?? 0}/5`}        color="bg-amber-500" />
          <KPICard icon={FiTrendingUp}  label="Weekly Growth"    value={`${retention?.weeklyGrowthRate ?? 0}%`}
            sub={`${retention?.wau ?? 0} WAU`}                  color="bg-pink-500"
            trend={retention?.weeklyGrowthRate} />
        </div>

        {/* ── KPI Row 2: Requests + Messaging ──────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <KPICard icon={FiTarget}          label="Join Requests"   value={requestStats?.totalRequests ?? 0}
            sub={`${requestStats?.pending ?? 0} pending`}    color="bg-cyan-500" />
          <KPICard icon={FiCheckCircle}     label="Accept Rate"     value={`${requestStats?.acceptanceRate ?? 0}%`}
            sub={`${requestStats?.accepted ?? 0} accepted`}  color="bg-teal-500" />
          <KPICard icon={FiClock}           label="Avg Response"    value={`${requestStats?.avgResponseMinutes ?? 0}m`}
            sub="response time"                              color="bg-indigo-500" />
          <KPICard icon={FiMessageSquare}   label="Messages"        value={msgStats?.totalMessages ?? 0}
            sub={`${msgStats?.unreadMessages ?? 0} unread`}  color="bg-orange-500" />
          <KPICard icon={FiUsers}           label="DM Convos"       value={msgStats?.dmConversations ?? 0}
            sub={`${msgStats?.groupChats ?? 0} group chats`} color="bg-lime-600" />
          <KPICard icon={FiZap}             label="Fill Rate"       value={`${fillRate?.avgFillRate ?? 0}%`}
            sub={`${fillRate?.fullyFilled ?? 0} fully filled`}  color="bg-fuchsia-500" />
        </div>

        {/* ── Row 1: India Map + Sentiment ──────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

          {/* India Choropleth Map */}
          <div className="xl:col-span-3 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <FiMap className="w-5 h-5 text-emerald-600" />
              <SectionHeading>Game Density by State</SectionHeading>
            </div>
            <p className="text-xs text-gray-400 mb-3">Scroll to zoom · Drag to pan · Hover for details</p>
            <div ref={mapContainerRef} className="relative h-[380px] overflow-hidden rounded-xl bg-sky-50" style={{ touchAction: 'none', overscrollBehavior: 'contain' }}>
              <ComposableMap
                projection="geoMercator"
                projectionConfig={{ center: [82, 22], scale: 900 }}
                style={{ width: '100%', height: '100%' }}
              >
                <ZoomableGroup zoom={1} minZoom={0.8} maxZoom={6}>
                  <Geographies geography={INDIA_GEO}>
                    {({ geographies }: { geographies: any[] }) =>
                      geographies.map((geo: any) => {
                        const stateName = geo.properties.st_nm || ''
                        const count = stateGameCount[stateName] || 0
                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            fill={getMapColor(count, maxStateGames)}
                            stroke="#fff"
                            strokeWidth={0.3}
                            style={{
                              default:  { outline: 'none' },
                              hover:    { outline: 'none', fill: '#6EE7B7', cursor: 'pointer' },
                              pressed:  { outline: 'none' },
                            }}
                            onMouseEnter={(e: React.MouseEvent) => {
                              const tip = tooltipRef.current
                              if (tip) {
                                tip.querySelector('.tip-name')!.textContent = stateName || 'Unknown'
                                tip.querySelector('.tip-games')!.textContent = `${count} game${count !== 1 ? 's' : ''}`
                                tip.style.display = 'block'
                                tip.style.left = `${e.clientX + 12}px`
                                tip.style.top = `${e.clientY - 32}px`
                              }
                            }}
                            onMouseMove={(e: React.MouseEvent) => {
                              const tip = tooltipRef.current
                              if (tip) {
                                tip.style.left = `${e.clientX + 12}px`
                                tip.style.top = `${e.clientY - 32}px`
                              }
                            }}
                            onMouseLeave={() => {
                              const tip = tooltipRef.current
                              if (tip) tip.style.display = 'none'
                            }}
                          />
                        )
                      })
                    }
                  </Geographies>
                </ZoomableGroup>
              </ComposableMap>

              {/* Map tooltip — DOM-driven, no React re-renders */}
              <div ref={tooltipRef} className="fixed z-50 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg pointer-events-none" style={{ display: 'none' }}>
                <p className="tip-name font-semibold"></p>
                <p className="tip-games text-gray-300"></p>
              </div>
            </div>

            {/* Colour legend */}
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs text-gray-400">Low</span>
              <div className="flex-1 h-2 rounded-full" style={{
                background: 'linear-gradient(to right, #e2faf1, #10B981)'
              }} />
              <span className="text-xs text-gray-400">High</span>
            </div>
          </div>

          {/* Sentiment Donut + Retention */}
          <div className="xl:col-span-2 space-y-6">
            {/* Sentiment */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <SectionHeading>Feedback Sentiment</SectionHeading>
              {sentimentPie.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No ratings yet</p>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={160}>
                    <PieChart>
                      <Pie data={sentimentPie} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                        dataKey="value" stroke="none">
                        {sentimentPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => [v, 'Ratings']} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {sentimentPie.map(d => (
                      <div key={d.name} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                        <span className="text-xs text-gray-600">{d.name}</span>
                        <span className="ml-auto text-xs font-semibold text-gray-800">{d.value}</span>
                      </div>
                    ))}
                    <p className="text-xs text-gray-400 pt-1">Avg: {sentiment?.averageScore}/5 ({sentiment?.totalRatings} total)</p>
                  </div>
                </div>
              )}
            </div>

            {/* Retention */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <SectionHeading>User Retention</SectionHeading>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'DAU', value: retention?.dau ?? 0, rate: retention?.dauRate ?? 0, color: 'text-blue-600' },
                  { label: 'WAU', value: retention?.wau ?? 0, rate: retention?.wauRate ?? 0, color: 'text-violet-600' },
                  { label: 'MAU', value: retention?.mau ?? 0, rate: retention?.mauRate ?? 0, color: 'text-emerald-600' },
                ].map(r => (
                  <div key={r.label} className="text-center bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500 font-medium">{r.label}</p>
                    <p className={`text-lg font-bold ${r.color}`}>{r.value}</p>
                    <p className="text-[10px] text-gray-400">{r.rate}%</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Cancellations */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <SectionHeading>Top Cancellers (Hosts)</SectionHeading>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-gray-100">
                    <th className="text-left py-2 text-gray-500 font-medium">Host</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Total</th>
                    <th className="text-right py-2 text-gray-500 font-medium">LastMin</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Score</th>
                  </tr></thead>
                  <tbody>
                    {cancellations.map(c => (
                      <tr key={c.userId} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-2 font-medium text-gray-700">{c.name}</td>
                        <td className="py-2 text-right text-red-600 font-semibold">{c.cancelled}</td>
                        <td className="py-2 text-right text-amber-600">{c.lastMinute}</td>
                        <td className="py-2 text-right">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            c.reliability >= 90 ? 'bg-green-100 text-green-700' : 
                            c.reliability >= 75 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {c.reliability}%
                          </span>
                        </td>
                      </tr>
                    ))}
                    {cancellations.length === 0 && (
                      <tr><td colSpan={4} className="text-center py-4 text-gray-400 italic">No cancellations recorded</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Ghosting & Verification Stats */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <SectionHeading>Trust & Verification (Ghosting)</SectionHeading>
                {ghosting && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    ghosting.trustRate >= 90 ? 'bg-emerald-100 text-emerald-700' :
                    ghosting.trustRate >= 75 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                  }`}>
                    {ghosting.trustRate}% Trust Rate
                  </span>
                )}
              </div>
              
              {!ghosting || ghosting.totalReports === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8 italic">No verification reports yet</p>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                      <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Conducted</p>
                      <p className="text-xl font-black text-emerald-900">{ghosting.conductedCount}</p>
                      <p className="text-[10px] text-emerald-600 mt-0.5">Games verified played</p>
                    </div>
                    <div className="bg-rose-50 rounded-xl p-3 border border-rose-100">
                      <p className="text-[10px] text-rose-700 font-bold uppercase tracking-wider">Ghosted</p>
                      <p className="text-xl font-black text-rose-900">{ghosting.ghostedCount}</p>
                      <p className="text-[10px] text-rose-600 mt-0.5">Reported not played</p>
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t border-gray-50">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-gray-500 font-medium">Platform Trust Index</span>
                      <span className="text-gray-900 font-bold">{ghosting.trustRate}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ${
                          ghosting.trustRate >= 90 ? 'bg-emerald-500' :
                          ghosting.trustRate >= 75 ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${ghosting.trustRate}%` }}
                      />
                    </div>
                    <p className="text-[9px] text-gray-400 mt-2 leading-tight">
                      * Trust rate is calculated based on participant reports of whether games were actually conducted by the host.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Row 2: Lifecycle funnel + 30-day Trend + Revenue ───── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Game Lifecycle */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <SectionHeading>Game Lifecycle</SectionHeading>
            <div className="flex flex-wrap gap-3 mb-4">
              {lifecycle && Object.entries({
                Upcoming: lifecycle.upcoming, Live: lifecycle.live,
                Completed: lifecycle.completed, Cancelled: lifecycle.cancelled,
              }).map(([k, v]) => (
                <span key={k} className="text-xs px-3 py-1 rounded-full font-medium"
                  style={{ background: LIFECYCLE_COLORS[k] + '20', color: LIFECYCLE_COLORS[k] }}>
                  {k}: {v}
                </span>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={lifecycle?.funnel ?? []} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#f0fdf4' }} />
                <Bar dataKey="value" name="Games" radius={[6, 6, 0, 0]}>
                  {(lifecycle?.funnel ?? []).map((entry, i) => (
                    <Cell key={i} fill={LIFECYCLE_COLORS[entry.name] || '#10B981'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 30-day Trend */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <SectionHeading>Game Creation (Last 30 Days)</SectionHeading>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trend} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={4} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="games" name="Games Created"
                  stroke="#10B981" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Revenue */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <SectionHeading>Revenue (₹)</SectionHeading>
            {revenue.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No revenue data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={revenue} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: any) => [`₹${v}`, 'Revenue']} />
                  <Bar dataKey="revenue" name="Revenue" fill="#8B5CF6" radius={[6, 6, 0, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── Row 3: Sport Lifecycle stacked + Area Table ──────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Sport-wise Lifecycle */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <SectionHeading>Sport Distribution</SectionHeading>
            <div className="grid grid-cols-2 gap-4 mb-5">
              {sportDist.slice(0, 6).map((s, i) => (
                <div key={s.name} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                    style={{ background: COLORS[i % COLORS.length] + '20' }}>
                    {['⚽','🏀','🎾','🏸','🏏','🏃'][i] || '🏆'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate">{s.name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-1.5 rounded-full" style={{
                          width: `${(s.value / (sportDist[0]?.value || 1)) * 100}%`,
                          background: COLORS[i % COLORS.length]
                        }} />
                      </div>
                      <span className="text-[10px] text-gray-400 w-5 text-right">{s.value}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {sportLife.length > 0 && (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={sportLife} layout="vertical" barSize={10}>
                  <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="sport" tick={{ fontSize: 10 }} width={70} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="active"    name="Active"    fill="#10B981" stackId="a" radius={[0,0,0,0]} />
                  <Bar dataKey="cancelled" name="Cancelled" fill="#EF4444" stackId="a" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Area Analytics Table */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <SectionHeading>Area Analytics</SectionHeading>
              <select value={areaSort} onChange={e => setAreaSort(e.target.value as keyof AreaRow)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 bg-white">
                <option value="total">Sort by Total</option>
                <option value="players">Sort by Players</option>
                <option value="completed">Sort by Completed</option>
                <option value="cancelled">Sort by Cancelled</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 text-gray-500 font-medium">City</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Total</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Active</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Done</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Cancelled</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Players</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedArea.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-gray-400">No data available</td></tr>
                  ) : sortedArea.slice(0, 10).map(row => (
                    <tr key={row.city} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-2 font-medium text-gray-700">{row.city}</td>
                      <td className="py-2 text-right text-gray-600">{row.total}</td>
                      <td className="py-2 text-right text-emerald-600 font-medium">{row.active}</td>
                      <td className="py-2 text-right text-violet-600">{row.completed}</td>
                      <td className="py-2 text-right text-red-500">{row.cancelled}</td>
                      <td className="py-2 text-right text-blue-600">{row.players}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Row 4: Activity Feed ──────────────────────────────────── */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <SectionHeading>Recent Activity</SectionHeading>
          {activity.length === 0 ? (
            <div className="text-center py-8">
              <FiAlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No recent activity</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {activity.slice(0, 20).map(item => (
                <div key={item.id} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 hover:bg-emerald-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <FiAward className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-800 truncate">{item.user}</p>
                    <p className="text-xs text-gray-500 truncate">{item.action} · {item.sport} in {item.city}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{item.time ? new Date(item.time).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Row 5: Host & Player Leaderboards ─────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Host Leaderboard */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <SectionHeading>Host Leaderboard (Top 10)</SectionHeading>
              <button onClick={() => exportCSV(hostBoard, 'host-leaderboard')} className="text-xs text-gray-400 hover:text-gray-600"><FiDownload className="w-3.5 h-3.5 inline mr-1" />CSV</button>
            </div>
            {hostBoard.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No host data yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-gray-100">
                    <th className="text-left py-2 text-gray-500 font-medium">#</th>
                    <th className="text-left py-2 text-gray-500 font-medium">Name</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Hosted</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Reliability</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Rating</th>
                  </tr></thead>
                  <tbody>
                    {hostBoard.map((h, i) => (
                      <tr key={h.userId} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-2 font-bold text-gray-400">{i + 1}</td>
                        <td className="py-2 font-medium text-gray-700">{h.name}</td>
                        <td className="py-2 text-right text-emerald-600 font-semibold">{h.gamesHosted}</td>
                        <td className="py-2 text-right">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            (h.hostReliability || 0) >= 90 ? 'bg-green-100 text-green-700' : 
                            (h.hostReliability || 0) >= 75 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {h.hostReliability ?? 100}%
                          </span>
                        </td>
                        <td className="py-2 text-right text-amber-600">{h.avgRating > 0 ? `${h.avgRating} ⭐` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Player Leaderboard */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <SectionHeading>Player Leaderboard (Top 10)</SectionHeading>
              <button onClick={() => exportCSV(playerBoard, 'player-leaderboard')} className="text-xs text-gray-400 hover:text-gray-600"><FiDownload className="w-3.5 h-3.5 inline mr-1" />CSV</button>
            </div>
            {playerBoard.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No player data yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-gray-100">
                    <th className="text-left py-2 text-gray-500 font-medium">#</th>
                    <th className="text-left py-2 text-gray-500 font-medium">Name</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Played</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Play Again</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Rating</th>
                  </tr></thead>
                  <tbody>
                    {playerBoard.map((p, i) => (
                      <tr key={p.userId} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-2 font-bold text-gray-400">{i + 1}</td>
                        <td className="py-2 font-medium text-gray-700">{p.name}</td>
                        <td className="py-2 text-right text-blue-600 font-semibold">{p.gamesPlayed}</td>
                        <td className="py-2 text-right">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            (p.playAgainPercentage || 0) >= 80 ? 'bg-emerald-100 text-emerald-700' : 
                            (p.playAgainPercentage || 0) >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {p.playAgainPercentage ?? 0}%
                          </span>
                        </td>
                        <td className="py-2 text-right text-amber-600">{p.avgRating > 0 ? `${p.avgRating} ⭐` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Row 6: No-Show Tracking + Verification + Fill Rate ──── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* No-Show Tracking */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <FiUserX className="w-5 h-5 text-red-500" />
              <SectionHeading>No-Show Tracking</SectionHeading>
            </div>
            {noShows.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No no-shows recorded</p>
            ) : (
              <div className="space-y-2">
                {noShows.slice(0, 8).map((n) => (
                  <div key={n.userId} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                    <div>
                      <p className="text-xs font-medium text-gray-700">{n.name}</p>
                      <p className="text-[10px] text-gray-400">{n.gamesPlayed} games played</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-500">{n.noShows}</p>
                      <p className="text-[10px] text-gray-400">{n.noShowRate}% rate</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Verification Stats */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <FiShield className="w-5 h-5 text-blue-500" />
              <SectionHeading>Verification Stats</SectionHeading>
            </div>
            {verificationPie.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No users yet</p>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={160}>
                  <PieChart>
                    <Pie data={verificationPie} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" stroke="none">
                      {verificationPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {verificationPie.map(d => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                      <span className="text-xs text-gray-600">{d.name}</span>
                      <span className="ml-auto text-xs font-semibold text-gray-800">{d.value}</span>
                    </div>
                  ))}
                  <p className="text-xs text-gray-400 pt-1">Email: {verification?.emailVerifiedRate}% · ID: {verification?.idVerifiedRate}%</p>
                </div>
              </div>
            )}
          </div>

          {/* Fill Rate */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <FiTarget className="w-5 h-5 text-emerald-500" />
              <SectionHeading>Game Fill Rate</SectionHeading>
            </div>
            {fillPie.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No games with slots data</p>
            ) : (
              <>
                <div className="text-center mb-4">
                  <p className="text-3xl font-bold text-emerald-600">{fillRate?.avgFillRate}%</p>
                  <p className="text-xs text-gray-400">average fill rate across {fillRate?.totalGames} games</p>
                </div>
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={120}>
                    <PieChart>
                      <Pie data={fillPie} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value" stroke="none">
                        {fillPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5">
                    {fillPie.map(d => (
                      <div key={d.name} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                        <span className="text-xs text-gray-600">{d.name}</span>
                        <span className="ml-auto text-xs font-semibold text-gray-800">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Row 7: Peak Hours Heatmap ─────────────────────────────── */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <FiClock className="w-5 h-5 text-violet-500" />
            <SectionHeading>Peak Hours Heatmap</SectionHeading>
          </div>
          <p className="text-xs text-gray-400 mb-3">Game scheduling frequency by day & hour (darker = more games)</p>
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              {/* Hour labels */}
              <div className="flex items-center mb-1">
                <div className="w-10" />
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="flex-1 text-center text-[9px] text-gray-400">{h}</div>
                ))}
              </div>
              {/* Rows */}
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <div key={day} className="flex items-center mb-0.5">
                  <div className="w-10 text-[10px] text-gray-500 font-medium">{day}</div>
                  {Array.from({ length: 24 }, (_, h) => {
                    const cell = peakHours.find(c => c.day === day && c.hour === h)
                    const count = cell?.count ?? 0
                    return (
                      <div key={h} className="flex-1 aspect-square mx-px rounded-sm cursor-default group relative"
                        style={{ backgroundColor: getHeatColor(count), minHeight: '16px' }}
                        title={`${day} ${h}:00 — ${count} games`}
                      />
                    )
                  })}
                </div>
              ))}
              {/* Legend */}
              <div className="flex items-center gap-2 mt-3">
                <span className="text-[10px] text-gray-400">Less</span>
                {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
                  <div key={i} className="w-4 h-4 rounded-sm" style={{ backgroundColor: getHeatColor(v * peakMax) }} />
                ))}
                <span className="text-[10px] text-gray-400">More</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Row 8: System Health ──────────────────────────────────── */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <FiServer className="w-5 h-5 text-gray-600" />
            <SectionHeading>System Health</SectionHeading>
          </div>
          {sysHealth ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {/* DB Status */}
              <div className={`text-center p-3 rounded-xl ${sysHealth.dbStatus === 'UP' ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${sysHealth.dbStatus === 'UP' ? 'bg-green-500' : 'bg-red-500'}`} />
                <p className="text-xs font-medium text-gray-700">PostgreSQL</p>
                <p className={`text-xs font-bold ${sysHealth.dbStatus === 'UP' ? 'text-green-600' : 'text-red-600'}`}>{sysHealth.dbStatus}</p>
              </div>
              {/* Redis Status */}
              <div className={`text-center p-3 rounded-xl ${sysHealth.redisStatus === 'UP' ? 'bg-green-50' : sysHealth.redisStatus === 'NOT_CONFIGURED' ? 'bg-gray-50' : 'bg-red-50'}`}>
                <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${sysHealth.redisStatus === 'UP' ? 'bg-green-500' : sysHealth.redisStatus === 'NOT_CONFIGURED' ? 'bg-gray-400' : 'bg-red-500'}`} />
                <p className="text-xs font-medium text-gray-700">Redis</p>
                <p className={`text-xs font-bold ${sysHealth.redisStatus === 'UP' ? 'text-green-600' : 'text-gray-500'}`}>{sysHealth.redisStatus}</p>
              </div>
              {/* JVM Memory */}
              <div className="text-center p-3 rounded-xl bg-blue-50">
                <p className="text-xs text-gray-500">JVM Used</p>
                <p className="text-lg font-bold text-blue-600">{sysHealth.jvmUsedMemoryMB}MB</p>
                <p className="text-[10px] text-gray-400">of {sysHealth.jvmMaxMemoryMB}MB</p>
              </div>
              {/* CPU cores */}
              <div className="text-center p-3 rounded-xl bg-violet-50">
                <p className="text-xs text-gray-500">CPU Cores</p>
                <p className="text-lg font-bold text-violet-600">{sysHealth.availableProcessors}</p>
              </div>
              {/* Entity counts */}
              <div className="text-center p-3 rounded-xl bg-amber-50">
                <p className="text-xs text-gray-500">DB Records</p>
                <p className="text-sm font-bold text-amber-700">
                  {(sysHealth.totalUsers + sysHealth.totalGames + sysHealth.totalMessages + sysHealth.totalRatings + sysHealth.totalRequests).toLocaleString()}
                </p>
                <p className="text-[10px] text-gray-400">across 5 tables</p>
              </div>
              {/* Requests */}
              <div className="text-center p-3 rounded-xl bg-cyan-50">
                <p className="text-xs text-gray-500">Join Requests</p>
                <p className="text-lg font-bold text-cyan-600">{sysHealth.totalRequests}</p>
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-8">Health data unavailable</p>
          )}
        </div>

      </div>
    </div>
  )
}
