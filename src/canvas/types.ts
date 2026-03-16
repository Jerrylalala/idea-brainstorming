import type { Node, Edge } from '@xyflow/react'

// === 数据模型 ===

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  createdAt: number
}

export type SourceRef = {
  nodeId: string
  messageId?: string
  quotedText?: string
  range?: { start: number; end: number }
}

export type TextNodeData = {
  title: string
  content: string
  format: 'plain' | 'markdown'
  source?: {
    kind: 'manual' | 'upload' | 'expanded-chat'
    fromNodeId?: string
    fromMessageId?: string
  }
}

export type ChatNodeData = {
  title: string
  draft: string
  status: 'idle' | 'streaming' | 'error'
  sourceRefs: SourceRef[]
  messages: ChatMessage[]
}

// === ReactFlow 节点类型 ===

export type TextCanvasNode = Node<TextNodeData, 'text'>
export type ChatCanvasNode = Node<ChatNodeData, 'chat'>
export type CanvasNode = TextCanvasNode | ChatCanvasNode

// === ReactFlow 边类型 ===

export type EdgeRelation = 'quote' | 'branch' | 'derived'

export type ReferenceEdgeData = {
  relation: EdgeRelation
  sourceRef?: SourceRef
}

export type CanvasEdge = Edge<ReferenceEdgeData>

// === AI 接口 ===

export type ChatRequest = {
  messages: ChatMessage[]
  sourceRefs: SourceRef[]
}

export type ChatChunk = {
  type: 'delta' | 'done' | 'error'
  text?: string
  error?: string
}

export interface AIClient {
  streamChat(input: ChatRequest): AsyncGenerator<ChatChunk>
}
