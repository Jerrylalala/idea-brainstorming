// src/store/session-store.ts
import { create } from 'zustand'
import type { SessionItem, SessionStatus } from '@/types/session'
import { mockSessions } from '@/data/mock-sessions'
import { useCanvasStore } from '@/canvas/store/canvas-store'

interface SessionState {
  sessions: SessionItem[]
  activeSessionId: string | null
  activeFilter: SessionStatus | null
  pendingDeletion: SessionItem | null
  _deleteTimer: ReturnType<typeof setTimeout> | null
  setActiveSessionId: (id: string) => void
  setFilter: (filter: SessionStatus | null) => void
  createSession: () => void
  deleteSession: (id: string) => void
  restoreSession: () => void
  archiveSession: (id: string) => void
  setSessionStatus: (id: string, status: SessionStatus) => void
  updateSessionTitle: (id: string, title: string) => void
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: mockSessions,
  activeSessionId: mockSessions[0]?.id ?? null,
  activeFilter: null,
  pendingDeletion: null,
  _deleteTimer: null,

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
          ...(item.id === activeSessionId ? { canvasSnapshot: { nodes, edges } } : {}),
        })),
      ],
      activeSessionId: newSession.id,
      activeFilter: null,
    })
  },

  deleteSession: (id) => {
    const { sessions, activeSessionId, _deleteTimer } = get()
    const target = sessions.find((s) => s.id === id)
    if (!target) return

    const remaining = sessions.filter((s) => s.id !== id)

    // 切换 active session 的后备逻辑
    let newActiveId: string | null = activeSessionId
    if (id === activeSessionId) {
      const idx = sessions.findIndex((s) => s.id === id)
      newActiveId = remaining[idx]?.id ?? remaining[idx - 1]?.id ?? null

      if (newActiveId) {
        const next = remaining.find((s) => s.id === newActiveId)
        if (next?.canvasSnapshot) {
          useCanvasStore.getState().loadSnapshot(next.canvasSnapshot)
        } else {
          useCanvasStore.getState().clearCanvas()
        }
      } else {
        useCanvasStore.getState().clearCanvas()
      }
    }

    if (_deleteTimer) clearTimeout(_deleteTimer)

    const timer = setTimeout(() => {
      set({ pendingDeletion: null, _deleteTimer: null })
    }, 5000)

    set({ sessions: remaining, activeSessionId: newActiveId, pendingDeletion: target, _deleteTimer: timer })
  },

  restoreSession: () => {
    const { pendingDeletion, sessions, _deleteTimer } = get()
    if (!pendingDeletion) return
    if (_deleteTimer) clearTimeout(_deleteTimer)
    set({ sessions: [pendingDeletion, ...sessions], pendingDeletion: null, _deleteTimer: null })
  },

  setSessionStatus: (id, status) => {
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === id ? { ...sess, status } : sess
      ),
    }))
  },

  archiveSession: (id) => {
    get().setSessionStatus(id, 'archived')
  },

  updateSessionTitle: (id, title) => {
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === id ? { ...sess, title } : sess
      ),
    }))
  },
}))
