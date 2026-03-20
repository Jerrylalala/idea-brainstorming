// src/store/session-store.ts
import { create } from 'zustand'
import type { SessionItem, SessionStatus } from '@/types/session'
import { mockSessions } from '@/data/mock-sessions'
import { useCanvasStore } from '@/canvas/store/canvas-store'

interface SessionState {
  sessions: SessionItem[]
  activeSessionId: string | null
  activeFilter: SessionStatus | null
  setActiveSessionId: (id: string) => void
  setFilter: (filter: SessionStatus | null) => void
  createSession: () => void
  updateSessionTitle: (id: string, title: string) => void
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: mockSessions,
  activeSessionId: mockSessions.find((item) => item.isActive)?.id ?? null,
  activeFilter: null,

  setActiveSessionId: (id) => {
    const { activeSessionId, sessions } = get()
    if (id === activeSessionId) return

    // 1. 保存当前画布快照到当前 session
    const { nodes, edges } = useCanvasStore.getState()
    const updatedSessions = sessions.map((s) =>
      s.id === activeSessionId
        ? { ...s, canvasSnapshot: { nodes, edges } }
        : s
    )

    // 2. 加载目标 session 的画布快照
    const target = updatedSessions.find((s) => s.id === id)
    if (target?.canvasSnapshot) {
      useCanvasStore.getState().loadSnapshot(target.canvasSnapshot)
    } else {
      useCanvasStore.getState().clearCanvas()
    }

    set({ sessions: updatedSessions, activeSessionId: id })
  },

  setFilter: (filter) => set({ activeFilter: filter }),

  createSession: () => {
    const { activeSessionId, sessions } = get()

    // 1. 保存当前画布快照
    const { nodes, edges } = useCanvasStore.getState()

    // 2. 清空画布（新 session 从空白开始）
    useCanvasStore.getState().clearCanvas()

    const newSession: SessionItem = {
      id: `session-${Date.now()}`,
      title: 'New chat',
      time: 'now',
      group: 'TODAY',
      status: 'todo',
    }

    set({
      sessions: [
        newSession,
        ...sessions.map((item) => ({
          ...item,
          isActive: false,
          ...(item.id === activeSessionId ? { canvasSnapshot: { nodes, edges } } : {}),
        })),
      ],
      activeSessionId: newSession.id,
      activeFilter: null,
    })
  },

  updateSessionTitle: (id, title) => {
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === id ? { ...sess, title } : sess
      ),
    }))
  },
}))
