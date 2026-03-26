import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth'
import { FiLoader, FiInbox, FiSend, FiRefreshCw, FiStar, FiX, FiAlertTriangle } from 'react-icons/fi'

type StatusFilter = 'ALL' | 'PENDING' | 'ACCEPTED' | 'REJECTED'

interface Participant { id: number; name: string; profilePictureUrl?: string }

interface RatingForm {
  rateeId: number
  punctuality: number
  skillMatch: number
  friendliness: number
  reviewText: string
  playAgain: boolean
  wasGameConducted: boolean
}

export default function HostRequests() {
  const { user, isAuthenticated, backendUserId: cachedBackendUserId } = useAuth()
  const [backendUserId, setBackendUserId] = useState<number | null>(null)
  const [data, setData] = useState<{ requestsByMe: any[]; requestsToMyGames: any[] } | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [gameFilter, setGameFilter] = useState<number | null>(null)
  const [tab, setTab] = useState<'incoming' | 'outgoing'>('incoming')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Rating modal state
  const [ratingModal, setRatingModal] = useState<{ gameId: number; gameTitle: string } | null>(null)
  const [toRate, setToRate] = useState<Participant[]>([])
  const [ratingForms, setRatingForms] = useState<RatingForm[]>([])
  const [submittingRating, setSubmittingRating] = useState(false)

  // Auto-popup logic for T_end + 60 minutes
  useEffect(() => {
    if (!data || !backendUserId) return
    
    const allReqs = [...(data.requestsByMe || []), ...(data.requestsToMyGames || [])]
    const now = Date.now()
    
    for (const r of allReqs) {
      if (r.status !== 'ACCEPTED' || r.hasRated) continue
      
      const start = r.gameStartTime ? new Date(r.gameStartTime) : null
      const duration = r.gameDurationMinutes || 60
      const end = start ? new Date(start.getTime() + duration * 60000) : null
      if (!end) continue
      
      const popupTime = end.getTime() + 60 * 60000 // T_end + 1 hour
      const expiryTime = end.getTime() + 48 * 3600 * 1000 // T_end + 48 hours
      
      // If we are within the window [T_end+1h, T_end+48h]
      if (now >= popupTime && now <= expiryTime) {
        const storageKey = `playmate_popup_game_${r.gameId}_user_${backendUserId}`
        const alreadyShown = localStorage.getItem(storageKey)
        
        if (!alreadyShown) {
          // Trigger the modal
          openRatingModal(r)
          localStorage.setItem(storageKey, 'true')
          break // Only show one popup at a time
        }
      }
    }
  }, [data, backendUserId])

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

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get('/games/requests/mine')
      setData(data)
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to load requests')
      toast.error('Failed to load requests')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (user?.uid || isAuthenticated) load() }, [user?.uid, isAuthenticated])

  const accept = async (r: any) => {
    try {
      await api.post(`/games/${r.gameId}/requests/${r.id}/accept`)
      toast.success('Request accepted')
      load()
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed to accept') }
  }

  const reject = async (r: any) => {
    try {
      await api.post(`/games/${r.gameId}/requests/${r.id}/reject`)
      toast.info('Request rejected')
      load()
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed to reject') }
  }

  const openRatingModal = async (r: any) => {
    setRatingModal({ gameId: r.gameId, gameTitle: r.gameTitle })
    try {
      let players: Participant[] = []
      if (tab === 'incoming') {
        // Host rating the requester
        players = [{ id: r.requesterId, name: r.requesterName, profilePictureUrl: r.requesterPhotoUrl }]
      } else {
        // Requester rating the host
        const { data: gameData } = await api.get(`/games/${r.gameId}`)
        const { data: hostData } = await api.get(`/users/${gameData.createdBy}`)
        players = [{ id: hostData.id, name: hostData.name, profilePictureUrl: hostData.profilePictureUrl }]
      }

      setToRate(players)
      setRatingForms(players.map(p => ({ 
        rateeId: p.id, 
        punctuality: 5, 
        skillMatch: 5, 
        friendliness: 5, 
        reviewText: '', 
        playAgain: true,
        wasGameConducted: true 
      })))
    } catch {
      toast.error('Failed to load player details')
      setRatingModal(null)
    }
  }

  const updateRating = (rateeId: number, field: keyof RatingForm, value: number | string | boolean) => {
    setRatingForms(prev => prev.map(f => f.rateeId === rateeId ? { ...f, [field]: value } : f))
  }

  const submitRatings = async () => {
    if (!backendUserId || !ratingModal) return
    setSubmittingRating(true)
    try {
      for (const form of ratingForms) {
        await api.post(`/ratings?raterId=${backendUserId}`, {
          gameId: ratingModal.gameId,
          rateeId: form.rateeId,
          punctuality: form.punctuality,
          skillMatch: form.skillMatch,
          friendliness: form.friendliness,
          reviewText: form.reviewText || undefined,
          playAgain: form.playAgain,
          wasGameConducted: tab === 'outgoing' ? form.wasGameConducted : undefined
        })
      }
      toast.success('Rating submitted')
      setRatingModal(null)
      load() // Refresh to update hasRated flag
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to submit rating')
    } finally {
      setSubmittingRating(false)
    }
  }

  const incoming = data?.requestsToMyGames || []
  const outgoing = data?.requestsByMe || []
  const currentList = tab === 'incoming' ? incoming : outgoing

  // Build unique game list with titles for filter dropdown
  const games = Array.from(
    new Map(currentList.map((r: any) => [r.gameId, r.gameTitle || `Game #${r.gameId}`])).entries()
  ).map(([id, title]) => ({ id, title }))

  const filtered = currentList.filter(
    (r: any) =>
      (statusFilter === 'ALL' || r.status === statusFilter) &&
      (!gameFilter || r.gameId === gameFilter)
  )

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: 'bg-amber-100 text-amber-700',
      ACCEPTED: 'bg-emerald-100 text-emerald-700',
      REJECTED: 'bg-rose-100 text-rose-700',
    }
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
        {status}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-surface py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="section-heading">Game Requests</h1>

        {/* Tab switcher */}
        <div className="flex gap-2 mt-4 mb-4">
          <button
            onClick={() => { setTab('incoming'); setGameFilter(null) }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === 'incoming' ? 'bg-accent text-white' : 'bg-white border border-border text-textSecondary hover:bg-gray-50'
            }`}
          >
            <FiInbox className="w-4 h-4" /> Incoming ({incoming.length})
          </button>
          <button
            onClick={() => { setTab('outgoing'); setGameFilter(null) }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === 'outgoing' ? 'bg-accent text-white' : 'bg-white border border-border text-textSecondary hover:bg-gray-50'
            }`}
          >
            <FiSend className="w-4 h-4" /> My Requests ({outgoing.length})
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 items-center mb-4">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)} className="select-field text-sm">
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <select value={gameFilter ?? ''} onChange={e => setGameFilter(e.target.value ? +e.target.value : null)} className="select-field text-sm">
            <option value="">All games</option>
            {games.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
          <button onClick={load} className="btn-secondary flex items-center gap-1.5 text-sm">
            <FiRefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="glass-card-solid p-12 flex items-center justify-center">
            <FiLoader className="w-6 h-6 animate-spin text-accent" />
          </div>
        ) : error ? (
          <div className="glass-card-solid p-6 text-center">
            <p className="text-rose-600 mb-2">{error}</p>
            <button onClick={load} className="btn-primary text-sm">Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card-solid p-8 text-center">
            <p className="text-textSecondary">
              {tab === 'incoming' ? 'No incoming requests for your games' : 'You haven\'t sent any join requests'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((r: any) => {
              const start = r.gameStartTime ? new Date(r.gameStartTime) : null
              const duration = r.gameDurationMinutes || 60
              const end = start ? new Date(start.getTime() + duration * 60000) : null
              const now = Date.now()
              
              // NEW PRECISE FEEDBACK RULES
              // T_end + 15 min -> Activation
              const activationTime = end ? end.getTime() + 15 * 60000 : 0
              // T_end + 48 hours -> Expiry
              const expiryTime = end ? end.getTime() + 48 * 3600 * 1000 : 0
              
              const isEligible = now >= activationTime && now <= expiryTime
              const canRate = r.status === 'ACCEPTED' && isEligible && !r.hasRated

              return (
                <div 
                  key={r.id} 
                  onClick={() => canRate ? openRatingModal(r) : null}
                  className={`glass-card-solid p-4 flex items-start justify-between transition-all ${canRate ? 'cursor-pointer hover:border-amber-300 hover:shadow-md' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {/* Requester avatar for incoming requests */}
                      {tab === 'incoming' && r.requesterPhotoUrl && (
                        <img src={r.requesterPhotoUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                      )}
                      <span className="font-medium text-textPrimary">
                        {tab === 'incoming'
                          ? (r.requesterName || 'Unknown')
                          : (r.gameTitle || `Game #${r.gameId}`)}
                      </span>
                      {statusBadge(r.isCancelled ? 'CANCELLED' : r.status)}
                      {canRate && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full animate-pulse">
                          <FiStar className="w-2.5 h-2.5" /> FEEDBACK ACTIVE
                        </span>
                      )}
                    </div>

                    {/* Requester profile stats for incoming */}
                    {tab === 'incoming' && (
                      <div className="flex flex-wrap gap-2 mt-1.5 mb-1.5">
                        {r.requesterRating != null && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
                            ★ {Number(r.requesterRating).toFixed(1)} rating
                          </span>
                        )}
                        {r.requesterGamesPlayed != null && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                            🎮 {r.requesterGamesPlayed} games
                          </span>
                        )}
                        {(r.requesterNoShows ?? 0) > 0 && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">
                            ⚠️ {r.requesterNoShows} no-shows
                          </span>
                        )}
                        {r.requesterVerified && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">
                            ✓ Verified
                          </span>
                        )}
                      </div>
                    )}

                    <p className="text-xs text-textSecondary">
                      {tab === 'incoming'
                        ? `Game: ${r.gameTitle || `#${r.gameId}`}`
                        : `Request ID: #${r.id}`}
                    </p>
                    {r.message && <p className="text-sm mt-2 text-textPrimary">{r.message}</p>}
                    {r.createdAt && (
                      <p className="text-[10px] text-textSecondary mt-1">
                        Requested: {new Date(r.createdAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                    {r.respondedAt && r.status !== 'PENDING' && (
                      <p className="text-[10px] text-textSecondary">
                        Responded: {new Date(r.respondedAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}

                    {/* Rating Trigger */}
                    {r.status === 'ACCEPTED' && isEligible && (
                      r.hasRated ? (
                        <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600 font-medium bg-emerald-50 w-fit px-2 py-1 rounded-lg">
                          <FiStar className="fill-emerald-600" /> Rated
                        </div>
                      ) : (
                        <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-700 font-bold bg-amber-50 w-fit px-3 py-1.5 rounded-lg border border-amber-200 animate-bounce">
                          <FiStar /> Click to rate {tab === 'incoming' ? 'player' : 'host'}
                        </div>
                      )
                    )}
                  </div>
                  {tab === 'incoming' && r.status === 'PENDING' && (() => {
                    const start = r.game?.gameDateTime ? new Date(r.game.gameDateTime).getTime() : null
                    const deadlinePassed = start ? Date.now() > start - 10 * 60_000 : false
                    return deadlinePassed ? (
                      <span className="ml-4 text-xs text-gray-400 italic">Game started</span>
                    ) : (
                      <div className="flex flex-col gap-2 ml-4">
                        <button onClick={(e) => { e.stopPropagation(); accept(r); }} className="btn-primary text-sm">Accept</button>
                        <button onClick={(e) => { e.stopPropagation(); reject(r); }} className="btn-secondary text-sm">Reject</button>
                      </div>
                    )
                  })()}
                  {tab === 'outgoing' && r.status !== 'PENDING' && (
                    <div className="ml-4">{statusBadge(r.status)}</div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ─── Rating Modal ─── */}
      {ratingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setRatingModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-bold text-textPrimary">
                  Rate {tab === 'incoming' ? 'Player' : 'Host'}
                </h2>
                <p className="text-sm text-textSecondary">{ratingModal.gameTitle}</p>
              </div>
              <button onClick={() => setRatingModal(null)} className="p-2 rounded-lg hover:bg-gray-100"><FiX className="w-5 h-5" /></button>
            </div>

            {toRate.length === 0 ? (
              <p className="text-textSecondary text-center py-8">No one to rate.</p>
            ) : (
              <div className="space-y-6">
                {toRate.map(p => {
                  const form = ratingForms.find(f => f.rateeId === p.id)
                  if (!form) return null
                  return (
                    <div key={p.id} className="border border-border rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-3">
                        {p.profilePictureUrl ? (
                          <img src={p.profilePictureUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold">{p.name?.[0]?.toUpperCase() || '?'}</div>
                        )}
                        <span className="font-semibold text-textPrimary">{p.name}</span>
                      </div>

                      {tab === 'outgoing' && (
                        <div className="mb-5 p-3 bg-amber-50 rounded-xl border border-amber-100">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-bold text-amber-900">Was this game actually conducted?</p>
                              <p className="text-[11px] text-amber-700">Help us verify host performance and gain community trust.</p>
                            </div>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => updateRating(p.id, 'wasGameConducted', true)}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${form.wasGameConducted ? 'bg-emerald-500 text-white shadow-md' : 'bg-white text-gray-400 border border-gray-200'}`}
                              >Yes</button>
                              <button 
                                onClick={() => updateRating(p.id, 'wasGameConducted', false)}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${!form.wasGameConducted ? 'bg-rose-500 text-white shadow-md' : 'bg-white text-gray-400 border border-gray-200'}`}
                              >No</button>
                            </div>
                          </div>
                          {!form.wasGameConducted && (
                            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-rose-600 font-medium">
                              <FiAlertTriangle className="w-3 h-3" /> Note: Reporting a ghosted game affects host reliability.
                            </div>
                          )}
                        </div>
                      )}

                      {(['punctuality', 'skillMatch', 'friendliness'] as const).map(field => (
                        <div key={field} className="mb-3">
                          <label className="text-xs text-textSecondary capitalize mb-1 block">
                            {field === 'skillMatch' ? 'Skill Match' : field}
                          </label>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map(v => (
                              <button key={v} type="button"
                                onClick={() => updateRating(p.id, field, v)}
                                className={`w-8 h-8 rounded-lg text-sm font-bold transition-all ${
                                  v <= form[field] ? 'bg-amber-400 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                }`}>{v}</button>
                            ))}
                          </div>
                        </div>
                      ))}

                      <div>
                        <label className="text-xs text-textSecondary mb-1 block">Review (optional)</label>
                        <textarea value={form.reviewText} onChange={e => updateRating(p.id, 'reviewText', e.target.value)}
                          className="input-field text-sm" rows={2} maxLength={500} placeholder="Brief feedback..." />
                      </div>

                      <div className="mt-4 flex items-center justify-between bg-accent/5 p-3 rounded-xl">
                        <span className="text-sm font-medium text-textPrimary">Would play again?</span>
                        <button onClick={() => updateRating(p.id, 'playAgain', !form.playAgain)}
                          className={`relative w-11 h-6 transition-colors rounded-full ${form.playAgain ? 'bg-accent' : 'bg-gray-300'}`}>
                          <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform ${form.playAgain ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                      </div>
                    </div>
                  )
                })}

                <button onClick={submitRatings} disabled={submittingRating}
                  className="btn-primary w-full !py-3">
                  {submittingRating ? 'Submitting...' : 'Submit Rating'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
