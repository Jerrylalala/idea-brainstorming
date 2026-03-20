// src/types/session.ts
import type { CanvasNode, CanvasEdge } from '@/canvas/types'

export type SessionGroup = 'TODAY' | 'YESTERDAY'
export type SessionStatus = 'backlog' | 'todo' | 'needs-review' | 'done' | 'archived'

export interface CanvasSnapshot {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

export interface SessionItem {
  id: string
  title: string
  time: string
  group: SessionGroup
  status?: SessionStatus
  canvasSnapshot?: CanvasSnapshot  // 画布快照，用于 session 切换时恢复
}
