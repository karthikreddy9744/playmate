import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { toast } from 'react-toastify'
import { FiStar, FiX } from 'react-icons/fi'

interface Game {
  id: number
  title: string
  description?: string
  sport: string
  skillLevel: string
  startTime: string
  durationMinutes: number
  totalSlots: number
  availableSlots: number
  costPerPerson?: number
  locationLat?: number
  locationLng?: number
  locationAddress?: string
  locationCity?: string
  notes?: string
  equipmentProvided?: boolean
  equipmentDetails?: string
  createdBy?: number
  createdByName?: string
  createdAt?: string
  isCancelled?: boolean
  participantCount?: number
  participantIds?: number[]
  status?: string // UPCOMING | LIVE | COMPLETED | CANCELLED | FULL
  distanceKm?: number
  hasRated?: boolean
}

interface Participant { id: number; name: string; profilePictureUrl?: string }

interface RatingForm {
  rateeId: number
  punctuality: number
  skillMatch: number
  friendliness: number
  reviewText: string
  playAgain: boolean
}

// Status badge config
const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot?: string }> = {
  LIVE:      { label: '⚡ Live Now',  bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  UPCOMING:  { label: '🕐 Upcoming', bg: 'bg-blue-100',  text: 'text-blue-700' },
  FULL:      { label: '🔒 Full',     bg: 'bg-amber-100', text: 'text-amber-700' },
  COMPLETED: { label: '✅ Completed', bg: 'bg-gray-100',  text: 'text-gray-500' },
  CANCELLED: { label: '❌ Cancelled', bg: 'bg-red-100',   text: 'text-red-500' },
}

export default function Games() {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSports, setSelectedSports] = useState<string[]>([])
  const [selectedSkillLevel, setSelectedSkillLevel] = useState('ALL')
  const [datePreset, setDatePreset] = useState('ALL')
  const [customDateFrom, setCustomDateFrom] = useState('')
  const [customDateTo, setCustomDateTo] = useState('')
  const [radius, setRadius] = useState(50)
  const [availableOnly, setAvailableOnly] = useState(false)
  const [sortByDistance, setSortByDistance] = useState(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const { isAuthenticated, user, backendUserId: cachedBackendUserId } = useAuth()
  const navigate = useNavigate()
  const [backendUserId, setBackendUserId] = useState<number | null>(null)
  const [tab, setTab] = useState<'discover' | 'my'>('discover')
  const [myGames, setMyGames] = useState<Game[]>([])

  // Fetch backend user ID
  useEffect(() => {
    if (user?.uid) {
      api.get(`/users/firebase/${user.uid}`).then(r => setBackendUserId(r.data.id)).catch(() => {
        if (cachedBackendUserId) setBackendUserId(cachedBackendUserId)
      })
    } else if (cachedBackendUserId) {
      setBackendUserId(cachedBackendUserId)
    }
  }, [user?.uid, cachedBackendUserId])

  const handleRequestJoin = async (gameId: number) => {
    if (!isAuthenticated || !user) {
      navigate('/login')
      return
    }
    try {
      await api.post(`/games/${gameId}/requests`, { firebaseUid: user.uid, message: '' })
      toast.success('Join request sent! The host will review it.')
    } catch (error: any) {
      let msg = 'Failed to send request.'
      if (error.response?.data) {
        msg = typeof error.response.data === 'object'
          ? error.response.data.message || error.response.data.error || JSON.stringify(error.response.data)
          : error.response.data
      }
      toast.error(msg)
    }
  }

  const handleCreateGameClick = () => {
    if (!isAuthenticated) {
      navigate('/login')
    } else {
      navigate('/create')
    }
  }

  // Get user's GPS location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setUserLocation(null)
      )
    }
  }, [])

  useEffect(() => {
    if (tab !== 'discover') return
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (selectedSports.length > 0) params.set('sport', selectedSports.join(','))
        if (selectedSkillLevel !== 'ALL') params.set('skillLevel', selectedSkillLevel)

        // Date range from preset
        const now = new Date()
        const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const toDT = (d: Date) => {
          const p = (n: number) => n.toString().padStart(2, '0')
          return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
        }
        if (datePreset === 'TODAY') {
          const end = new Date(sod); end.setDate(end.getDate() + 1)
          params.set('from', toDT(sod)); params.set('to', toDT(end))
        } else if (datePreset === 'TOMORROW') {
          const s = new Date(sod); s.setDate(s.getDate() + 1)
          const e = new Date(sod); e.setDate(e.getDate() + 2)
          params.set('from', toDT(s)); params.set('to', toDT(e))
        } else if (datePreset === 'WEEKEND') {
          const day = sod.getDay()
          const sat = new Date(sod)
          if (day === 0) sat.setDate(sat.getDate() - 1)
          else if (day < 6) sat.setDate(sat.getDate() + (6 - day))
          const sunEnd = new Date(sat); sunEnd.setDate(sunEnd.getDate() + 2)
          params.set('from', toDT(sat)); params.set('to', toDT(sunEnd))
        } else if (datePreset === 'CUSTOM') {
          if (customDateFrom) params.set('from', `${customDateFrom}T00:00:00`)
          if (customDateTo) params.set('to', `${customDateTo}T23:59:59`)
        }

        if (userLocation && !isNaN(userLocation.lat) && !isNaN(userLocation.lng)) {
          params.set('lat', String(userLocation.lat))
          params.set('lng', String(userLocation.lng))
          if (radius < 100) params.set('radius', String(radius))
          if (sortByDistance) params.set('sortByDistance', 'true')
        }
        if (availableOnly) params.set('availableOnly', 'true')

        const response = await api.get('/games', { params })
        setGames(response.data)
      } catch (error) {
        console.error('Error fetching games:', error)
        const status = (error as any)?.response?.status
        if (status === 401 || status === 403) {
          toast.info('Please sign in to view games')
          navigate('/login')
        } else {
          toast.error('Failed to load games')
        }
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [tab, selectedSports, selectedSkillLevel, datePreset, customDateFrom, customDateTo, radius, userLocation, availableOnly, sortByDistance, navigate])

  // Fetch My Games from dedicated endpoint
  useEffect(() => {
    if (backendUserId && tab === 'my') {
      api.get('/games/mine').then(r => {
        setMyGames(r.data as Game[])
      }).catch(() => toast.error('Failed to load your games'))
    }
  }, [backendUserId, tab])

  const sports = ['FOOTBALL', 'BASKETBALL', 'TENNIS', 'BADMINTON', 'CRICKET', 'RUNNING', 'VOLLEYBALL', 'TABLE_TENNIS', 'SWIMMING', 'CYCLING', 'YOGA', 'GYM', 'OTHER']

  const filteredGames = tab === 'my' ? myGames : games

  const getSportIcon = (sport: string) => {
    const icons: Record<string, string> = {
      FOOTBALL: '⚽', BASKETBALL: '🏀', TENNIS: '🎾', BADMINTON: '🏸',
      CRICKET: '🏏', RUNNING: '🏃', VOLLEYBALL: '🏐', TABLE_TENNIS: '🏓',
      SWIMMING: '🏊', CYCLING: '🚴', YOGA: '🧘', GYM: '💪', HOCKEY: '🏑', OTHER: '🏆',
    }
    return icons[sport] || '🏆'
  }

  const formatSport = (sport: string) => sport.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).replace(/\B\w+/g, c => c.toLowerCase())

  // Capacity bar color: green < 60%, amber 60-85%, red 85%+
  const getCapacityColor = (filled: number, total: number) => {
    if (total === 0) return 'bg-gray-300'
    const pct = filled / total
    if (pct >= 0.85) return 'bg-red-500'
    if (pct >= 0.6) return 'bg-amber-500'
    return 'bg-green-500'
  }

  const isGameEnded = (status?: string) => status === 'COMPLETED' || status === 'CANCELLED'
  const isGameFull = (status?: string) => status === 'FULL'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-accent"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-8 px-4 bg-primary">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-textPrimary mb-4">Games</h1>
          <p className="text-textSecondary text-lg">Find and join sports games near you</p>
        </div>

        {/* Discover / My Games Tabs */}
        {isAuthenticated && (
          <div className="flex justify-center gap-2 mb-8">
            <button onClick={() => setTab('discover')}
              className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${tab === 'discover' ? 'bg-accent text-white shadow-lg' : 'bg-secondary text-textPrimary hover:bg-accent/20'}`}>
              Discover
            </button>
            <button onClick={() => setTab('my')}
              className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${tab === 'my' ? 'bg-accent text-white shadow-lg' : 'bg-secondary text-textPrimary hover:bg-accent/20'}`}>
              My Games
            </button>
          </div>
        )}

        {/* ── Filters ── */}
        <div className="glass-effect p-6 rounded-2xl mb-8 card-3d space-y-6">
          {/* Sport (multi-select) */}
          <div>
            <h3 className="text-sm font-semibold text-textSecondary uppercase tracking-wider mb-3">Sport</h3>
            <div className="flex flex-wrap gap-2">
              {sports.map(sport => {
                const active = selectedSports.includes(sport)
                return (
                  <button key={sport}
                    onClick={() => setSelectedSports(prev => active ? prev.filter(s => s !== sport) : [...prev, sport])}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      active ? 'bg-accent text-white shadow-lg' : 'bg-secondary text-textPrimary hover:bg-accent/20'
                    }`}>
                    {getSportIcon(sport)} {formatSport(sport)}
                  </button>
                )
              })}
              {selectedSports.length > 0 && (
                <button onClick={() => setSelectedSports([])}
                  className="px-3 py-1.5 rounded-full text-sm font-medium text-red-500 bg-red-50 hover:bg-red-100 transition-all">
                  ✕ Clear
                </button>
              )}
            </div>
          </div>

          {/* Skill Level */}
          <div>
            <h3 className="text-sm font-semibold text-textSecondary uppercase tracking-wider mb-3">Skill Level</h3>
            <div className="flex flex-wrap gap-2">
              {['ALL', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED'].map(level => (
                <button key={level}
                  onClick={() => setSelectedSkillLevel(level)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    selectedSkillLevel === level ? 'bg-accent text-white shadow-lg' : 'bg-secondary text-textPrimary hover:bg-accent/20'
                  }`}>
                  {level === 'ALL' ? '🎯 All Levels' : formatSport(level)}
                </button>
              ))}
            </div>
          </div>

          {/* Date / When */}
          <div>
            <h3 className="text-sm font-semibold text-textSecondary uppercase tracking-wider mb-3">When</h3>
            <div className="flex flex-wrap gap-2">
              {(['ALL', 'TODAY', 'TOMORROW', 'WEEKEND', 'CUSTOM'] as const).map(preset => (
                <button key={preset}
                  onClick={() => setDatePreset(preset)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    datePreset === preset ? 'bg-accent text-white shadow-lg' : 'bg-secondary text-textPrimary hover:bg-accent/20'
                  }`}>
                  {preset === 'ALL' ? '📅 Any Date' : preset === 'TODAY' ? '📅 Today' : preset === 'TOMORROW' ? '📅 Tomorrow' : preset === 'WEEKEND' ? '📅 This Weekend' : '📅 Custom Range'}
                </button>
              ))}
            </div>
            {datePreset === 'CUSTOM' && (
              <div className="flex gap-3 mt-3">
                <div>
                  <label className="text-xs text-textSecondary block mb-1">From</label>
                  <input type="date" value={customDateFrom} onChange={e => setCustomDateFrom(e.target.value)}
                    className="input-field text-sm" />
                </div>
                <div>
                  <label className="text-xs text-textSecondary block mb-1">To</label>
                  <input type="date" value={customDateTo} onChange={e => setCustomDateTo(e.target.value)}
                    className="input-field text-sm" />
                </div>
              </div>
            )}
          </div>

          {/* Distance + Sort + Available Only */}
          <div className="flex flex-wrap gap-6 items-end">
            <div className="flex-1 min-w-[200px]">
              <h3 className="text-sm font-semibold text-textSecondary uppercase tracking-wider mb-3">Distance</h3>
              <div className="flex items-center gap-3">
                <input type="range" min={1} max={100} value={radius}
                  onChange={e => setRadius(Number(e.target.value))} className="flex-1" />
                <span className="text-sm font-semibold text-accent w-20 text-right">{radius < 100 ? `${radius} km` : 'Any'}</span>
              </div>
              {!userLocation && <p className="text-xs text-textSecondary mt-1">Enable location for distance filter</p>}
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={sortByDistance} onChange={e => setSortByDistance(e.target.checked)}
                className="w-4 h-4 accent-accent" disabled={!userLocation} />
              <span className="text-sm text-textPrimary">Sort by distance</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={availableOnly} onChange={e => setAvailableOnly(e.target.checked)}
                className="w-4 h-4 accent-accent" />
              <span className="text-sm text-textPrimary">Open slots only</span>
            </label>
          </div>
        </div>

        {/* Games Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGames.map(game => {
            const status = game.status || 'UPCOMING'
            const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.UPCOMING
            const ended = isGameEnded(status)
            const full = isGameFull(status)
            const filledCount = game.totalSlots - game.availableSlots
            const fillPct = game.totalSlots > 0 ? (filledCount / game.totalSlots) * 100 : 0

            return (
              <div key={game.id}
                className={`glass-effect p-6 rounded-2xl card-3d transition-all duration-300 flex flex-col justify-between ${ended ? 'opacity-60 grayscale' : 'hover:scale-102'}`}
              >
                {/* Header: Sport badge + Status badge */}
                <div className="flex items-center justify-between mb-3">
                  <div className="bg-accent text-white px-3 py-1 rounded-full inline-flex items-center text-sm">
                    <span className="mr-1.5">{getSportIcon(game.sport)}</span>
                    <span className="font-semibold">{formatSport(game.sport)}</span>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
                    {cfg.dot && (
                      <span className={`w-2 h-2 rounded-full ${cfg.dot} ${status === 'LIVE' ? 'animate-pulse' : ''}`} />
                    )}
                    {cfg.label}
                  </span>
                </div>

                {/* Created by you badge */}
                {backendUserId && game.createdBy === backendUserId && (
                  <div className="mb-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/15 border border-accent/30 text-accent text-xs font-bold">
                    <span>👑</span> Created by you
                  </div>
                )}

                {/* Title */}
                <h3 className="text-lg font-bold text-textPrimary mb-1 truncate">{game.title}</h3>
                {game.createdByName && backendUserId !== game.createdBy && (
                  <p className="text-xs text-accent font-medium mb-1">🎯 Hosted by {game.createdByName}</p>
                )}
                {game.description && (
                  <p className="text-textSecondary text-sm mb-3 line-clamp-2">{game.description}</p>
                )}

                {/* Game Details */}
                <div className="space-y-2.5 flex-grow text-sm">
                  <div className="flex justify-between text-textPrimary">
                    <span className="text-textSecondary">Skill Level:</span>
                    <span className="font-semibold">{formatSport(game.skillLevel || 'ALL_LEVELS')}</span>
                  </div>
                  <div className="flex justify-between text-textPrimary">
                    <span className="text-textSecondary">When:</span>
                    <span className="font-semibold">{new Date(game.startTime).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between text-textPrimary">
                    <span className="text-textSecondary">Time:</span>
                    <span className="font-semibold">{new Date(game.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="flex justify-between text-textPrimary">
                    <span className="text-textSecondary">Duration:</span>
                    <span className="font-semibold">{game.durationMinutes} mins</span>
                  </div>
                  {game.distanceKm != null && (
                    <div className="flex justify-between text-textPrimary">
                      <span className="text-textSecondary">Distance:</span>
                      <span className="font-semibold text-accent">{game.distanceKm < 1 ? `${Math.round(game.distanceKm * 1000)} m` : `${game.distanceKm.toFixed(1)} km`}</span>
                    </div>
                  )}

                  {/* Capacity bar: shows filled / total */}
                  <div className="flex justify-between items-center text-textPrimary">
                    <span className="text-textSecondary">Players:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{filledCount}/{game.totalSlots}</span>
                      <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden">
                        <div className={`h-2 rounded-full transition-all ${getCapacityColor(filledCount, game.totalSlots)}`}
                          style={{ width: `${fillPct}%` }} />
                      </div>
                    </div>
                  </div>

                  {game.costPerPerson !== undefined && game.costPerPerson > 0 && (
                    <div className="flex justify-between text-textPrimary">
                      <span className="text-textSecondary">Cost:</span>
                      <span className="text-accent font-semibold">₹{game.costPerPerson}</span>
                    </div>
                  )}

                  {game.equipmentProvided && (
                    <div className="flex justify-between text-textPrimary">
                      <span className="text-textSecondary">Equipment:</span>
                      <span className="font-semibold text-green-600">Provided {game.equipmentDetails ? `(${game.equipmentDetails})` : ''}</span>
                    </div>
                  )}

                  {(game.locationAddress || game.locationCity) && (
                    <div className="pt-2 border-t border-secondary mt-2">
                      <p className="text-textSecondary text-sm">📍 {game.locationAddress || game.locationCity}</p>
                      {game.locationAddress && game.locationCity && (
                        <p className="text-textSecondary text-xs">{game.locationCity}</p>
                      )}
                    </div>
                  )}

                  {game.notes && game.notes !== game.description && (
                    <p className="text-textSecondary text-sm italic">"{game.notes}"</p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="mt-5 space-y-2">
                  {(() => {
                    const isCreator = backendUserId && game.createdBy === backendUserId
                    const isParticipant = backendUserId && game.participantIds?.includes(backendUserId)

                    if (ended) {
                      return (
                        <div className="flex-1 text-center py-2 px-4 bg-gray-50 text-gray-400 rounded-xl text-sm font-medium border border-gray-100">
                          {status === 'CANCELLED' ? 'Game Cancelled' : 'Game Ended'}
                        </div>
                      )
                    }

                    if (isCreator) {
                      return (
                        <div className="space-y-2">
                          <div className="w-full py-3 rounded-xl bg-accent/10 text-accent font-medium text-center">
                            🎯 Your Game — You're the Host
                          </div>
                          {!ended && (
                            <button onClick={async () => {
                              if (!confirm('Delete this game? All participants will be notified.')) return
                              try {
                                await api.delete(`/games/${game.id}`)
                                toast.success('Game deleted')
                                setGames(prev => prev.filter(g => g.id !== game.id))
                                setMyGames(prev => prev.filter(g => g.id !== game.id))
                              } catch (e: any) { toast.error(e.response?.data || 'Failed to delete') }
                            }} className="w-full py-2.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 font-medium text-sm transition-colors">
                              🗑️ Delete Game
                            </button>
                          )}
                        </div>
                      )
                    }

                    if (isParticipant) {
                      return (
                        <div className="w-full py-3 rounded-xl bg-green-50 text-green-700 font-medium text-center flex items-center justify-center gap-2">
                          ✅ Joined
                        </div>
                      )
                    }

                    if (full) {
                      return (
                        <button disabled className="w-full py-3 rounded-xl bg-amber-100 text-amber-600 cursor-not-allowed font-medium">
                          Game Full
                        </button>
                      )
                    }

                    return (
                      <button onClick={() => handleRequestJoin(game.id)}
                        className="w-full btn-primary py-3">
                        📩 Request to Join
                      </button>
                    )
                  })()}
                </div>
              </div>
            )
          })}
        </div>

        {/* Empty State */}
        {filteredGames.length === 0 && !loading && (
          <div className="text-center py-16 px-4 glass-effect rounded-2xl">
            <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
              <span className="text-5xl">🤔</span>
            </div>
            <h3 className="text-3xl font-bold text-textPrimary mb-3">No Games Found</h3>
            <p className="text-textSecondary text-lg mb-8 max-w-md mx-auto">
              {selectedSports.length === 0
                ? 'It looks like there are no games available at the moment. Be the first to create an exciting new game!'
                : `We couldn't find any matching games. Try adjusting your filters or create a new game.`
              }
            </p>
            <button onClick={handleCreateGameClick} className="btn-primary py-3 px-8 text-lg font-semibold">
              Create a Game
            </button>
          </div>
        )}
      </div>


    </div>
  )
}
