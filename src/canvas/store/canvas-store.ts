import { create } from 'zustand'
import {
  applyNodeChanges, applyEdgeChanges,
  type NodeChange, type EdgeChange,
} from '@xyflow/react'
import type {
  CanvasNode, CanvasEdge, ChatCanvasNode,
  ChatMessage, SourceRef,
} from '../types'
import { createTextNode, createChatNode, createEdge } from '../lib/node-factory'
import { aiClient } from '../lib/ai-client'
import { buildSystemPrompt, buildMessages } from '../lib/prompt-builder'

interface CanvasState {
  nodes: CanvasNode[]
  edges: CanvasEdge[]

  // ReactFlow 回调
  onNodesChange: (changes: NodeChange<CanvasNode>[]) => void
  onEdgesChange: (changes: EdgeChange<CanvasEdge>[]) => void

  // 节点操作
  addTextNode: (position: { x: number; y: number }, content?: string) => string
  addChatFromEdge: (sourceNodeId: string, position: { x: number; y: number }) => string
  addChatFromQuote: (sourceNodeId: string, quotedText: string, position: { x: number; y: number }) => string
  expandNote: (chatNodeId: string, messageId: string) => string | null

  // 对话操作
  updateDraft: (nodeId: string, draft: string) => void
  sendMessage: (nodeId: string) => void
  updateTextContent: (nodeId: string, content: string) => void
  deleteNode: (nodeId: string) => void
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [
    createTextNode({ x: 100, y: 200 }, '在这里写下你的想法...\n\n双击编辑，从右侧圆点拖出连线创建对话。'),
  ],
  edges: [],

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) as CanvasNode[] })
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) as CanvasEdge[] })
  },

  addTextNode: (position, content = '') => {
    const node = createTextNode(position, content)
    set((s) => ({ nodes: [...s.nodes, node] }))
    return node.id
  },

  addChatFromEdge: (sourceNodeId, position) => {
    const sourceNode = get().nodes.find((n) => n.id === sourceNodeId)
    if (!sourceNode) return ''

    const quotedText = sourceNode.type === 'text'
      ? (sourceNode.data as { content: string }).content
      : undefined

    const sourceRef: SourceRef = { nodeId: sourceNodeId, quotedText }
    const chatNode = createChatNode(position, [sourceRef])
    const edge = createEdge(sourceNodeId, chatNode.id, 'quote', sourceRef)

    set((s) => ({
      nodes: [...s.nodes, chatNode],
      edges: [...s.edges, edge],
    }))
    return chatNode.id
  },

  addChatFromQuote: (sourceNodeId, quotedText, position) => {
    const sourceRef: SourceRef = { nodeId: sourceNodeId, quotedText }
    const chatNode = createChatNode(position, [sourceRef])
    const edge = createEdge(sourceNodeId, chatNode.id, 'branch', sourceRef)

    set((s) => ({
      nodes: [...s.nodes, chatNode],
      edges: [...s.edges, edge],
    }))
    return chatNode.id
  },

  expandNote: (chatNodeId, messageId) => {
    const chatNode = get().nodes.find(
      (n) => n.id === chatNodeId && n.type === 'chat'
    ) as ChatCanvasNode | undefined
    if (!chatNode) return null

    const message = chatNode.data.messages.find((m) => m.id === messageId)
    if (!message || message.role !== 'assistant') return null

    const textNode = createTextNode(
      {
        x: chatNode.position.x + 400,
        y: chatNode.position.y,
      },
      message.text,
      {
        format: 'markdown',
        source: {
          kind: 'expanded-chat',
          fromNodeId: chatNodeId,
          fromMessageId: messageId,
        },
      }
    )
    const edge = createEdge(chatNodeId, textNode.id, 'derived')

    set((s) => ({
      nodes: [...s.nodes, textNode],
      edges: [...s.edges, edge],
    }))
    return textNode.id
  },

  updateDraft: (nodeId, draft) => {
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId && n.type === 'chat'
          ? { ...n, data: { ...n.data, draft } }
          : n
      ) as CanvasNode[],
    }))
  },

  sendMessage: async (nodeId) => {
    const node = get().nodes.find(
      (n) => n.id === nodeId && n.type === 'chat'
    ) as ChatCanvasNode | undefined
    if (!node || !node.data.draft.trim()) return

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      text: node.data.draft.trim(),
      createdAt: Date.now(),
    }

    // 添加用户消息，清空草稿，设为 streaming
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId && n.type === 'chat'
          ? {
              ...n,
              data: {
                ...n.data,
                draft: '',
                status: 'streaming' as const,
                messages: [...(n.data as ChatCanvasNode['data']).messages, userMsg],
              },
            }
          : n
      ) as CanvasNode[],
    }))

    // 构建 prompt 并流式调用 AI
    const currentNode = get().nodes.find((n) => n.id === nodeId) as ChatCanvasNode
    const systemPrompt = buildSystemPrompt(currentNode.data.sourceRefs)
    const fullMessages = buildMessages(systemPrompt, currentNode.data.messages)

    const assistantMsgId = `msg-${Date.now()}-assistant`
    let fullText = ''

    try {
      const stream = aiClient.streamChat({
        messages: fullMessages,
        sourceRefs: currentNode.data.sourceRefs,
      })

      for await (const chunk of stream) {
        if (chunk.type === 'delta' && chunk.text) {
          fullText += chunk.text

          const assistantMsg: ChatMessage = {
            id: assistantMsgId,
            role: 'assistant',
            text: fullText,
            createdAt: Date.now(),
          }

          set((s) => ({
            nodes: s.nodes.map((n) => {
              if (n.id !== nodeId || n.type !== 'chat') return n
              const chatData = n.data as ChatCanvasNode['data']
              const msgs = chatData.messages.filter((m) => m.id !== assistantMsgId)
              return {
                ...n,
                data: { ...chatData, messages: [...msgs, assistantMsg] },
              }
            }) as CanvasNode[],
          }))
        }

        if (chunk.type === 'error') {
          set((s) => ({
            nodes: s.nodes.map((n) =>
              n.id === nodeId && n.type === 'chat'
                ? { ...n, data: { ...n.data, status: 'error' as const } }
                : n
            ) as CanvasNode[],
          }))
          return
        }
      }

      // 流完成
      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.id === nodeId && n.type === 'chat'
            ? { ...n, data: { ...n.data, status: 'idle' as const } }
            : n
        ) as CanvasNode[],
      }))
    } catch {
      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.id === nodeId && n.type === 'chat'
            ? { ...n, data: { ...n.data, status: 'error' as const } }
            : n
        ) as CanvasNode[],
      }))
    }
  },

  updateTextContent: (nodeId, content) => {
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId && n.type === 'text'
          ? { ...n, data: { ...n.data, content } }
          : n
      ) as CanvasNode[],
    }))
  },

  deleteNode: (nodeId) => {
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== nodeId),
      edges: s.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    }))
  },
}))
