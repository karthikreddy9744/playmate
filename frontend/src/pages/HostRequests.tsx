import React, { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth'
import { FiLoader, FiInbox, FiSend, FiRefreshCw } from 'react-icons/fi'

type StatusFilter = 'ALL' | 'PENDING' | 'ACCEPTED' | 'REJECTED'

export default function HostRequests() {
  const { user, isAuthenticated } = useAuth()
  const [data, setData] = useState<{ requestsByMe: any[]; requestsToMyGames: any[] } | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [gameFilter, setGameFilter] = useState<number | null>(null)
  const [tab, setTab] = useState<'incoming' | 'outgoing'>('incoming')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
      await api.post(`/games/${r.game.id}/requests/${r.id}/accept`)
      toast.success('Request accepted')
      load()
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed to accept') }
  }

  const reject = async (r: any) => {
    try {
      await api.post(`/games/${r.game.id}/requests/${r.id}/reject`)
      toast.info('Request rejected')
      load()
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed to reject') }
  }

  const incoming = data?.requestsToMyGames || []
  const outgoing = data?.requestsByMe || []
  const currentList = tab === 'incoming' ? incoming : outgoing

  // Build unique game list with titles for filter dropdown
  const games = Array.from(
    new Map(currentList.map((r: any) => [r.game?.id, r.game?.title || `Game #${r.game?.id}`])).entries()
  ).map(([id, title]) => ({ id, title }))

  const filtered = currentList.filter(
    (r: any) =>
      (statusFilter === 'ALL' || r.status === statusFilter) &&
      (!gameFilter || (r.game && r.game.id === gameFilter))
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
            {filtered.map((r: any) => (
              <div key={r.id} className="glass-card-solid p-4 flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {/* Requester avatar for incoming requests */}
                    {tab === 'incoming' && r.requester?.profilePictureUrl && (
                      <img src={r.requester.profilePictureUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                    )}
                    <span className="font-medium text-textPrimary">
                      {tab === 'incoming'
                        ? (r.requester?.name || r.requester?.email || 'Unknown')
                        : (r.game?.title || `Game #${r.game?.id}`)}
                    </span>
                    {statusBadge(r.status)}
                  </div>

                  {/* Requester profile stats for incoming */}
                  {tab === 'incoming' && r.requester && (
                    <div className="flex flex-wrap gap-2 mt-1.5 mb-1.5">
                      {r.requester.averageRating != null && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
                          ★ {Number(r.requester.averageRating).toFixed(1)} rating
                        </span>
                      )}
                      {r.requester.totalGamesPlayed != null && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                          🎮 {r.requester.totalGamesPlayed} games
                        </span>
                      )}
                      {(r.requester.noShowCount ?? 0) > 0 && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">
                          ⚠️ {r.requester.noShowCount} no-shows
                        </span>
                      )}
                      {r.requester.verifiedEmail && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">
                          ✓ Verified
                        </span>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-textSecondary">
                    {tab === 'incoming'
                      ? `Game: ${r.game?.title || `#${r.game?.id}`}`
                      : `Host: ${r.game?.hostName || 'Unknown'}`}
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
                </div>
                {tab === 'incoming' && r.status === 'PENDING' && (() => {
                  const start = r.game?.gameDateTime ? new Date(r.game.gameDateTime).getTime() : null
                  const deadlinePassed = start ? Date.now() > start - 10 * 60_000 : false
                  return deadlinePassed ? (
                    <span className="ml-4 text-xs text-gray-400 italic">Game started</span>
                  ) : (
                    <div className="flex flex-col gap-2 ml-4">
                      <button onClick={() => accept(r)} className="btn-primary text-sm">Accept</button>
                      <button onClick={() => reject(r)} className="btn-secondary text-sm">Reject</button>
                    </div>
                  )
                })()}
                {tab === 'outgoing' && r.status !== 'PENDING' && (
                  <div className="ml-4">{statusBadge(r.status)}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
