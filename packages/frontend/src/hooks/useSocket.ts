import { useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

type Handler = (data: unknown) => void

export function useSocket(slug: string | null, handlers: Record<string, Handler>) {
  const socketRef = useRef<Socket | null>(null)
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    const socket = io('/', { path: '/socket.io', transports: ['websocket'] })
    socketRef.current = socket

    socket.on('connect', () => {
      if (slug) socket.emit('subscribe:restaurant', slug)
    })

    const events = Object.keys(handlersRef.current)
    events.forEach((ev) => {
      socket.on(ev, (data: unknown) => handlersRef.current[ev]?.(data))
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [slug])

  const emit = useCallback((event: string, data?: unknown) => {
    socketRef.current?.emit(event, data)
  }, [])

  return { emit }
}
