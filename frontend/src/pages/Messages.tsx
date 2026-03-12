import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { motion, AnimatePresence } from 'framer-motion'
import { FiSend, FiSearch, FiMessageCircle, FiArrowLeft, FiLoader, FiAlertTriangle, FiMapPin } from 'react-icons/fi'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MdVerified } from 'react-icons/md'
import { api } from '../lib/api'
import { toast } from 'react-toastify'
import { subscribeToConversation, subscribeToUserQueue, sendTyping, subscribeToGameGroup } from '../lib/ws'
import ProfileLocationPicker from '../components/ProfileLocationPicker'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

interface InboxEntry {
  otherUserId: number
  otherUserName: string
  otherUserPhoto: string | null
  otherUserVerified: boolean
  lastMessage: string
  lastMessageTime: string
  unreadCount: number
}

interface Message {
  id: number
  senderId: number
  senderName: string
  senderPhotoUrl: string | null
  receiverId: number
  content: string
  isRead: boolean
  createdAt: string
  gameId?: number
}

interface GroupChat {
  gameId: number
  gameTitle: string
  sport: string
  memberCount: number
}

interface GroupMember {
  id: number
  name: string
  profilePictureUrl?: string
}

export default function Messages() {
  // For location modal
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [locationAddress, setLocationAddress] = useState('')
  const msgIcon = L.icon({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIcon2x,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  })
  const parseMapsLink = (text: string) => {
    const m = text.match(/https?:\/\/maps\.google\.com\/\?q=([0-9.+-]+),([0-9.+-]+)/)
    if (!m) return null
    const lat = parseFloat(m[1])
    const lng = parseFloat(m[2])
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null
    return { lat, lng }
  }

  const { user, isAuthenticated, loading, backendUserId: cachedBackendUserId } = useAuth()
  const [backendUserId, setBackendUserId] = useState<number | null>(null)
  const [inbox, setInbox] = useState<InboxEntry[]>([])
  const [activeConvo, setActiveConvo] = useState<InboxEntry | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')
  const [loadingInbox, setLoadingInbox] = useState(false)
  const [loadingConvo, setLoadingConvo] = useState(false)
  const [gameEnded, setGameEnded] = useState(false)
  const [gameEndedReason, setGameEndedReason] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [showRequestsPanel, setShowRequestsPanel] = useState(false)
  const [myRequests, setMyRequests] = useState<{ requestsByMe: any[]; requestsToMyGames: any[] } | null>(null)
  const [allowedToMessage, setAllowedToMessage] = useState(true)
  const location = useLocation()
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null)

  // Group chat state
  const [chatMode, setChatMode] = useState<'dm' | 'group'>('dm')
  const [groupChats, setGroupChats] = useState<GroupChat[]>([])
  const [activeGroup, setActiveGroup] = useState<GroupChat | null>(null)
  const [groupMessages, setGroupMessages] = useState<Message[]>([])
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([])
  const [contacts, setContacts] = useState<InboxEntry[]>([])
  const [loadingGroup, setLoadingGroup] = useState(false)
  const [newGroupMsg, setNewGroupMsg] = useState('')
  const [sendingGroup, setSendingGroup] = useState(false)

  // Get backend user ID
  useEffect(() => {
    if (user?.uid) {
      api.get(`/users/firebase/${user.uid}`)
        .then(r => setBackendUserId(r.data.id))
        .catch(() => {
          // Fallback to cached backendUserId from auth state
          if (cachedBackendUserId) setBackendUserId(cachedBackendUserId)
        })
    } else if (cachedBackendUserId) {
      setBackendUserId(cachedBackendUserId)
    }
  }, [user?.uid, cachedBackendUserId])

  // Check query params to auto-open requests panel or focus a game
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const open = params.get('openRequests')
    const gid = params.get('gameId')
    if (open === '1' || open === 'true') {
      setShowRequestsPanel(true)
      loadMyRequests()
    }
    if (gid) setSelectedGameId(+gid)
  }, [location.search])

  const loadMyRequests = async () => {
    try {
      const { data } = await api.get('/games/requests/mine')
      setMyRequests(data)
    } catch (e) { console.error(e) }
  }

  // Load group chats (games the user participates in)
  const loadGroupChats = useCallback(async () => {
    if (!backendUserId) return
    try {
      const { data } = await api.get('/games/mine')
      const now = Date.now()
      const groups: GroupChat[] = (data as any[])
        .filter((g: any) => {
          if (g.status === 'CANCELLED') return false
          // Hide games that have ended (startTime + duration + 30 min buffer)
          if (g.startTime) {
            const start = new Date(g.startTime).getTime()
            const durMs = ((g.durationMinutes ?? 60) + 30) * 60_000
            if (now > start + durMs) return false
          }
          return true
        })
        .map((g: any) => ({
          gameId: g.id,
          gameTitle: g.title,
          sport: g.sport,
          memberCount: g.participantCount || (g.participantIds?.length ?? 0),
        }))
      setGroupChats(groups)
    } catch { /* ignore */ }
  }, [backendUserId])

  useEffect(() => {
    if (backendUserId && chatMode === 'group') loadGroupChats()
  }, [backendUserId, chatMode, loadGroupChats])

  const openGroupChat = async (group: GroupChat) => {
    setActiveGroup(group)
    setLoadingGroup(true)
    try {
      const [msgsRes, membersRes] = await Promise.all([
        api.get(`/messages/group/${group.gameId}`),
        api.get(`/messages/group/${group.gameId}/members`),
      ])
      setGroupMessages(msgsRes.data)
      setGroupMembers(membersRes.data)
    } catch { toast.error('Failed to load group chat') }
    finally { setLoadingGroup(false) }
  }

  const sendGroupMessage = async () => {
    const content = newGroupMsg.trim()
    if (!content || !backendUserId || !activeGroup) return
    setSendingGroup(true)
    const optimistic: Message = {
      id: Date.now(),
      senderId: backendUserId,
      senderName: user?.displayName || 'You',
      senderPhotoUrl: user?.photoURL || null,
      receiverId: 0,
      content,
      isRead: false,
      createdAt: new Date().toISOString(),
      gameId: activeGroup.gameId,
    }
    setGroupMessages(prev => [...prev, optimistic])
    setNewGroupMsg('')
    try {
      const { data: saved } = await api.post(`/messages/group/${activeGroup.gameId}/send`, {
        senderId: backendUserId, content,
      })
      // Replace optimistic message with real one (so WebSocket duplicate check matches)
      const realMsg = Array.isArray(saved) ? saved[0] : saved
      if (realMsg) setGroupMessages(prev => prev.map(m => m.id === optimistic.id ? { ...realMsg } : m))
    } catch (err: any) {
      setGroupMessages(prev => prev.filter(m => m.id !== optimistic.id))
      setNewGroupMsg(content)
      const errMsg = err?.response?.data?.error || err?.response?.data?.message || ''
      if (errMsg.toLowerCase().includes('ended') || errMsg.toLowerCase().includes('cancelled')) {
        toast.error('Group chat disabled \u2014 the game has ended or was cancelled.')
      } else {
        toast.error('Failed to send message')
      }
    }
    setSendingGroup(false)
  }

  // Subscribe to group WebSocket when active
  useEffect(() => {
    let unsub: (() => void) | null = null
    let cancelled = false
    if (activeGroup && backendUserId) {
      subscribeToGameGroup(activeGroup.gameId, (msg: Message) => {
        if (cancelled) return
        // Skip own messages — sender already has optimistic/API copy
        if (msg.senderId === backendUserId) return
        setGroupMessages(prev => prev.some(p => p.id === msg.id) ? prev : [...prev, msg])
      }).then(u => {
        if (cancelled) { if (u) u() } else { unsub = u ?? null }
      })
    }
    return () => { cancelled = true; if (unsub) unsub() }
  }, [activeGroup, backendUserId])

  // Load inbox
  const loadInbox = useCallback(async () => {
    if (!backendUserId) return
    try {
      const [inboxResult, contactsResult] = await Promise.allSettled([
        api.get(`/messages/inbox/${backendUserId}`),
        api.get(`/messages/contacts/${backendUserId}`),
      ])
      const inboxData: InboxEntry[] = inboxResult.status === 'fulfilled' ? inboxResult.value.data : []
      const contactsData: any[] = contactsResult.status === 'fulfilled' ? contactsResult.value.data : []
      setInbox(inboxData)
      // Contacts from games that don't yet have a DM thread
      const inboxIds = new Set(inboxData.map((i: InboxEntry) => i.otherUserId))
      const extraContacts: InboxEntry[] = contactsData.filter((c: any) => !inboxIds.has(c.otherUserId)).map((c: any) => ({
        otherUserId: c.otherUserId,
        otherUserName: c.otherUserName,
        otherUserPhoto: c.otherUserPhoto,
        otherUserVerified: c.otherUserVerified,
        lastMessage: '',
        lastMessageTime: '',
        unreadCount: 0,
      }))
      setContacts(extraContacts)
    } catch { /* ignore */ }
  }, [backendUserId])

  useEffect(() => {
    if (backendUserId) {
      setLoadingInbox(true)
      loadInbox().finally(() => setLoadingInbox(false))
    }
  }, [backendUserId, loadInbox])

  // Load conversation
  const loadConvo = useCallback(async (other: InboxEntry) => {
    if (!backendUserId) return
    setLoadingConvo(true)
    setGameEnded(false)
    setGameEndedReason('')
    try {
      const { data } = await api.get(`/messages/conversation/${backendUserId}/${other.otherUserId}`)
      setMessages(data)
      // Mark as read
      await api.post(`/messages/read/${backendUserId}/${other.otherUserId}`)
      setInbox(prev => prev.map(i => i.otherUserId === other.otherUserId ? { ...i, unreadCount: 0 } : i))
      // DMs are always allowed — no game lifecycle restrictions
      setAllowedToMessage(true)
    } catch { /* ignore */ }
    finally { setLoadingConvo(false) }
  }, [backendUserId])

  // Open conversation
  const openConvo = (entry: InboxEntry) => {
    setActiveConvo(entry)
    loadConvo(entry)
  }

  // Subscribe to websocket conversation updates when conversation is open
  useEffect(() => {
    let unsubConv: (() => void) | null = null
    let unsubUser: (() => void) | null = null
    let cancelled = false
    if (activeConvo && backendUserId) {
      const convId = `${Math.min(backendUserId, activeConvo.otherUserId)}-${Math.max(backendUserId, activeConvo.otherUserId)}`
      subscribeToConversation(convId, (msg: Message) => {
        if (cancelled) return
        // Skip own messages — sender already has optimistic/API copy
        if (msg.senderId === backendUserId) return
        setMessages(prev => {
          if (prev.some(p => p.id === msg.id)) return prev
          return [...prev, msg]
        })
      }).then(u => {
        if (cancelled) { if (u) u() } else { unsubConv = u ?? null }
      })

      subscribeToUserQueue(String(backendUserId), (msg: Message) => {
        if (cancelled) return
        // If this message is for the active conversation, append it
        if (msg.senderId === activeConvo.otherUserId || msg.receiverId === activeConvo.otherUserId) {
          setMessages(prev => prev.some(p => p.id === msg.id) ? prev : [...prev, msg])
        }
        loadInbox()
      }).then(u => {
        if (cancelled) { if (u) u() } else { unsubUser = u ?? null }
      })
    }
    return () => { cancelled = true; if (unsubConv) unsubConv(); if (unsubUser) unsubUser() }
  }, [activeConvo, backendUserId, loadInbox])

  // Scroll to bottom on new messages (DM and group)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, groupMessages])

  const sendMessage = async () => {
    const content = newMsg.trim()
    if (!content || !backendUserId || !activeConvo) return
    if (!allowedToMessage) { toast.error('Messaging disabled for this game until you are accepted.'); return }
    setSending(true)
    const optimistic: Message = {
      id: Date.now(),
      senderId: backendUserId,
      senderName: user?.displayName || 'You',
      senderPhotoUrl: user?.photoURL || null,
      receiverId: activeConvo.otherUserId,
      content,
      isRead: false,
      createdAt: new Date().toISOString()
    }
    setMessages(prev => [...prev, optimistic])
    setNewMsg('')
    try {
      // DMs are game-independent — always send with null gameId
      const { data: saved } = await api.post('/messages/send', {
        senderId: backendUserId,
        receiverId: activeConvo.otherUserId,
        content,
        gameId: null
      })
      // Replace optimistic message with real one (so WebSocket duplicate check matches)
      setMessages(prev => prev.map(m => m.id === optimistic.id ? { ...saved } : m))
      loadInbox()
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      setNewMsg(content)
      const errMsg = err?.response?.data?.error || err?.response?.data?.message || ''
      if (errMsg.toLowerCase().includes('active game')) {
        toast.error('Chat ended — you can only message players from an active game.')
        setAllowedToMessage(false)
      }
    }
    setSending(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
    // send typing indicator
    if (e.key && backendUserId && activeConvo) sendTyping(JSON.stringify({ typingUser: backendUserId, to: activeConvo.otherUserId }))
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
    if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' })
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  const filteredInbox = [...inbox, ...contacts].filter(i =>
    i.otherUserName.toLowerCase().includes(search.toLowerCase())
  )

  const totalUnread = inbox.reduce((sum, i) => sum + (i.unreadCount || 0), 0)

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="w-10 h-10 border-4 border-accent/30 border-t-accent rounded-full animate-spin" />
    </div>
  )

  if (!isAuthenticated) return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="text-center">
        <FiMessageCircle className="w-16 h-16 text-textSecondary mx-auto mb-4" />
        <p className="text-textPrimary font-semibold text-lg">Sign in to view messages</p>
      </div>
    </div>
  )

  const avatarUrl = (photoUrl: string | null, name: string) =>
    photoUrl || '/images/Profile_pic.jpg'

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-5xl mx-auto h-[calc(100vh-4rem)] flex">
        {/* ── Sidebar: Inbox ── */}
        <div className={`${(activeConvo || activeGroup) ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 border-r border-border bg-white`}>
          {/* Header */}
          <div className="px-4 py-4 border-b border-border flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-xl font-bold text-textPrimary">Messages</h1>
              <div className="flex items-center gap-2">
                <button onClick={() => { setShowRequestsPanel(s => !s); loadMyRequests(); }} className="text-sm px-2 py-1 bg-accent/10 rounded">Requests</button>
                {totalUnread > 0 && (
                  <span className="bg-accent text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {totalUnread}
                  </span>
                )}
              </div>
            </div>
            {/* DM / Group toggle */}
            <div className="flex gap-1.5 mb-3">
              <button onClick={() => { setChatMode('dm'); setActiveGroup(null) }}
                className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${chatMode === 'dm' ? 'bg-accent text-white' : 'bg-surface text-textSecondary hover:bg-accent/10'}`}>
                Direct
              </button>
              <button onClick={() => { setChatMode('group'); setActiveConvo(null) }}
                className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${chatMode === 'group' ? 'bg-accent text-white' : 'bg-surface text-textSecondary hover:bg-accent/10'}`}>
                Group Chats
              </button>
            </div>
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-textSecondary" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-surface rounded-xl border border-border focus:outline-none focus:border-accent/50 text-textPrimary placeholder:text-textSecondary"
              />
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto">
            {showRequestsPanel && (
              <div className="p-3 border-b border-border">
                <h3 className="text-sm font-semibold mb-2">Incoming Requests</h3>
                {myRequests?.requestsToMyGames?.length ? myRequests.requestsToMyGames.map((r: any) => (
                  <div key={r.id} className="flex items-start justify-between gap-2 mb-2 p-2 rounded border">
                    <div>
                      <div className="text-sm font-medium">{r.requester?.name || r.requester?.email}</div>
                      <div className="text-xs text-textSecondary">Game: {r.game?.title || `#${r.game?.id}`}</div>
                      <div className="text-xs mt-1">{r.message}</div>
                    </div>
                    <div className="flex flex-col gap-2">
                      {selectedGameId && r.game?.id === selectedGameId && (
                        <div className="text-[11px] px-2 py-0.5 bg-accentLight rounded text-accent text-xs">Selected game</div>
                      )}
                      {r.status === 'PENDING' && (
                        <>
                          <button onClick={async () => { try { await api.post(`/games/${r.game.id}/requests/${r.id}/accept`); await loadMyRequests(); await loadInbox(); toast.success('Accepted'); } catch (e:any) { toast.error(e.response?.data?.error || 'Failed') } }} className="btn-primary text-sm">Accept</button>
                          <button onClick={async () => { try { await api.post(`/games/${r.game.id}/requests/${r.id}/reject`); await loadMyRequests(); toast.info('Rejected'); } catch (e:any) { toast.error(e.response?.data?.error || 'Failed') } }} className="btn-secondary text-sm">Reject</button>
                        </>
                      )}
                      {r.status === 'ACCEPTED' && <span className="text-sm text-emerald-600">Accepted</span>}
                      {r.status === 'REJECTED' && <span className="text-sm text-rose-600">Rejected</span>}
                    </div>
                  </div>
                )) : <p className="text-xs text-textSecondary">No incoming requests</p>}

                <h3 className="text-sm font-semibold mt-3 mb-2">My Requests</h3>
                {myRequests?.requestsByMe?.length ? myRequests.requestsByMe.map((r:any) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 mb-2 p-2 rounded border">
                    <div>
                      <div className="text-sm">Game: {r.game?.title || `#${r.game?.id}`}</div>
                      <div className="text-xs text-textSecondary">Status: {r.status}</div>
                    </div>
                    <div>{r.status === 'PENDING' ? <span className="text-sm text-rose-600">Pending</span> : r.status === 'ACCEPTED' ? <span className="text-sm text-emerald-600">Accepted</span> : <span className="text-sm text-rose-600">Rejected</span>}</div>
                  </div>
                )) : <p className="text-xs text-textSecondary">No requests made</p>}
              </div>
            )}
            {loadingInbox ? (
              <div className="flex items-center justify-center py-12">
                <FiLoader className="w-6 h-6 text-accent animate-spin" />
              </div>
            ) : chatMode === 'group' ? (
              /* ── Group Chat List ── */
              groupChats.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <FiMessageCircle className="w-12 h-12 text-textSecondary mx-auto mb-3" />
                  <p className="text-textSecondary text-sm">No group chats yet. Join a game to start chatting!</p>
                </div>
              ) : (
                groupChats.map(g => (
                  <button key={g.gameId} onClick={() => openGroupChat(g)}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-surface transition-colors border-b border-border/50 text-left ${
                      activeGroup?.gameId === g.gameId ? 'bg-accentLight' : ''
                    }`}>
                    <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-xl flex-shrink-0">
                      👥
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-textPrimary truncate block">{g.gameTitle}</span>
                      <span className="text-xs text-textSecondary">{g.sport} · {g.memberCount} members</span>
                    </div>
                  </button>
                ))
              )
            ) : filteredInbox.length === 0 ? (
              <div className="text-center py-16 px-4">
                <FiMessageCircle className="w-12 h-12 text-textSecondary mx-auto mb-3" />
                <p className="text-textSecondary text-sm">
                  {search ? 'No conversations match your search.' : 'No messages yet. Start by joining a game!'}
                </p>
              </div>
            ) : (
              filteredInbox.map(entry => (
                <button
                  key={entry.otherUserId}
                  onClick={() => openConvo(entry)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-surface transition-colors border-b border-border/50 text-left ${
                    activeConvo?.otherUserId === entry.otherUserId ? 'bg-accentLight' : ''
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <img
                      src={avatarUrl(entry.otherUserPhoto, entry.otherUserName)}
                      alt={entry.otherUserName}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    {entry.otherUserVerified && (
                      <div className="absolute -bottom-0.5 -right-0.5 bg-accent rounded-full p-px">
                        <MdVerified className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-sm truncate ${entry.unreadCount > 0 ? 'font-bold text-textPrimary' : 'font-medium text-textPrimary'}`}>
                        {entry.otherUserName}
                      </span>
                      <span className="text-xs text-textSecondary flex-shrink-0">{formatTime(entry.lastMessageTime)}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <p className={`text-xs truncate ${entry.unreadCount > 0 ? 'text-textPrimary font-medium' : 'text-textSecondary'}`}>
                        {entry.lastMessage}
                      </p>
                      {entry.unreadCount > 0 && (
                        <span className="flex-shrink-0 w-4 h-4 bg-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                          {entry.unreadCount > 9 ? '9+' : entry.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Conversation Panel ── */}
        <div className={`${(activeConvo || activeGroup) ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-white`}>
          {/* ── GROUP CHAT PANEL ── */}
          {activeGroup ? (
            <>
              <div className="px-4 py-3 border-b border-border flex items-center gap-3 flex-shrink-0 bg-white">
                <button onClick={() => setActiveGroup(null)} className="md:hidden p-1.5 rounded-lg hover:bg-surface transition-colors">
                  <FiArrowLeft className="w-5 h-5 text-textSecondary" />
                </button>
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-lg">👥</div>
                <div>
                  <p className="font-semibold text-textPrimary text-sm">{activeGroup.gameTitle}</p>
                  <p className="text-xs text-textSecondary">{groupMembers.length} members</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {loadingGroup ? (
                  <div className="flex items-center justify-center py-12">
                    <FiLoader className="w-6 h-6 text-accent animate-spin" />
                  </div>
                ) : groupMessages.length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-textSecondary text-sm">No messages yet. Say hello to the group!</p>
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {groupMessages.map(msg => {
                      const isMe = msg.senderId === backendUserId
                      return (
                        <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                          className={`flex ${isMe ? 'justify-end' : 'justify-start'} gap-2`}>
                          {!isMe && (
                            <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent flex-shrink-0 self-end">
                              {msg.senderName?.[0]?.toUpperCase() || '?'}
                            </div>
                          )}
                          <div className={`max-w-[70%] flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                            {!isMe && <span className="text-[10px] text-accent font-medium px-1">{msg.senderName}</span>}
                            <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                              isMe ? 'bg-accent text-white rounded-br-sm' : 'bg-surface text-textPrimary rounded-bl-sm border border-border'
                            }`}>{msg.content}</div>
                            <span className="text-[11px] text-textSecondary px-1">{formatTime(msg.createdAt)}</span>
                          </div>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="px-4 py-3 border-t border-border flex-shrink-0 bg-white">
                <div className="flex items-end gap-2">
                  <textarea value={newGroupMsg} onChange={e => setNewGroupMsg(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendGroupMessage() } }}
                    placeholder="Message the group..." rows={1}
                    className="flex-1 resize-none px-4 py-2.5 text-sm bg-surface rounded-xl border border-border focus:outline-none focus:border-accent/50 text-textPrimary placeholder:text-textSecondary max-h-28 overflow-y-auto"
                    style={{ minHeight: '42px' }} />
                  <button onClick={sendGroupMessage} disabled={!newGroupMsg.trim() || sendingGroup}
                    className="flex-shrink-0 w-10 h-10 rounded-xl bg-accent hover:bg-accentDark disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors">
                    {sendingGroup ? <FiLoader className="w-4 h-4 text-white animate-spin" /> : <FiSend className="w-4 h-4 text-white" />}
                  </button>
                </div>
              </div>
            </>
          ) : !activeConvo ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <FiMessageCircle className="w-16 h-16 text-textSecondary mx-auto mb-4" />
                <p className="text-textPrimary font-semibold text-lg">Select a conversation</p>
                <p className="text-textSecondary text-sm mt-1">Choose a chat from the left to start messaging</p>
              </div>
            </div>
          ) : (
            <>
              {/* Conversation Header */}
              <div className="px-4 py-3 border-b border-border flex items-center gap-3 flex-shrink-0 bg-white">
                <button
                  onClick={() => setActiveConvo(null)}
                  className="md:hidden p-1.5 rounded-lg hover:bg-surface transition-colors"
                >
                  <FiArrowLeft className="w-5 h-5 text-textSecondary" />
                </button>
                <div className="relative">
                  <img
                    src={avatarUrl(activeConvo.otherUserPhoto, activeConvo.otherUserName)}
                    alt={activeConvo.otherUserName}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  {activeConvo.otherUserVerified && (
                    <div className="absolute -bottom-0.5 -right-0.5 bg-accent rounded-full p-px">
                      <MdVerified className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-textPrimary text-sm">{activeConvo.otherUserName}</p>
                    {activeConvo.otherUserVerified && (
                      <MdVerified className="w-4 h-4 text-accent" />
                    )}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {loadingConvo ? (
                  <div className="flex items-center justify-center py-12">
                    <FiLoader className="w-6 h-6 text-accent animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-textSecondary text-sm">No messages yet. Say hello!</p>
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {messages.map(msg => {
                      const isMe = msg.senderId === backendUserId
                      const loc = parseMapsLink(msg.content)
                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex ${isMe ? 'justify-end' : 'justify-start'} gap-2`}
                        >
                          {!isMe && (
                            <img
                              src={avatarUrl(activeConvo.otherUserPhoto, activeConvo.otherUserName)}
                              alt=""
                              className="w-7 h-7 rounded-full object-cover flex-shrink-0 self-end"
                            />
                          )}
                          <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>                            {!isMe && <span className="text-[10px] text-accent font-medium px-1">{activeConvo.otherUserName}</span>}                            <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                              isMe
                                ? 'bg-accent text-white rounded-br-sm'
                                : 'bg-surface text-textPrimary rounded-bl-sm border border-border'
                            }`}>
                              {msg.content}
                            </div>
                            {loc && (
                              <div className="w-full mt-1 rounded-xl overflow-hidden border border-border">
                                <MapContainer center={loc} zoom={15} className="w-full h-40">
                                  <TileLayer
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    attribution="&copy; OpenStreetMap contributors"
                                  />
                                  <Marker position={loc} icon={msgIcon} />
                                </MapContainer>
                              </div>
                            )}
                            <span className="text-[11px] text-textSecondary px-1">{formatTime(msg.createdAt)}</span>
                          </div>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="px-4 py-3 border-t border-border flex-shrink-0 bg-white">
                <div className="flex items-end gap-2">
                  <textarea
                    value={newMsg}
                    onChange={e => setNewMsg(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={!allowedToMessage ? 'Messaging disabled until request accepted.' : 'Type a message... (Enter to send)'}
                    rows={1}
                    disabled={!allowedToMessage}
                    className="flex-1 resize-none px-4 py-2.5 text-sm bg-surface rounded-xl border border-border focus:outline-none focus:border-accent/50 text-textPrimary placeholder:text-textSecondary max-h-28 overflow-y-auto disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ minHeight: '42px' }}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMsg.trim() || sending || !allowedToMessage}
                    className="flex-shrink-0 w-10 h-10 rounded-xl bg-accent hover:bg-accentDark disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                  >
                    {sending
                      ? <FiLoader className="w-4 h-4 text-white animate-spin" />
                      : <FiSend className="w-4 h-4 text-white" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLocationModal(true)}
                    disabled={!allowedToMessage}
                    className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors ml-1"
                    title="Send Location"
                  >
                    <FiMapPin className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>

              {/* Location Modal */}
              {showLocationModal && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg shadow-lg p-4 max-w-xl w-full relative">
                    <button className="absolute top-2 right-2 text-lg" onClick={() => setShowLocationModal(false)}>&times;</button>
                    <h2 className="text-lg font-semibold mb-2">Share Location</h2>
                    <ProfileLocationPicker
                value={locationCoords || undefined}
                onChange={(latlng, addr) => {
                  setLocationCoords(latlng)
                  setLocationAddress(addr)
                }}
              />
                    <div className="mt-3 flex gap-2">
                      <input
                        type="text"
                        className="input-field flex-1"
                        placeholder="Address (auto-filled)"
                        value={locationAddress}
                        onChange={e => setLocationAddress(e.target.value)}
                        readOnly
                      />
                      <button
                        className="btn-primary"
                        disabled={!locationCoords}
                        onClick={async () => {
                          if (!locationCoords || !backendUserId || !activeConvo) return
                          const mapsUrl = `https://maps.google.com/?q=${locationCoords.lat},${locationCoords.lng}`
                          const content = `${locationAddress ? locationAddress + '\n' : ''}${mapsUrl}`
                          setShowLocationModal(false)
                          // Send directly with content to avoid stale state
                          setSending(true)
                          const optimistic: Message = {
                            id: Date.now(),
                            senderId: backendUserId,
                            senderName: user?.displayName || 'You',
                            senderPhotoUrl: user?.photoURL || null,
                            receiverId: activeConvo.otherUserId,
                            content,
                            isRead: false,
                            createdAt: new Date().toISOString()
                          }
                          setMessages(prev => [...prev, optimistic])
                          try {
                            await api.post('/messages/send', {
                              senderId: backendUserId,
                              receiverId: activeConvo.otherUserId,
                              content,
                              gameId: null
                            })
                            loadInbox()
                          } catch (err: any) {
                            setMessages(prev => prev.filter(m => m.id !== optimistic.id))
                            const errMsg = err?.response?.data?.error || ''
                            if (errMsg.toLowerCase().includes('active game')) {
                              toast.error('Chat ended \u2014 you can only message players from an active game.')
                              setAllowedToMessage(false)
                            }
                          }
                          setSending(false)
                        }}
                      >Send</button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
