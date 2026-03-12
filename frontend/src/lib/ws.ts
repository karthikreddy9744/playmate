import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

type StompClient = InstanceType<typeof Client>

const WS_URL = import.meta.env.VITE_WS_BASE_URL?.trim() || '/ws'

let client: StompClient | null = null
let connectingPromise: Promise<StompClient | null> | null = null

export async function connectWebsocket(onConnect?: () => void): Promise<StompClient | null> {
  if (client?.connected) return client
  if (connectingPromise) return connectingPromise

  connectingPromise = new Promise<StompClient | null>((resolve) => {
    try {
      if (client) { try { client.deactivate() } catch (_) {} }

      const c = new Client({
        webSocketFactory: () => new (SockJS as any)(WS_URL),
        reconnectDelay: 5000,
      })

      const timeout = setTimeout(() => {
        console.warn('[ws] connect timeout')
        connectingPromise = null
        resolve(null)
      }, 8000)

      c.onConnect = () => {
        clearTimeout(timeout)
        client = c
        connectingPromise = null
        if (onConnect) onConnect()
        resolve(c)
      }
      c.onStompError = () => {
        clearTimeout(timeout)
        client = null
        connectingPromise = null
        resolve(null)
      }
      c.onWebSocketError = () => {
        clearTimeout(timeout)
        client = null
        connectingPromise = null
        resolve(null)
      }
      c.activate()
    } catch (err) {
      console.warn('[ws] STOMP/SockJS not available:', err)
      client = null
      connectingPromise = null
      resolve(null)
    }
  })

  return connectingPromise
}

export async function subscribeToConversation(convId: string, handler: (msg: any) => void) {
  const c = await connectWebsocket()
  if (!c) return
  try {
    const sub = c.subscribe(`/topic/conversation/${convId}`, (m: any) => {
      const body = JSON.parse(m.body)
      handler(body)
    })
    return () => sub.unsubscribe()
  } catch (e) { console.warn('[ws] subscribe failed', e) }
}

export async function subscribeToUserQueue(userId: string, handler: (msg: any) => void) {
  const c = await connectWebsocket()
  if (!c) return
  try {
    const sub = c.subscribe(`/user/${userId}/queue/messages`, (m: any) => {
      const body = JSON.parse(m.body)
      handler(body)
    })
    return () => sub.unsubscribe()
  } catch (e) { console.warn('[ws] subscribeToUserQueue failed', e) }
}

export async function sendTyping(payload: string) {
  const c = await connectWebsocket()
  if (!c) return
  try { c.publish({ destination: '/app/chat/typing', body: payload }) } catch (e) {}
}

export async function sendMessageOverWs(msg: any) {
  const c = await connectWebsocket()
  if (!c) return
  try { c.publish({ destination: '/app/chat/message', body: JSON.stringify(msg) }) } catch (e) {}
}

export async function subscribeToGameGroup(gameId: number, handler: (msg: any) => void) {
  const c = await connectWebsocket()
  if (!c) return
  try {
    const sub = c.subscribe(`/topic/game-group/${gameId}`, (m: any) => {
      const body = JSON.parse(m.body)
      handler(body)
    })
    return () => sub.unsubscribe()
  } catch (e) { console.warn('[ws] subscribeToGameGroup failed', e) }
}

export function disconnectWs() {
  try { if (client) client.deactivate(); client = null } catch (e) {}
}
