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

// 方向节点数据
export type DirectionStatus = 'idle' | 'loading' | 'confirmed' | 'pending'

export type DirectionNodeData = {
  title: string
  summary: string
  keywords: string[]
  status: DirectionStatus
  depth: number          // 0=根想法, 1=一级方向, 2+=子方向
  parentNodeId: string | null
  opinionDraft: string   // 内联输入框的值
  isExpanding: boolean   // true=显示输入框
}

// 想法节点（根节点）
export type IdeaNodeData = {
  idea: string
  status: 'idle' | 'generating'
}

// === ReactFlow 节点类型 ===

export type TextCanvasNode = Node<TextNodeData, 'text'>
export type ChatCanvasNode = Node<ChatNodeData, 'chat'>
export type DirectionCanvasNode = Node<DirectionNodeData, 'direction'>
export type IdeaCanvasNode = Node<IdeaNodeData, 'idea'>
export type CanvasNode = TextCanvasNode | ChatCanvasNode | DirectionCanvasNode | IdeaCanvasNode

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

// 方向生成接口
export type Direction = {
  title: string
  summary: string
  keywords: string[]
}

export type DirectionRequest = {
  idea: string
  parentContext?: {
    parentTitle: string
    parentSummary: string
    userOpinion: string
    ancestorTitles: string[]
  }
}

export interface AIClient {
  streamChat(input: ChatRequest, signal?: AbortSignal): AsyncGenerator<ChatChunk>
  generateDirections(input: DirectionRequest, signal?: AbortSignal): Promise<Direction[]>
}
