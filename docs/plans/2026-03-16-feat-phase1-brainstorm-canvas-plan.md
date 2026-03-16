---
title: "feat: Phase 1 - BrainstormCanvas 无限画布工作台"
type: feat
date: 2026-03-16
risk_score: 3
risk_level: low
risk_note: "纯前端本地项目，无外部依赖，所有变更完全可逆"
---

# Phase 1: BrainstormCanvas 无限画布工作台

## Overview

**Goal**: 用 BrainstormCanvas（@xyflow/react）替换 MainPane，实现"写想法→拖出对话→AI回复→展开笔记→分支探索"完整闭环
**Tech Stack**: React 18 + TypeScript + @xyflow/react 12 + Zustand 5 + Tailwind 3
**Architecture**: 四周壳层不动，中间主区替换为无限画布，AI 层先 mock 后替换

## 硬约束（7 条）

1. 不修改 TopBar / LeftNavPane / SessionListPane / DecisionDrawer
2. 不保留 demo 切换栏
3. 不继续用旧 suggestion canvas 做正式入口
4. 技术主方案 @xyflow/react（不用 tldraw）
5. 先建后删：BrainstormCanvas build 通过后才删旧文件
6. AI 接口从第一天抽象，先 mock
7. 不做持久化 / 不做真实多模型 / 不做 AI 主动建议 / markdown 上传推迟到 Phase 1.5

## Acceptance Criteria

- [ ] App.tsx 无 demo 切换栏，直接渲染正式布局
- [ ] 中间主区为 BrainstormCanvas（无限画布 + dots 背景）
- [ ] 右下角显示缩放百分比
- [ ] TextNode 支持编辑、拖动、调大小、宽度限制（max 480px）
- [ ] ChatNode 有独立输入框、引用来源、三态（idle/streaming/error）
- [ ] ReferenceEdge 可点击跳回来源节点
- [ ] 从 TextNode handle 拖线到空白自动创建 ChatNode
- [ ] ChatNode 自动引用来源文本并显示引用卡片
- [ ] mock AI 流式回复（逐字输出）
- [ ] "展开笔记"把 assistant 回复生成新 TextNode + derived edge
- [ ] 一个 TextNode 可分支出多个 ChatNode
- [ ] 选中文字→浮动按钮→创建分支 ChatNode（局部引用）
- [ ] 底部浮动工具栏（添加文本/添加对话/适应视口）
- [ ] `npm run build` 通过
- [ ] 四周壳层完全不动
- [ ] 旧文件（6个）删除

---

## 开发阶段（共 8 个阶段，28 个任务）

### 阶段 A：基础设施（类型 + AI 抽象 + 工厂）

---

### Task 1: 创建画布类型定义

**文件**: `src/canvas/types.ts`（新建）
**操作**:
- [ ] 创建 `src/canvas/` 目录
- [ ] 定义所有画布相关类型

**代码**:
```typescript
// src/canvas/types.ts
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
```

**验证**: `npx tsc --noEmit` 无类型错误

---

### Task 2: 创建 mock AI 客户端

**文件**: `src/canvas/lib/mock-ai.ts`（新建）
**操作**:
- [ ] 实现 mock streaming，逐字输出预设回复

**代码**:
```typescript
// src/canvas/lib/mock-ai.ts
import type { AIClient, ChatRequest, ChatChunk } from '../types'

const MOCK_RESPONSES = [
  '这是一个很好的思路。让我从几个角度来分析：\n\n1. **可行性**：技术上完全可以实现，建议先从最小闭环开始。\n2. **优先级**：核心功能优先，装饰性功能后置。\n3. **风险**：主要风险在于范围蔓延，建议严格控制 MVP 边界。',
  '我注意到你提到的这个需求有几个值得深入探讨的方向：\n\n- **用户场景**：谁会用这个功能？在什么场景下用？\n- **已有方案**：市场上有没有类似的解决方案可以参考？\n- **差异点**：我们的方案和现有方案的核心差异是什么？',
  '这是一个有趣的想法。让我帮你理清思路：\n\n首先，这个功能的核心价值在于帮助用户快速发散和收敛想法。\n\n其次，实现上可以分三步走：\n1. 先做基础的输入和展示\n2. 再做智能关联和建议\n3. 最后做结构化输出和沉淀',
]

export class MockAIClient implements AIClient {
  async *streamChat(input: ChatRequest): AsyncGenerator<ChatChunk> {
    const response = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)]
    const chars = [...response]

    for (const char of chars) {
      await new Promise((r) => setTimeout(r, 15 + Math.random() * 25))
      yield { type: 'delta', text: char }
    }

    yield { type: 'done' }
  }
}
```

**验证**: `npx tsc --noEmit` 无类型错误

---

### Task 3: 创建 AI 客户端入口

**文件**: `src/canvas/lib/ai-client.ts`（新建）
**操作**:
- [ ] 导出统一的 AI 客户端实例（当前为 mock）

**代码**:
```typescript
// src/canvas/lib/ai-client.ts
import type { AIClient } from '../types'
import { MockAIClient } from './mock-ai'

// 统一入口：替换真实 AI 时只需改这里
export const aiClient: AIClient = new MockAIClient()
```

**验证**: `npx tsc --noEmit` 无类型错误

---

### Task 4: 创建 prompt 构建器

**文件**: `src/canvas/lib/prompt-builder.ts`（新建）
**操作**:
- [ ] 将 sourceRefs 转换为系统消息上下文

**代码**:
```typescript
// src/canvas/lib/prompt-builder.ts
import type { SourceRef, ChatMessage } from '../types'

export function buildSystemPrompt(sourceRefs: SourceRef[]): string {
  if (sourceRefs.length === 0) return '你是一个需求探索助手，帮助用户发散和收敛想法。'

  const refs = sourceRefs
    .map((ref, i) => {
      const quote = ref.quotedText ? `"${ref.quotedText}"` : `(来自节点 ${ref.nodeId})`
      return `[引用${i + 1}] ${quote}`
    })
    .join('\n')

  return `你是一个需求探索助手。用户基于以下内容向你提问：\n\n${refs}\n\n请围绕这些引用内容，帮助用户深入分析和发散思路。`
}

export function buildMessages(
  systemPrompt: string,
  chatMessages: ChatMessage[]
): ChatMessage[] {
  return [
    { id: 'system', role: 'system', text: systemPrompt, createdAt: 0 },
    ...chatMessages.filter((m) => m.role !== 'system'),
  ]
}
```

**验证**: `npx tsc --noEmit` 无类型错误

---

### Task 5: 创建节点工厂

**文件**: `src/canvas/lib/node-factory.ts`（新建）
**操作**:
- [ ] 统一创建节点和边的工厂函数

**代码**:
```typescript
// src/canvas/lib/node-factory.ts
import type {
  TextCanvasNode, ChatCanvasNode, CanvasEdge,
  SourceRef, EdgeRelation,
} from '../types'

let counter = 0
const uid = () => `node-${Date.now()}-${++counter}`

export function createTextNode(
  position: { x: number; y: number },
  content: string = '',
  overrides?: Partial<TextCanvasNode['data']>
): TextCanvasNode {
  return {
    id: uid(),
    type: 'text',
    position,
    data: {
      title: '',
      content,
      format: 'plain',
      ...overrides,
    },
  }
}

export function createChatNode(
  position: { x: number; y: number },
  sourceRefs: SourceRef[] = []
): ChatCanvasNode {
  return {
    id: uid(),
    type: 'chat',
    position,
    data: {
      title: '',
      draft: '',
      status: 'idle',
      sourceRefs,
      messages: [],
    },
  }
}

export function createEdge(
  source: string,
  target: string,
  relation: EdgeRelation,
  sourceRef?: SourceRef
): CanvasEdge {
  return {
    id: `edge-${source}-${target}-${Date.now()}`,
    source,
    target,
    type: 'reference',
    data: { relation, sourceRef },
  }
}
```

**验证**: `npx tsc --noEmit` 无类型错误

---

### 阶段 B：画布状态管理

---

### Task 6: 创建 canvas store

**文件**: `src/canvas/store/canvas-store.ts`（新建）
**操作**:
- [ ] Zustand store 管理 nodes、edges、以及所有画布操作

**代码**:
```typescript
// src/canvas/store/canvas-store.ts
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
      ? (sourceNode as any).data.content
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
                messages: [...n.data.messages, userMsg],
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
}))
```

**验证**: `npx tsc --noEmit` 无类型错误

---

### 阶段 C：自定义节点

---

### Task 7: 创建 TextNode 组件

**文件**: `src/canvas/nodes/text-node.tsx`（新建）
**操作**:
- [ ] 可编辑文本卡片，带右侧拖线 handle
- [ ] 支持双击编辑、Escape/失焦保存
- [ ] 支持选中文字后显示浮动引用按钮（局部引用）

**代码**:
```tsx
// src/canvas/nodes/text-node.tsx
import { useState, useRef, useCallback, useEffect } from 'react'
import { Handle, Position, type NodeProps, useReactFlow } from '@xyflow/react'
import type { TextCanvasNode } from '../types'
import { useCanvasStore } from '../store/canvas-store'
import { cn } from '@/lib/utils'

export function TextNode({ id, data, selected }: NodeProps<TextCanvasNode>) {
  const [editing, setEditing] = useState(false)
  const [selection, setSelection] = useState<{ text: string; rect: DOMRect } | null>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const updateTextContent = useCanvasStore((s) => s.updateTextContent)
  const addChatFromQuote = useCanvasStore((s) => s.addChatFromQuote)
  const reactFlow = useReactFlow()

  const handleDoubleClick = useCallback(() => {
    setEditing(true)
    setTimeout(() => textRef.current?.focus(), 0)
  }, [])

  const handleBlur = useCallback(() => {
    setEditing(false)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setEditing(false)
    }
    // 阻止事件冒泡，避免 ReactFlow 拦截
    e.stopPropagation()
  }, [])

  // 监听文字选择
  const handleMouseUp = useCallback(() => {
    if (editing) return
    const sel = window.getSelection()
    if (sel && sel.toString().trim()) {
      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      setSelection({ text: sel.toString(), rect })
    } else {
      setSelection(null)
    }
  }, [editing])

  // 局部引用：选中文字 → 创建分支 Chat
  const handleQuoteChat = useCallback(() => {
    if (!selection || !containerRef.current) return
    const containerRect = containerRef.current.getBoundingClientRect()
    const flowPosition = reactFlow.screenToFlowPosition({
      x: containerRect.right + 80,
      y: containerRect.top,
    })
    addChatFromQuote(id, selection.text, flowPosition)
    setSelection(null)
    window.getSelection()?.removeAllRanges()
  }, [id, selection, addChatFromQuote, reactFlow])

  // 点击画布其他地方时清除选择
  useEffect(() => {
    const handleClickOutside = () => setSelection(null)
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative min-w-[200px] max-w-[480px] rounded-xl border bg-white shadow-sm',
        'transition-shadow duration-150',
        selected ? 'border-violet-400 shadow-md ring-2 ring-violet-200' : 'border-slate-200',
      )}
      onDoubleClick={handleDoubleClick}
      onMouseUp={handleMouseUp}
    >
      {/* 顶部装饰条 */}
      <div className="h-1.5 rounded-t-xl bg-gradient-to-r from-violet-400 to-purple-400" />

      {/* 内容区 */}
      <div className="p-4">
        {editing ? (
          <textarea
            ref={textRef}
            className="w-full min-h-[60px] resize-none border-none bg-transparent text-sm text-slate-700 outline-none"
            value={data.content}
            onChange={(e) => updateTextContent(id, e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <div className="min-h-[40px] whitespace-pre-wrap text-sm text-slate-700 select-text">
            {data.content || '双击编辑...'}
          </div>
        )}
      </div>

      {/* 局部引用浮动按钮 */}
      {selection && !editing && (
        <div
          className="fixed z-50 flex items-center gap-1 rounded-lg border border-violet-200 bg-white px-2 py-1 shadow-lg"
          style={{
            left: selection.rect.left + selection.rect.width / 2 - 40,
            top: selection.rect.top - 36,
          }}
          onClick={(e) => { e.stopPropagation(); handleQuoteChat() }}
        >
          <span className="text-xs text-violet-600 cursor-pointer hover:text-violet-800">
            引用对话
          </span>
        </div>
      )}

      {/* 右侧拖线 Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-violet-400 !border-2 !border-white hover:!bg-violet-600"
      />

      {/* 左侧接收 Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-slate-300 !border-2 !border-white"
      />
    </div>
  )
}
```

**验证**: `npx tsc --noEmit` 无类型错误

---

### Task 8: 创建 ChatNode 组件

**文件**: `src/canvas/nodes/chat-node.tsx`（新建）
**操作**:
- [ ] 独立输入框 + 消息列表 + 引用来源显示
- [ ] 三态指示器（idle/streaming/error）
- [ ] "展开笔记"按钮

**代码**:
```tsx
// src/canvas/nodes/chat-node.tsx
import { useCallback } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { ChatCanvasNode } from '../types'
import { useCanvasStore } from '../store/canvas-store'
import { cn } from '@/lib/utils'

export function ChatNode({ id, data, selected }: NodeProps<ChatCanvasNode>) {
  const updateDraft = useCanvasStore((s) => s.updateDraft)
  const sendMessage = useCanvasStore((s) => s.sendMessage)
  const expandNote = useCanvasStore((s) => s.expandNote)

  const handleSend = useCallback(() => {
    if (data.draft.trim() && data.status !== 'streaming') {
      sendMessage(id)
    }
  }, [id, data.draft, data.status, sendMessage])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
      e.stopPropagation()
    },
    [handleSend]
  )

  const statusColor = {
    idle: 'bg-emerald-400',
    streaming: 'bg-amber-400 animate-pulse',
    error: 'bg-rose-400',
  }[data.status]

  return (
    <div
      className={cn(
        'relative min-w-[300px] max-w-[480px] rounded-xl border bg-white shadow-sm',
        'transition-shadow duration-150',
        selected ? 'border-sky-400 shadow-md ring-2 ring-sky-200' : 'border-slate-200',
      )}
    >
      {/* 顶部状态条 */}
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2">
        <div className={cn('h-2 w-2 rounded-full', statusColor)} />
        <span className="text-xs font-medium text-slate-500">
          {data.status === 'streaming' ? '思考中...' : data.status === 'error' ? '出错了' : '对话'}
        </span>
      </div>

      {/* 引用来源 */}
      {data.sourceRefs.length > 0 && (
        <div className="border-b border-slate-50 px-4 py-2">
          {data.sourceRefs.map((ref, i) => (
            <div
              key={i}
              className="rounded-md bg-violet-50 px-2 py-1 text-xs text-violet-600 line-clamp-2"
            >
              {ref.quotedText
                ? `"${ref.quotedText.slice(0, 100)}${ref.quotedText.length > 100 ? '...' : ''}"`
                : `引用自节点 ${ref.nodeId}`}
            </div>
          ))}
        </div>
      )}

      {/* 消息列表 */}
      <div className="max-h-[300px] overflow-y-auto px-4 py-2 space-y-3">
        {data.messages.map((msg) => (
          <div key={msg.id}>
            <div
              className={cn(
                'text-sm',
                msg.role === 'user' ? 'text-slate-800' : 'text-slate-600',
              )}
            >
              <span className="text-xs font-medium text-slate-400 mr-1">
                {msg.role === 'user' ? '你' : 'AI'}:
              </span>
              <span className="whitespace-pre-wrap">{msg.text}</span>
            </div>
            {/* 展开笔记按钮（仅 assistant 消息） */}
            {msg.role === 'assistant' && data.status === 'idle' && (
              <button
                className="mt-1 text-xs text-violet-500 hover:text-violet-700 hover:underline"
                onClick={(e) => {
                  e.stopPropagation()
                  expandNote(id, msg.id)
                }}
              >
                展开为笔记
              </button>
            )}
          </div>
        ))}
      </div>

      {/* 输入区 */}
      <div className="border-t border-slate-100 px-3 py-2">
        <div className="flex items-end gap-2">
          <textarea
            className="flex-1 min-h-[32px] max-h-[80px] resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-200"
            placeholder={data.status === 'streaming' ? '等待回复...' : '输入你的问题...'}
            value={data.draft}
            onChange={(e) => updateDraft(id, e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={data.status === 'streaming'}
          />
          <button
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors',
              data.draft.trim() && data.status !== 'streaming'
                ? 'bg-sky-500 hover:bg-sky-600'
                : 'bg-slate-300 cursor-not-allowed',
            )}
            onClick={handleSend}
            disabled={!data.draft.trim() || data.status === 'streaming'}
          >
            发送
          </button>
        </div>
      </div>

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-sky-400 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-sky-300 !border-2 !border-white hover:!bg-sky-500"
      />
    </div>
  )
}
```

**验证**: `npx tsc --noEmit` 无类型错误

---

### 阶段 D：自定义边

---

### Task 9: 创建 ReferenceEdge 组件

**文件**: `src/canvas/edges/reference-edge.tsx`（新建）
**操作**:
- [ ] 自定义边，可点击跳回来源节点
- [ ] 不同 relation 不同样式

**代码**:
```tsx
// src/canvas/edges/reference-edge.tsx
import { useCallback } from 'react'
import {
  BaseEdge, getBezierPath, EdgeLabelRenderer,
  type EdgeProps,
  useReactFlow,
} from '@xyflow/react'
import type { ReferenceEdgeData } from '../types'
import { cn } from '@/lib/utils'

const RELATION_STYLES = {
  quote: { stroke: '#8b5cf6', label: '引用', dash: '' },
  branch: { stroke: '#06b6d4', label: '分支', dash: '5,5' },
  derived: { stroke: '#10b981', label: '派生', dash: '8,4' },
}

export function ReferenceEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data, selected,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
  })

  const { fitView, setCenter } = useReactFlow()
  const relation = (data as ReferenceEdgeData)?.relation ?? 'quote'
  const style = RELATION_STYLES[relation]

  // 点击 edge → 跳转到来源节点
  const handleClick = useCallback(() => {
    const sourceRef = (data as ReferenceEdgeData)?.sourceRef
    if (sourceRef?.nodeId) {
      // 使用 fitView 聚焦到来源节点
      fitView({ nodes: [{ id: sourceRef.nodeId }], duration: 600, padding: 0.5 })
    }
  }, [data, fitView])

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: style.stroke,
          strokeWidth: selected ? 3 : 2,
          strokeDasharray: style.dash || undefined,
          cursor: 'pointer',
        }}
        interactionWidth={20}
      />
      <EdgeLabelRenderer>
        <div
          className={cn(
            'absolute cursor-pointer rounded-full border px-2 py-0.5 text-[10px] font-medium',
            'bg-white shadow-sm transition-all hover:shadow-md hover:scale-110',
          )}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            borderColor: style.stroke,
            color: style.stroke,
            pointerEvents: 'all',
          }}
          onClick={handleClick}
        >
          {style.label}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
```

**验证**: `npx tsc --noEmit` 无类型错误

---

### 阶段 E：画布主体

---

### Task 10: 创建缩放百分比指示器

**文件**: `src/canvas/canvas-zoom-indicator.tsx`（新建）
**操作**:
- [ ] 右下角显示当前缩放百分比

**代码**:
```tsx
// src/canvas/canvas-zoom-indicator.tsx
import { useViewport } from '@xyflow/react'

export function CanvasZoomIndicator() {
  const { zoom } = useViewport()
  return (
    <div className="absolute bottom-4 right-4 z-10 rounded-lg bg-white/80 px-2 py-1 text-xs font-medium text-slate-500 shadow-sm border border-slate-200 backdrop-blur-sm">
      {Math.round(zoom * 100)}%
    </div>
  )
}
```

**验证**: `npx tsc --noEmit` 无类型错误

---

### Task 11: 创建底部浮动工具栏

**文件**: `src/canvas/canvas-toolbar.tsx`（新建）
**操作**:
- [ ] 底部居中浮动工具栏：添加文本、添加对话、适应视口

**代码**:
```tsx
// src/canvas/canvas-toolbar.tsx
import { useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useCanvasStore } from './store/canvas-store'

export function CanvasToolbar() {
  const reactFlow = useReactFlow()
  const addTextNode = useCanvasStore((s) => s.addTextNode)

  const handleAddText = useCallback(() => {
    const center = reactFlow.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })
    addTextNode(center, '')
  }, [reactFlow, addTextNode])

  const handleFitView = useCallback(() => {
    reactFlow.fitView({ duration: 400, padding: 0.2 })
  }, [reactFlow])

  return (
    <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-slate-200 bg-white/90 px-2 py-1.5 shadow-lg backdrop-blur-sm">
      <button
        className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
        onClick={handleAddText}
      >
        <span className="text-base leading-none">+</span> 文本
      </button>
      <div className="h-4 w-px bg-slate-200" />
      <button
        className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
        onClick={handleFitView}
      >
        适应视口
      </button>
    </div>
  )
}
```

**验证**: `npx tsc --noEmit` 无类型错误

---

### Task 12: 创建 use-create-chat-from-edge hook

**文件**: `src/canvas/hooks/use-create-chat-from-edge.ts`（新建）
**操作**:
- [ ] 处理"拖线到空白区域自动创建 ChatNode"逻辑

**代码**:
```typescript
// src/canvas/hooks/use-create-chat-from-edge.ts
import { useCallback } from 'react'
import { useReactFlow, type OnConnectEnd } from '@xyflow/react'
import { useCanvasStore } from '../store/canvas-store'

export function useCreateChatFromEdge() {
  const reactFlow = useReactFlow()
  const addChatFromEdge = useCanvasStore((s) => s.addChatFromEdge)

  // 记录拖线起始节点
  let connectingNodeId: string | null = null

  const onConnectStart = useCallback(
    (_: any, params: { nodeId: string | null }) => {
      connectingNodeId = params.nodeId ?? null
    },
    []
  )

  const onConnectEnd: OnConnectEnd = useCallback(
    (event) => {
      if (!connectingNodeId) return

      // 检查是否落在了已有节点上（如果是，由 onConnect 处理）
      const targetIsPane = (event.target as HTMLElement)?.classList?.contains(
        'react-flow__pane'
      )
      if (!targetIsPane) return

      const clientEvent = 'changedTouches' in event ? event.changedTouches[0] : event
      const position = reactFlow.screenToFlowPosition({
        x: (clientEvent as MouseEvent).clientX,
        y: (clientEvent as MouseEvent).clientY,
      })

      addChatFromEdge(connectingNodeId, position)
      connectingNodeId = null
    },
    [reactFlow, addChatFromEdge]
  )

  return { onConnectStart, onConnectEnd }
}
```

**验证**: `npx tsc --noEmit` 无类型错误

---

### Task 13: 创建 BrainstormCanvas 主组件

**文件**: `src/canvas/brainstorm-canvas.tsx`（新建）
**操作**:
- [ ] 组装 ReactFlow、自定义节点/边、hooks、工具栏、缩放指示器

**代码**:
```tsx
// src/canvas/brainstorm-canvas.tsx
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useCanvasStore } from './store/canvas-store'
import { TextNode } from './nodes/text-node'
import { ChatNode } from './nodes/chat-node'
import { ReferenceEdge } from './edges/reference-edge'
import { CanvasToolbar } from './canvas-toolbar'
import { CanvasZoomIndicator } from './canvas-zoom-indicator'
import { useCreateChatFromEdge } from './hooks/use-create-chat-from-edge'

const nodeTypes = {
  text: TextNode,
  chat: ChatNode,
}

const edgeTypes = {
  reference: ReferenceEdge,
}

function BrainstormCanvasInner() {
  const { nodes, edges, onNodesChange, onEdgesChange } = useCanvasStore()
  const { onConnectStart, onConnectEnd } = useCreateChatFromEdge()

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        defaultEdgeOptions={{ type: 'reference' }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e8f0" />
        <CanvasToolbar />
        <CanvasZoomIndicator />
      </ReactFlow>
    </div>
  )
}

export function BrainstormCanvas() {
  return (
    <ReactFlowProvider>
      <BrainstormCanvasInner />
    </ReactFlowProvider>
  )
}
```

**验证**: `npx tsc --noEmit` 无类型错误

---

### 阶段 F：替换入口

---

### Task 14: 修改 App.tsx 接入正式画布

**文件**: `src/App.tsx`（修改）
**操作**:
- [ ] 删除 DemoMode 类型和 mode 状态
- [ ] 删除 demo 切换栏 JSX
- [ ] 删除 ReactFlowDemo 和 TldrawDemo 的导入
- [ ] 将 MainPane 替换为 BrainstormCanvas
- [ ] 保留四周壳层不动

**代码变更摘要**:
```tsx
// 删除:
// - import ReactFlowDemo from './demos/reactflow-demo'
// - import TldrawDemo from './demos/tldraw-demo'
// - import MainPane from './components/main-pane'
// - type DemoMode = 'original' | 'reactflow' | 'tldraw'
// - const [mode, setMode] = useState<DemoMode>('original')
// - 顶部 demo 切换栏 JSX

// 新增:
import { BrainstormCanvas } from './canvas/brainstorm-canvas'

// 主区替换:
// 原来: <MainPane />
// 现在: <BrainstormCanvas />
```

**验证**: `npm run build` 通过

---

### Task 15: 运行 build 验证

**操作**:
- [ ] `npm run build` 通过
- [ ] 手动启动 `npm run dev`，确认画布可渲染、壳层不变

**验证**:
- [ ] build 无错误
- [ ] 浏览器打开能看到四周壳层 + 中间无限画布
- [ ] 默认 TextNode 可见

---

### 阶段 G：功能验证与调试

---

### Task 16: 验证 TextNode 交互

**操作**:
- [ ] 双击进入编辑模式
- [ ] 输入文字后 Escape 退出
- [ ] 拖动节点移动
- [ ] 确认 max-width 480px 限制

**验证**: 手动测试通过

---

### Task 17: 验证拖线创建 ChatNode

**操作**:
- [ ] 从 TextNode 右侧 handle 拖线
- [ ] 拖到空白区域松手
- [ ] 确认 ChatNode 自动创建
- [ ] 确认 quote edge 自动生成
- [ ] 确认 ChatNode 引用区显示来源文本

**验证**: 手动测试通过

---

### Task 18: 验证 mock 流式回复

**操作**:
- [ ] 在 ChatNode 输入框输入文字
- [ ] 按 Enter 发送
- [ ] 确认状态变为 streaming（指示器闪烁）
- [ ] 确认文字逐字显示
- [ ] 确认完成后状态回到 idle

**验证**: 手动测试通过

---

### Task 19: 验证展开笔记

**操作**:
- [ ] 在 AI 回复完成后点击"展开为笔记"
- [ ] 确认新 TextNode 创建，内容为 assistant 消息文本
- [ ] 确认 derived edge 自动生成

**验证**: 手动测试通过

---

### Task 20: 验证多分支对话

**操作**:
- [ ] 从同一个 TextNode 拖出第二条连线
- [ ] 确认第二个 ChatNode 创建
- [ ] 确认两条 edge 共存

**验证**: 手动测试通过

---

### Task 21: 验证局部引用

**操作**:
- [ ] 在 TextNode 中选中部分文字
- [ ] 确认浮动"引用对话"按钮出现
- [ ] 点击按钮
- [ ] 确认新 ChatNode 创建，仅引用选中片段
- [ ] 确认 branch edge 自动生成

**验证**: 手动测试通过

---

### Task 22: 验证 edge 跳转

**操作**:
- [ ] 点击任意 edge 上的标签（引用/分支/派生）
- [ ] 确认画布聚焦到来源节点

**验证**: 手动测试通过

---

### Task 23: 验证工具栏和缩放

**操作**:
- [ ] 点击工具栏"+ 文本"按钮，确认新节点创建
- [ ] 点击"适应视口"，确认所有节点可见
- [ ] 确认右下角缩放百分比随缩放变化

**验证**: 手动测试通过

---

### 阶段 H：清理旧文件

---

### Task 24: 删除旧主区文件

**前提**: Task 15 build 通过
**操作**:
- [ ] 删除 `src/components/main-pane.tsx`
- [ ] 删除 `src/components/search-seed-node.tsx`
- [ ] 删除 `src/components/curved-suggestion-canvas.tsx`
- [ ] 删除 `src/data/mock-suggestion-nodes.ts`
- [ ] 删除 `src/demos/reactflow-demo.tsx`
- [ ] 删除 `src/demos/tldraw-demo.tsx`
- [ ] 删除 `src/demos/` 目录（如果为空）

**验证**: `npm run build` 通过

---

### Task 25: 最终 build 验证

**操作**:
- [ ] `npm run build` 无错误、无警告
- [ ] `npm run dev` 启动后完整测试所有功能

**验证**: build 通过 + 全流程手动测试通过

---

### Task 26: Git 提交与 PR

**操作**:
- [ ] 创建分支 `feat/phase1-brainstorm-canvas`
- [ ] 分阶段提交（基础设施 → 节点 → 边 → 画布 → 入口替换 → 清理）
- [ ] 创建 PR 到 main

**验证**: PR 创建成功

---

## 新建文件清单（16 个）

| 文件 | 用途 |
|------|------|
| `src/canvas/types.ts` | 画布类型定义 |
| `src/canvas/brainstorm-canvas.tsx` | 画布主组件 |
| `src/canvas/canvas-toolbar.tsx` | 底部浮动工具栏 |
| `src/canvas/canvas-zoom-indicator.tsx` | 缩放百分比指示器 |
| `src/canvas/nodes/text-node.tsx` | 文本节点 |
| `src/canvas/nodes/chat-node.tsx` | 对话节点 |
| `src/canvas/edges/reference-edge.tsx` | 引用边 |
| `src/canvas/store/canvas-store.ts` | 画布状态管理 |
| `src/canvas/hooks/use-create-chat-from-edge.ts` | 拖线创建节点 hook |
| `src/canvas/lib/ai-client.ts` | AI 客户端入口 |
| `src/canvas/lib/mock-ai.ts` | Mock AI 实现 |
| `src/canvas/lib/prompt-builder.ts` | Prompt 构建器 |
| `src/canvas/lib/node-factory.ts` | 节点/边工厂 |
| `.gitignore` | Git 忽略配置 |

## 修改文件清单（1 个）

| 文件 | 变更 |
|------|------|
| `src/App.tsx` | 删除 demo 切换，用 BrainstormCanvas 替换 MainPane |

## 删除文件清单（6 个，阶段 H 执行）

| 文件 | 原因 |
|------|------|
| `src/components/main-pane.tsx` | 被 BrainstormCanvas 替代 |
| `src/components/search-seed-node.tsx` | 旧方案组件 |
| `src/components/curved-suggestion-canvas.tsx` | 旧方案组件 |
| `src/data/mock-suggestion-nodes.ts` | 旧方案数据 |
| `src/demos/reactflow-demo.tsx` | Demo 废弃 |
| `src/demos/tldraw-demo.tsx` | Demo 废弃 |

## Phase 2 留存项

- AI 主动建议系统
- 真实 AI 模型接入（OpenAI/Ollama）
- markdown 文件上传与解析（Phase 1.5）
- 数据持久化
- 结构化输出（需求摘要、技术清单、风险列表）
- 决策抽屉沉淀

## 依赖安装

本 Phase 无需安装新依赖。`@xyflow/react` 和 `zustand` 已在 `package.json` 中。

> 注：原计划用 `react-markdown` 渲染 markdown，但 Phase 1 TextNode 只做纯文本编辑和 `whitespace-pre-wrap` 展示，无需安装。等 Phase 1.5 做 markdown 上传时再引入。
