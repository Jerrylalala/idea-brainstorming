// src/types/session.ts
import type { CanvasNode, CanvasEdge } from '@/canvas/types'

export type SessionStatus = 'backlog' | 'todo' | 'needs-review' | 'done' | 'archived'

export interface CanvasSnapshot {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

export interface SessionItem {
  id: string
  title: string
  createdAt: string  // ISO 8601，如 "2026-03-20T14:30:00Z"
  time: string
  status?: SessionStatus
  canvasSnapshot?: CanvasSnapshot  // 画布快照，用于 session 切换时恢复
}
