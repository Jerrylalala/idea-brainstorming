---
title: feat: 需求探索链路完整性修复（P0+P1+P2b）
type: feat
date: 2026-03-22
risk_score: 2
risk_level: low
risk_note: "纯代码改动，无数据迁移，无新外部依赖，个人项目，9个文件"
---

# feat: 需求探索链路完整性修复（P0+P1+P2b）

## Overview

**Goal**: 修复头脑风暴产品三处链路断点，实现最小完整闭环
**Tech Stack**: React + TypeScript + Zustand + Hono + Vercel AI SDK
**Architecture**: P0（提示词自适应）+ P1（画布上下文注入）+ P2b（收束输出），三块缺一则链路不闭合

> 背景详见：`docs/brainstorms/2026-03-22-exploration-flow-completeness-brainstorm.md`

---

## Acceptance Criteria

- [ ] 用户说「我想做个人脚本」时，AI 不再问「商业模式？订阅制还是买断？」
- [ ] 前 3 轮 AI 只问最关键的 1-2 个问题，3 轮后可主动给出判断性建议
- [ ] 用户在 chat-node A 说了「个人用」，chat-node B 的 AI 知道画布上的上下文信息
- [ ] decision-drawer 顶部有「AI 综合分析」按钮（加载时显示 spinner）
- [ ] 点击后在 drawer 内展示四节结构化总结：已确认决策 / 待决策问题 / 可能遗漏的考量 / 建议下一步
- [ ] MockAIClient 正确实现 `generateSummary` 方法，返回与真实格式一致的 mock 数据

---

## Task Breakdown

### Task 1：重写 BRAINSTORM_ROLE 提示词（P0）

**文件**: `src/canvas/lib/prompt-builder.ts:4-15`
**操作**:
- [ ] 将固定 6 维度替换为动态感知 + 阶段性策略

**代码**（替换第 4-15 行的 BRAINSTORM_ROLE 常量内容）:
```ts
const BRAINSTORM_ROLE = `你是一位专业的头脑风暴引导者。
当用户描述一个想法时，首先理解这个想法，然后动态引导探索——不要套用固定维度模板。

**第一步：分析用户描述**
- 判断项目类型：个人工具 / 团队内部工具 / 面向大众的产品
- 识别用户已经说清楚的信息（不要重复问）
- 找出最关键的 1-2 个还没想清楚的维度

**对话策略（分阶段）**
- 前 3 轮：每次只问 1-2 个最关键的问题，不重复已知信息
- 3 轮之后：在引导的同时，可主动说「你可能还没考虑到的是：...」
- 任何时候：用户问「你觉得怎么样」时，给出判断性建议，不要继续反问

**提问参考维度（按情况选择，不是全部都问）**
- 使用规模（个人用 / 团队 / 面向大众）
- 核心用户场景（什么人，在什么情况下用）
- 差异化价值（和现有方案相比，哪里不同）
- 技术约束（平台偏好、开发者本人技术栈）

语气友好、简洁、鼓励性。`
```

**验证**:
- [ ] 启动开发服务器，在 chat-node 输入「我想做一个个人 CLI 脚本工具」
- [ ] 确认 AI 不问「商业模式」「订阅制还是买断」

---

### Task 2：添加 `CanvasContext` 类型并更新 `buildSystemPrompt` 签名（P1）

**文件**: `src/canvas/lib/prompt-builder.ts`
**操作**:
- [ ] 在文件顶部 import 后添加 `CanvasContext` 类型导出
- [ ] 更新 `buildSystemPrompt` 函数签名，新增可选 `canvasContext` 参数
- [ ] 在 prompt 中注入画布上下文信息（只在有内容时注入）

**代码**（在 `import` 行之后插入类型定义，并替换整个 `buildSystemPrompt` 函数）:

在文件第 1 行 import 后插入：
```ts
export type CanvasContext = {
  confirmedDirections: string[]  // 已确认方向的标题列表
  textNodeSummaries: string[]    // 每个 text-node 内容前 100 字
}
```

替换 `buildSystemPrompt` 函数（原第 3-27 行）：
```ts
export function buildSystemPrompt(
  sourceRefs: SourceRef[],
  canvasContext?: CanvasContext
): string {
  const BRAINSTORM_ROLE = `...` // 同 Task 1 中的新提示词内容

  let prompt = BRAINSTORM_ROLE

  // 注入画布级上下文（P1：打破节点孤岛）
  if (canvasContext) {
    const parts: string[] = []
    if (canvasContext.confirmedDirections.length > 0) {
      parts.push(`用户已确认的方向：${canvasContext.confirmedDirections.join('、')}`)
    }
    if (canvasContext.textNodeSummaries.length > 0) {
      parts.push(
        `画布上的笔记摘要：\n${canvasContext.textNodeSummaries
          .map((s, i) => `[笔记${i + 1}] ${s}`)
          .join('\n')}`
      )
    }
    if (parts.length > 0) {
      prompt += `\n\n**当前画布上下文**（请勿重复问用户已说明的信息）：\n${parts.join('\n')}`
    }
  }

  if (sourceRefs.length === 0) return prompt

  const refs = sourceRefs
    .map((ref, i) => {
      const quote = ref.quotedText ? `"${ref.quotedText}"` : `(来自节点 ${ref.nodeId})`
      return `[引用${i + 1}] ${quote}`
    })
    .join('\n')

  return `${prompt}\n\n用户基于以下内容向你提问：\n\n${refs}\n\n请围绕这些引用内容，通过提问帮助用户深化思考。`
}
```

**验证**:
- [ ] `pnpm run build` 无 TypeScript 错误
- [ ] `buildSystemPrompt([], { confirmedDirections: ['Web 应用'], textNodeSummaries: ['个人使用'] })` 返回包含「当前画布上下文」的字符串

---

### Task 3：在 `sendMessage` 中注入 `canvasContext`（P1）

**文件**: `src/canvas/store/canvas-store.ts:209-211`
**操作**:
- [ ] 更新 `sendMessage` 中 `buildSystemPrompt` 的调用，从 store 中读取画布信息

**代码**（替换 `canvas-store.ts` 第 209-211 行）:
```ts
// 从画布读取上下文，打破节点孤岛（P1）
const allNodes = get().nodes
const confirmedDirections = allNodes
  .filter(n => n.type === 'direction' && (n as DirectionCanvasNode).data.status === 'confirmed')
  .map(n => (n as DirectionCanvasNode).data.title)

const textNodeSummaries = allNodes
  .filter(n => n.type === 'text')
  .map(n => (n.data as { content: string }).content.slice(0, 100).trim())
  .filter(Boolean)

const canvasContext = (confirmedDirections.length > 0 || textNodeSummaries.length > 0)
  ? { confirmedDirections, textNodeSummaries }
  : undefined

const systemPrompt = buildSystemPrompt(currentNode.data.sourceRefs, canvasContext)
```

**验证**:
- [ ] `pnpm run build` 无 TypeScript 错误
- [ ] 在画布上确认一个方向（如「Web 应用方案」），再打开新 chat-node 提问，system prompt 包含「用户已确认的方向：Web 应用方案」

---

### Task 4：在 `src/shared/types.ts` 中添加 Summary 类型（P2b）

**文件**: `src/shared/types.ts`
**操作**:
- [ ] 在文件末尾追加 `SummaryRequest` 和 `SummaryResult` 类型

**代码**（追加到文件末尾）:
```ts
export type SummaryRequest = {
  confirmedDirections: { title: string; summary: string }[]
  pendingDirections: { title: string; summary: string }[]
  textNodeContents: string[]
  chatHighlights: string[]   // 每个 chat-node 最后一条 assistant 消息（前 200 字）
}

export type SummarySection = {
  title: string
  items: string[]
}

export type SummaryResult = {
  confirmedDecisions: SummarySection
  openQuestions: SummarySection
  overlookedConsiderations: SummarySection
  suggestedNextSteps: SummarySection
}
```

**验证**:
- [ ] `pnpm run build` 无错误

---

### Task 5：在 `src/shared/prompt-builder.ts` 中添加 Summary Prompt 构建器（P2b）

**文件**: `src/shared/prompt-builder.ts`
**操作**:
- [ ] 在文件顶部 import 中添加 `SummaryRequest` 和 `SummaryResult`
- [ ] 在文件末尾追加 `buildSummaryPrompt` 和 `parseSummaryJSON` 函数

**代码**（更新 import，追加函数）:

更新第 3 行 import：
```ts
import type { DirectionRequest, SummaryRequest, SummaryResult, SummarySection } from './types'
```

追加到文件末尾：
```ts
export function buildSummaryPrompt(input: SummaryRequest): string {
  const confirmed = input.confirmedDirections.length > 0
    ? `已确认方向：\n${input.confirmedDirections.map(d => `- ${d.title}：${d.summary}`).join('\n')}`
    : ''
  const pending = input.pendingDirections.length > 0
    ? `待定方向：\n${input.pendingDirections.map(d => `- ${d.title}：${d.summary}`).join('\n')}`
    : ''
  const texts = input.textNodeContents.length > 0
    ? `笔记内容：\n${input.textNodeContents.map((t, i) => `[${i + 1}] ${sanitizeInput(t, 200)}`).join('\n')}`
    : ''
  const chats = input.chatHighlights.length > 0
    ? `对话要点：\n${input.chatHighlights.map((c, i) => `[${i + 1}] ${sanitizeInput(c, 200)}`).join('\n')}`
    : ''

  const context = [confirmed, pending, texts, chats].filter(Boolean).join('\n\n')

  return `你是一位需求分析专家，正在帮助用户整理头脑风暴的成果。

用户已探索了以下内容：

${context || '（画布内容为空）'}

请综合分析以上内容，生成结构化总结。如果某项没有内容可填，items 返回空数组即可。

**严格按照以下 JSON 格式输出，不要有任何其他文字**：
{
  "confirmedDecisions": {
    "title": "已确认决策",
    "items": ["决策描述1", "决策描述2"]
  },
  "openQuestions": {
    "title": "待决策问题",
    "items": ["问题描述1", "问题描述2"]
  },
  "overlookedConsiderations": {
    "title": "可能遗漏的考量",
    "items": ["考量描述1", "考量描述2"]
  },
  "suggestedNextSteps": {
    "title": "建议下一步",
    "items": ["行动步骤1", "行动步骤2"]
  }
}`
}

export function parseSummaryJSON(text: string): SummaryResult {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('AI 综合分析返回格式错误')
  const raw = JSON.parse(jsonMatch[0]) as Record<string, unknown>

  const parseSection = (key: string): SummarySection => {
    const s = (raw[key] ?? {}) as Record<string, unknown>
    return {
      title: String(s.title ?? key),
      items: Array.isArray(s.items) ? (s.items as unknown[]).map(String) : [],
    }
  }

  return {
    confirmedDecisions: parseSection('confirmedDecisions'),
    openQuestions: parseSection('openQuestions'),
    overlookedConsiderations: parseSection('overlookedConsiderations'),
    suggestedNextSteps: parseSection('suggestedNextSteps'),
  }
}
```

**验证**:
- [ ] `pnpm run build` 无错误

---

### Task 6：在 `src/canvas/types.ts` 中扩展 `AIClient` 接口（P2b）

**文件**: `src/canvas/types.ts:107-110`
**操作**:
- [ ] 在 `canvas/types.ts` 中添加本地 `SummaryRequest`、`SummaryResult`、`SummarySection` 类型定义
- [ ] 在 `AIClient` 接口中添加 `generateSummary` 方法

**代码**（在 `AIClient` 接口前插入类型，并扩展接口）:

在第 106 行（`// === AI 接口 ===`）之后，`AIClient` 接口之前插入：
```ts
// 综合分析类型（与 src/shared/types.ts 保持形状一致）
export type SummarySection = {
  title: string
  items: string[]
}

export type SummaryResult = {
  confirmedDecisions: SummarySection
  openQuestions: SummarySection
  overlookedConsiderations: SummarySection
  suggestedNextSteps: SummarySection
}

export type SummaryRequest = {
  confirmedDirections: { title: string; summary: string }[]
  pendingDirections: { title: string; summary: string }[]
  textNodeContents: string[]
  chatHighlights: string[]
}
```

替换 `AIClient` 接口（第 107-110 行）：
```ts
export interface AIClient {
  streamChat(input: ChatRequest, signal?: AbortSignal): AsyncGenerator<ChatChunk>
  generateDirections(input: DirectionRequest, signal?: AbortSignal): Promise<Direction[]>
  generateSummary(input: SummaryRequest, signal?: AbortSignal): Promise<SummaryResult>
}
```

**验证**:
- [ ] `pnpm run build` 报错：`MockAIClient` 和 `ProxyAIClient` 未实现 `generateSummary`（预期，Task 7-9 修复）

---

### Task 7：在 `ProxyAIClient` 中实现 `generateSummary`（P2b）

**文件**: `src/canvas/lib/proxy-ai-client.ts`
**操作**:
- [ ] 在 import 中添加 `SummaryRequest` 和 `SummaryResult`
- [ ] 在类中追加 `generateSummary` 方法

**代码**（更新 import，追加方法）:

更新第 2 行 import：
```ts
import type { AIClient, ChatRequest, ChatChunk, DirectionRequest, Direction, SummaryRequest, SummaryResult } from '../types'
```

在类的 `generateDirections` 方法（第 70-86 行）之后追加：
```ts
  async generateSummary(input: SummaryRequest, signal?: AbortSignal): Promise<SummaryResult> {
    const res = await fetch('/api/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...this.config, input }),
      signal,
    })

    if (!res.ok) {
      const raw = await res.text()
      const safeBody = raw.slice(0, 200).replace(/[<>&"']/g, c => `&#${c.charCodeAt(0)};`)
      throw new Error(`HTTP ${res.status}: ${safeBody}`)
    }

    return res.json()
  }
```

**验证**:
- [ ] `pnpm run build` 无错误（ProxyAIClient 满足接口）

---

### Task 8：在 `server/app.ts` 中添加 `/api/summary` 路由（P2b）

**文件**: `server/app.ts`
**操作**:
- [ ] 在 import 中添加 `buildSummaryPrompt`、`parseSummaryJSON`、`SummaryRequest`、`SummaryResult`
- [ ] 在 `/api/directions` 路由之后添加 `/api/summary` 路由

**代码**（更新 import，追加路由）:

更新第 5-6 行 import：
```ts
import { buildDirectionPrompt, parseDirectionsJSON, buildSummaryPrompt, parseSummaryJSON } from '../src/shared/prompt-builder'
import type { ChatChunk, DirectionRequest, SummaryRequest, SummaryResult } from '../src/shared/types'
```

在 `/api/directions` 路由（第 160-176 行）之后追加：
```ts
// === POST /api/summary — 非流式综合分析 ===
app.post('/api/summary', async (c) => {
  const body = await c.req.json<AIProxyBody & { input: SummaryRequest }>()

  const sumErr = validateAIProxyBody(body)
  if (sumErr) return c.json({ error: sumErr }, 400)

  const languageModel = buildModel(body.format, body.apiKey, body.baseURL, body.model)
  const result = await generateText({
    model: languageModel,
    messages: [{ role: 'user', content: buildSummaryPrompt(body.input) }],
    abortSignal: c.req.raw.signal,
    maxRetries: 0,
  })

  const summary: SummaryResult = parseSummaryJSON(result.text)
  return c.json(summary)
})
```

**验证**:
- [ ] `pnpm run build` 无错误

---

### Task 9：在 `MockAIClient` 中实现 `generateSummary`（P2b）

**文件**: `src/canvas/lib/mock-ai.ts`
**操作**:
- [ ] 在 import 中添加 `SummaryRequest` 和 `SummaryResult`
- [ ] 在 `MockAIClient` 类中追加 `generateSummary` 方法

**代码**（更新 import，追加方法）:

更新第 1 行 import：
```ts
import type { AIClient, ChatRequest, ChatChunk, DirectionRequest, Direction, SummaryRequest, SummaryResult } from '../types'
```

在 `generateDirections` 方法之后，类闭合括号之前追加：
```ts
  async generateSummary(input: SummaryRequest): Promise<SummaryResult> {
    // 模拟 1200-1800ms 延迟（综合分析比方向生成稍慢）
    await new Promise(r => setTimeout(r, 1200 + Math.random() * 600))

    const confirmedCount = input.confirmedDirections.length
    const pendingCount = input.pendingDirections.length

    return {
      confirmedDecisions: {
        title: '已确认决策',
        items: confirmedCount > 0
          ? input.confirmedDirections.map(d => `选择了「${d.title}」方向：${d.summary}`)
          : ['暂无已确认的技术决策'],
      },
      openQuestions: {
        title: '待决策问题',
        items: pendingCount > 0
          ? input.pendingDirections.map(d => `${d.title}方向尚未确认：${d.summary}`)
          : ['技术实现路径尚未最终确定', '目标用户的优先级需要进一步明确'],
      },
      overlookedConsiderations: {
        title: '可能遗漏的考量',
        items: [
          '错误处理和边界情况设计',
          '数据持久化和备份策略',
          '性能预期和扩展性边界',
        ],
      },
      suggestedNextSteps: {
        title: '建议下一步',
        items: [
          '基于已确认方向搭建最小可运行原型（MVP）',
          '对目标用户做 2-3 次访谈验证核心假设',
          `确认${pendingCount > 0 ? `剩余 ${pendingCount} 个待定方向` : '技术栈'}后开始详细设计`,
        ],
      },
    }
  }
```

**验证**:
- [ ] `pnpm run build` 无错误（MockAIClient 满足接口）

---

### Task 10：在 `canvas-store.ts` 中添加 `generateSummary` action（P2b）

**文件**: `src/canvas/store/canvas-store.ts`
**操作**:
- [ ] 在接口 `CanvasState` 中声明新的 state 字段和 action
- [ ] 在 store 实现中添加 action 实现

**代码**（在 `CanvasState` 接口中，`removeFromPanel` 之前添加）:

更新 `CanvasState` 接口，在 `removeFromPanel` 前插入：
```ts
  // 综合分析操作（P2b）
  summaryStatus: 'idle' | 'loading' | 'error'
  summaryResult: import('../types').SummaryResult | null
  generateSummary: () => Promise<void>
  clearSummary: () => void
```

在 store 实现的 `layoutNodes` 之前插入以下初始值和 action：

初始值（在 `nodes: []` 附近）：
```ts
  summaryStatus: 'idle' as const,
  summaryResult: null,
```

action 实现（在 `removeFromPanel` 之前）：
```ts
  generateSummary: async () => {
    const { nodes } = get()

    const confirmedDirections = nodes
      .filter(n => n.type === 'direction' && (n as DirectionCanvasNode).data.status === 'confirmed')
      .map(n => ({
        title: (n as DirectionCanvasNode).data.title,
        summary: (n as DirectionCanvasNode).data.summary,
      }))

    const pendingDirections = nodes
      .filter(n => n.type === 'direction' && (n as DirectionCanvasNode).data.status === 'pending')
      .map(n => ({
        title: (n as DirectionCanvasNode).data.title,
        summary: (n as DirectionCanvasNode).data.summary,
      }))

    const textNodeContents = nodes
      .filter(n => n.type === 'text')
      .map(n => (n.data as { content: string }).content.slice(0, 300))
      .filter(Boolean)

    const chatHighlights = nodes
      .filter(n => n.type === 'chat')
      .flatMap(n => {
        const msgs = (n.data as ChatCanvasNode['data']).messages
        const last = [...msgs].reverse().find(m => m.role === 'assistant')
        return last ? [last.text.slice(0, 200)] : []
      })

    set({ summaryStatus: 'loading' })

    try {
      const result = await aiClient.generateSummary({
        confirmedDirections,
        pendingDirections,
        textNodeContents,
        chatHighlights,
      })
      set({ summaryStatus: 'idle', summaryResult: result })
    } catch {
      set({ summaryStatus: 'error' })
    }
  },

  clearSummary: () => {
    set({ summaryResult: null, summaryStatus: 'idle' })
  },
```

**验证**:
- [ ] `pnpm run build` 无错误

---

### Task 11：在 `decision-drawer.tsx` 中添加 AI 综合分析 UI（P2b）

**文件**: `src/components/decision-drawer.tsx`
**操作**:
- [ ] 在文件顶部添加必要的 import
- [ ] 在 drawer 顶部添加「AI 综合分析」按钮
- [ ] 在按钮下方添加 summary 展示区（只读）

**代码变更**:

在现有 import 区域末尾追加：
```ts
import { useCanvasStore } from '../canvas/store/canvas-store'
import type { SummaryResult } from '../canvas/types'
```

在组件函数内（在现有 state 声明后）添加：
```ts
  const summaryStatus = useCanvasStore(s => s.summaryStatus)
  const summaryResult = useCanvasStore(s => s.summaryResult)
  const generateSummary = useCanvasStore(s => s.generateSummary)
  const clearSummary = useCanvasStore(s => s.clearSummary)
```

在 drawer 内容顶部（已确认选型区域之前）插入 AI 综合分析区块：
```tsx
{/* AI 综合分析区块 */}
<div className="px-4 pt-3 pb-2 border-b border-neutral-800">
  <button
    onClick={summaryResult ? clearSummary : generateSummary}
    disabled={summaryStatus === 'loading'}
    className="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium
      bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed
      text-white transition-colors"
  >
    {summaryStatus === 'loading' ? (
      <>
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        正在分析...
      </>
    ) : summaryResult ? (
      '清除分析结果'
    ) : (
      '✦ AI 综合分析'
    )}
  </button>

  {summaryStatus === 'error' && (
    <p className="mt-2 text-xs text-red-400 text-center">分析失败，请重试</p>
  )}

  {summaryResult && (
    <div className="mt-3 space-y-3">
      {(
        [
          summaryResult.confirmedDecisions,
          summaryResult.openQuestions,
          summaryResult.overlookedConsiderations,
          summaryResult.suggestedNextSteps,
        ] as SummaryResult[keyof SummaryResult][]
      ).map((section) => (
        section.items.length > 0 && (
          <div key={section.title}>
            <h4 className="text-xs font-semibold text-neutral-400 mb-1">{section.title}</h4>
            <ul className="space-y-1">
              {section.items.map((item, i) => (
                <li key={i} className="text-xs text-neutral-300 flex gap-1.5">
                  <span className="mt-0.5 shrink-0 text-violet-400">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )
      ))}
    </div>
  )}
</div>
```

**验证**:
- [ ] 打开 decision-drawer，顶部显示「✦ AI 综合分析」紫色按钮
- [ ] 点击按钮后变为「正在分析...」带转圈动画（MockAI 约 1.2-1.8s）
- [ ] 分析完成后显示四节结构化内容
- [ ] 点击「清除分析结果」后恢复初始按钮状态

---

## 下次迭代（已记录，不在本次范围内）

| 优先级 | 描述 | 改动文件 |
|--------|------|---------|
| P2a | Direction 确认后自动注入所有 chat-node 的 system prompt | `canvas-store.ts` |
| P3 | `quickNotes` 从 localStorage 迁移到 canvas 快照 | `canvas-store.ts` + `decision-drawer.tsx` |
| P5 | `loadSnapshot` 时重置 `streaming`/`isExpanding` 等运行时状态 | `canvas-store.ts` |
| P4 | 空画布新用户引导卡片（需 UX 设计后规划） | 新组件 |

---

## References

- Brainstorm 文档：`docs/brainstorms/2026-03-22-exploration-flow-completeness-brainstorm.md`
- Direction Tree 上下文实现：`src/canvas/store/canvas-store.ts:460-484`（`submitOpinion` 祖先链遍历）
- 现有 BRAINSTORM_ROLE：`src/canvas/lib/prompt-builder.ts:4-15`
- AIClient 接口：`src/canvas/types.ts:107-110`
- 服务端路由模式：`server/app.ts:160-176`（`/api/directions` 参考）
- decision-drawer quickNotes：`src/components/decision-drawer.tsx`（localStorage 存储模式）
