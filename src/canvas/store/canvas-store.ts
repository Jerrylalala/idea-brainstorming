import { create } from 'zustand'
import {
  applyNodeChanges, applyEdgeChanges,
  type NodeChange, type EdgeChange,
} from '@xyflow/react'
import type {
  CanvasNode, CanvasEdge, ChatCanvasNode, DirectionCanvasNode, DirectionNodeData,
  ChatMessage, SourceRef,
} from '../types'
import { createTextNode, createChatNode, createEdge, createDirectionNode, createIdeaNode } from '../lib/node-factory'
import { aiClient } from '../lib/ai-client'
import { buildSystemPrompt, buildMessages } from '../lib/prompt-builder'
import { setPendingFocusNodes } from '../hooks/use-auto-layout'

interface CanvasState {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  lastDeleted: { nodes: CanvasNode[]; edges: CanvasEdge[] } | null

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
  undoDelete: () => void

  // 方向树操作
  searchIdea: (idea: string) => Promise<void>
  startExpanding: (nodeId: string) => void
  cancelExpanding: (nodeId: string) => void
  updateOpinionDraft: (nodeId: string, draft: string) => void
  submitOpinion: (nodeId: string) => Promise<void>
  confirmDirection: (nodeId: string) => void
  pendingDirection: (nodeId: string) => void

  // 面板数据（派生状态）
  confirmedDirections: () => DirectionNodeData[]
  pendingDirections: () => DirectionNodeData[]

  // 面板操作
  removeFromPanel: (nodeId: string) => void
  moveToCategory: (nodeId: string, newStatus: 'confirmed' | 'pending' | 'idle') => void

  // 布局操作
  layoutVersion: number
  layoutNodes: () => void
}

export const useCanvasStore = create<CanvasState>((set, get) => {
  let undoTimer: ReturnType<typeof setTimeout> | null = null
  let currentSearchVersion = 0  // 版本号，用于取消过期的搜索请求

  return {
  nodes: [],  // 初始为空，等待用户搜索
  edges: [],
  lastDeleted: null,
  layoutVersion: 0,

  onNodesChange: (changes) => {
    const removes: NodeChange<CanvasNode>[] = []
    const others: NodeChange<CanvasNode>[] = []
    for (const c of changes) {
      if (c.type === 'remove') removes.push(c)
      else others.push(c)
    }

    if (others.length > 0) {
      set({ nodes: applyNodeChanges(others, get().nodes) as CanvasNode[] })
    }

    // Delete 键触发的 remove 变更走自定义删除逻辑（级联 + 设置 lastDeleted）
    removes.forEach(c => get().deleteNode((c as { id: string }).id))
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

      // 80ms 批量缓冲，减少渲染次数
      let buffer = ''
      let flushTimer: ReturnType<typeof setTimeout> | null = null

      const flush = () => {
        fullText += buffer
        buffer = ''
        flushTimer = null

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

      for await (const chunk of stream) {
        if (chunk.type === 'delta' && chunk.text) {
          buffer += chunk.text
          if (!flushTimer) {
            flushTimer = setTimeout(flush, 80)
          }
        }

        if (chunk.type === 'error') {
          if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
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

      // 最后一次 flush
      if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
      if (buffer) flush()

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
    const { nodes, edges } = get()

    // 递归收集所有后代节点 ID（direction 节点通过 parentNodeId 关联）
    const collectDescendants = (id: string, collected: Set<string>) => {
      collected.add(id)
      nodes
        .filter(n => n.type === 'direction' && (n as DirectionCanvasNode).data.parentNodeId === id)
        .forEach(child => collectDescendants(child.id, collected))
    }

    const toDelete = new Set<string>()
    collectDescendants(nodeId, toDelete)

    const deletedNodes = nodes.filter(n => toDelete.has(n.id))
    const deletedEdges = edges.filter(e => toDelete.has(e.source) || toDelete.has(e.target))

    // 保存快照用于撤销（包含整棵子树）
    set({
      lastDeleted: { nodes: deletedNodes, edges: deletedEdges },
      nodes: nodes.filter(n => !toDelete.has(n.id)),
      edges: edges.filter(e => !toDelete.has(e.source) && !toDelete.has(e.target)),
    })

    // 5 秒后自动清除快照
    if (undoTimer) clearTimeout(undoTimer)
    undoTimer = setTimeout(() => {
      set({ lastDeleted: null })
      undoTimer = null
    }, 5000)
  },

  undoDelete: () => {
    const { lastDeleted } = get()
    if (!lastDeleted) return
    if (undoTimer) { clearTimeout(undoTimer); undoTimer = null }
    set((s) => ({
      nodes: [...s.nodes, ...lastDeleted.nodes],
      edges: [...s.edges, ...lastDeleted.edges],
      lastDeleted: null,
    }))
  },

  // === 方向树操作 ===

  searchIdea: async (idea) => {
    const myVersion = ++currentSearchVersion

    // 1. 清除现有 direction/idea 节点（保留 text/chat）
    set((s) => ({
      nodes: s.nodes.filter(n => n.type !== 'direction' && n.type !== 'idea'),
      edges: s.edges.filter(e => {
        const sourceNode = s.nodes.find(n => n.id === e.source)
        const targetNode = s.nodes.find(n => n.id === e.target)
        return sourceNode?.type !== 'direction' && sourceNode?.type !== 'idea' &&
               targetNode?.type !== 'direction' && targetNode?.type !== 'idea'
      }),
    }))

    // 2. 在画布左侧创建 IdeaNode
    const ideaNode = createIdeaNode({ x: 100, y: 300 }, idea)
    set((s) => ({ nodes: [...s.nodes, ideaNode] }))

    // 3. 设置生成状态
    set((s) => ({
      nodes: s.nodes.map(n =>
        n.id === ideaNode.id ? { ...n, data: { ...n.data, status: 'generating' as const } } : n
      ) as CanvasNode[],
    }))

    // 4. 调用 AI 生成方向
    try {
      const directions = await aiClient.generateDirections({ idea })

      // 新搜索已发起，丢弃本次结果
      if (myVersion !== currentSearchVersion) return

      // 5. 创建 DirectionNode 数组（初始位置在父节点右侧，避免飞入动画）
      const parentPos = ideaNode.position || { x: 100, y: 300 }
      const directionNodes = directions.map((dir, i) =>
        createDirectionNode(
          { x: parentPos.x + 570, y: parentPos.y + i * 60 },
          dir.title, dir.summary, dir.keywords, 1, ideaNode.id
        )
      )

      const newEdges = directionNodes.map(node =>
        createEdge(ideaNode.id, node.id, 'derived')
      )

      // 7. 更新 store 并执行布局
      set((s) => ({
        nodes: [
          ...s.nodes.map(n =>
            n.id === ideaNode.id ? { ...n, data: { ...n.data, status: 'idle' as const } } : n
          ),
          ...directionNodes,
        ] as CanvasNode[],
        edges: [...s.edges, ...newEdges],
      }))

      // 8. 设置聚焦目标并执行自动布局
      setPendingFocusNodes(ideaNode.id, directionNodes.map(n => n.id))
      get().layoutNodes()
    } catch (err) {
      if (myVersion !== currentSearchVersion) return
      set((s) => ({
        nodes: s.nodes.map(n =>
          n.id === ideaNode.id ? { ...n, data: { ...n.data, status: 'idle' as const } } : n
        ) as CanvasNode[],
      }))
      throw err  // 让 SearchBar 感知错误，恢复搜索框
    }
  },

  startExpanding: (nodeId) => {
    set((s) => ({
      nodes: s.nodes.map(n =>
        n.id === nodeId && n.type === 'direction'
          ? { ...n, data: { ...n.data, isExpanding: true } }
          : n
      ) as CanvasNode[],
    }))
  },

  cancelExpanding: (nodeId) => {
    set((s) => ({
      nodes: s.nodes.map(n =>
        n.id === nodeId && n.type === 'direction'
          ? { ...n, data: { ...n.data, isExpanding: false, opinionDraft: '' } }
          : n
      ) as CanvasNode[],
    }))
  },

  updateOpinionDraft: (nodeId, draft) => {
    set((s) => ({
      nodes: s.nodes.map(n =>
        n.id === nodeId && n.type === 'direction'
          ? { ...n, data: { ...n.data, opinionDraft: draft } }
          : n
      ) as CanvasNode[],
    }))
  },

  submitOpinion: async (nodeId) => {
    const node = get().nodes.find(n => n.id === nodeId && n.type === 'direction') as DirectionCanvasNode | undefined
    if (!node || !node.data.opinionDraft.trim()) return

    // 1. 设置节点 status: 'loading'
    set((s) => ({
      nodes: s.nodes.map(n =>
        n.id === nodeId && n.type === 'direction'
          ? { ...n, data: { ...n.data, status: 'loading' as const, isExpanding: false } }
          : n
      ) as CanvasNode[],
    }))

    // 2. 构建 parentContext（遍历边找祖先链）
    const ancestorTitles: string[] = []
    let currentId: string | null = node.data.parentNodeId

    while (currentId) {
      const parentNode = get().nodes.find(n => n.id === currentId)
      if (!parentNode) break

      if (parentNode.type === 'direction') {
        ancestorTitles.unshift(parentNode.data.title)
        currentId = parentNode.data.parentNodeId
      } else if (parentNode.type === 'idea') {
        ancestorTitles.unshift(parentNode.data.idea)
        currentId = null
      } else {
        break
      }
    }

    // 3. 调用 AI 生成子方向
    try {
      const directions = await aiClient.generateDirections({
        idea: node.data.opinionDraft.trim(),
        parentContext: {
          parentTitle: node.data.title,
          parentSummary: node.data.summary,
          userOpinion: node.data.opinionDraft.trim(),
          ancestorTitles,
        },
      })

      // 4. 创建子节点（初始位置在父节点右侧，避免飞入动画）
      const parentPos = node.position || { x: 0, y: 0 }
      const childNodes = directions.map((dir, i) =>
        createDirectionNode(
          { x: parentPos.x + 570, y: parentPos.y + i * 60 },
          dir.title, dir.summary, dir.keywords, node.data.depth + 1, nodeId
        )
      )

      const newEdges = childNodes.map(child =>
        createEdge(nodeId, child.id, 'derived')
      )

      // 5. 重置父节点状态并执行布局
      set((s) => ({
        nodes: [
          ...s.nodes.map(n =>
            n.id === nodeId && n.type === 'direction'
              ? { ...n, data: { ...n.data, status: 'idle' as const, opinionDraft: '' } }
              : n
          ),
          ...childNodes,
        ] as CanvasNode[],
        edges: [...s.edges, ...newEdges],
      }))

      // 6. 设置聚焦目标并执行自动布局
      setPendingFocusNodes(nodeId, childNodes.map(c => c.id))
      get().layoutNodes()
    } catch {
      set((s) => ({
        nodes: s.nodes.map(n =>
          n.id === nodeId && n.type === 'direction'
            ? { ...n, data: { ...n.data, status: 'idle' as const } }
            : n
        ) as CanvasNode[],
      }))
    }
  },

  confirmDirection: (nodeId) => {
    set((s) => ({
      nodes: s.nodes.map(n =>
        n.id === nodeId && n.type === 'direction'
          ? { ...n, data: { ...n.data, status: 'confirmed' as const } }
          : n
      ) as CanvasNode[],
    }))
  },

  pendingDirection: (nodeId) => {
    set((s) => ({
      nodes: s.nodes.map(n =>
        n.id === nodeId && n.type === 'direction'
          ? { ...n, data: { ...n.data, status: 'pending' as const } }
          : n
      ) as CanvasNode[],
    }))
  },

  confirmedDirections: () => {
    return get().nodes
      .filter(n => n.type === 'direction' && n.data.status === 'confirmed')
      .map(n => (n as DirectionCanvasNode).data)
  },

  pendingDirections: () => {
    return get().nodes
      .filter(n => n.type === 'direction' && n.data.status === 'pending')
      .map(n => (n as DirectionCanvasNode).data)
  },

  removeFromPanel: (nodeId) => {
    set((s) => ({
      nodes: s.nodes.map(n =>
        n.id === nodeId && n.type === 'direction'
          ? { ...n, data: { ...n.data, status: 'idle' as const } }
          : n
      ) as CanvasNode[],
    }))
  },

  moveToCategory: (nodeId, newStatus) => {
    set((s) => ({
      nodes: s.nodes.map(n =>
        n.id === nodeId && n.type === 'direction'
          ? { ...n, data: { ...n.data, status: newStatus as DirectionCanvasNode['data']['status'] } }
          : n
      ) as CanvasNode[],
    }))
  },

  // layoutNodes 现在只是触发信号，实际布局由 useAutoLayout hook 在 ReactFlow 内部执行
  layoutNodes: () => {
    set((s) => ({ layoutVersion: s.layoutVersion + 1 }))
  },
}})

