---
title: "feat: 真实 AI 接入（Phase 1）"
type: feat
date: 2026-03-18
risk_score: 3
risk_level: low
risk_note: "主要风险来自 Anthropic API key 暴露在前端，开发阶段用 .env.local 隔离可接受"
---

## Overview

**Goal**: 用 `AnthropicAIClient` 替换 `MockAIClient`，让画布的对话和方向生成功能接入真实 AI
**Tech Stack**: `@anthropic-ai/sdk`（浏览器兼容模式）、Vite 环境变量
**Architecture**: 新增一个实现类，通过环境变量切换 Mock/真实，零后端改动

> 来源：`docs/brainstorms/2026-03-18-ai-integration-and-feature-gaps-brainstorm.md`（方案 A）

---

## 背景

当前 `src/canvas/lib/ai-client.ts` 只有一行：

```ts
export const aiClient: AIClient = new MockAIClient()
```

`AIClient` 接口已设计完整，包含两个方法：
- `streamChat(input: ChatRequest): AsyncGenerator<ChatChunk>` — 流式对话
- `generateDirections(input: DirectionRequest): Promise<Direction[]>` — 方向生成（返回结构化 JSON）

改动范围极小：新增一个实现文件 + 改 `ai-client.ts` 一行 + 新增 `.env.local`。

---

## 任务清单

### Task 1: 安装 @anthropic-ai/sdk

**操作**:
- [x] 在项目根目录运行安装命令

**命令**:
```bash
cd "F:\StudyFolder\StudyDest\project\tools\test\idea-brainstorming"
npm install @anthropic-ai/sdk
```

**验证**:
- [x] `package.json` 的 `dependencies` 中出现 `"@anthropic-ai/sdk"`

---

### Task 2: 创建 .env.local 存放 API Key

**文件**: `.env.local`（项目根目录，已在 .gitignore 中）

**内容**:
```
VITE_ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxx
```

**操作**:
- [x] 在项目根目录创建 `.env.local`
- [ ] 填入真实的 Anthropic API key（需用户手动填写）
- [x] 确认 `.gitignore` 包含 `.env.local`（Vite 默认已包含）

**验证**:
- [x] `git status` 中 `.env.local` 不出现（已被忽略）

---

### Task 3: 新增 real-ai-client.ts — streamChat 实现

**文件**: `src/canvas/lib/real-ai-client.ts`

**代码**:
```ts
import Anthropic from '@anthropic-ai/sdk'
import type { AIClient, ChatRequest, ChatChunk, DirectionRequest, Direction } from '../types'

const MODEL = 'claude-sonnet-4-6'

export class AnthropicAIClient implements AIClient {
  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true,
    })
  }

  async *streamChat(input: ChatRequest): AsyncGenerator<ChatChunk> {
    const systemMsg = input.messages.find(m => m.role === 'system')
    const userMessages = input.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.text,
      }))

    try {
      const stream = this.client.messages.stream({
        model: MODEL,
        max_tokens: 2048,
        system: systemMsg?.text,
        messages: userMessages,
      })

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield { type: 'delta', text: event.delta.text }
        }
      }

      yield { type: 'done' }
    } catch (err) {
      yield { type: 'error', error: err instanceof Error ? err.message : '未知错误' }
    }
  }
```

**验证**:
- [x] TypeScript 无报错（`tsc --noEmit`）

---

### Task 4: 新增 real-ai-client.ts — generateDirections 实现

**文件**: `src/canvas/lib/real-ai-client.ts`（续接 Task 3）

**代码**（追加到 Task 3 的类中）:
```ts
  async generateDirections(input: DirectionRequest): Promise<Direction[]> {
    const contextPart = input.parentContext
      ? `
父方向：${input.parentContext.parentTitle}
父摘要：${input.parentContext.parentSummary}
用户补充意见：${input.parentContext.userOpinion}
祖先链：${input.parentContext.ancestorTitles.join(' → ')}
`
      : ''

    const prompt = `你是一个创意探索助手。用户正在探索以下想法：

"${input.idea}"
${contextPart}
请生成 5-7 个不同的探索方向。

**严格按照以下 JSON 格式输出，不要有任何其他文字**：
[
  {
    "title": "方向标题（5字以内）",
    "summary": "一句话描述（20字以内）",
    "keywords": ["关键词1", "关键词2", "关键词3"]
  }
]`

    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')

    // 提取 JSON 数组（兼容 AI 可能输出 markdown 代码块的情况）
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('AI 返回格式错误')

    const directions = JSON.parse(jsonMatch[0]) as Direction[]
    return directions
  }
}
```

**验证**:
- [x] TypeScript 无报错（`tsc --noEmit`）

---

### Task 5: 修改 ai-client.ts — 根据环境变量切换

**文件**: `src/canvas/lib/ai-client.ts`

**当前内容**:
```ts
import type { AIClient } from '../types'
import { MockAIClient } from './mock-ai'

export const aiClient: AIClient = new MockAIClient()
```

**修改为**:
```ts
import type { AIClient } from '../types'
import { MockAIClient } from './mock-ai'
import { AnthropicAIClient } from './real-ai-client'

const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined

// 有 API key 时使用真实 AI，否则降级到 Mock
export const aiClient: AIClient = apiKey
  ? new AnthropicAIClient(apiKey)
  : new MockAIClient()
```

**验证**:
- [x] TypeScript 无报错
- [x] 无 `.env.local` 时应用正常启动（降级 Mock）

---

### Task 6: 验证端到端功能

**操作**:
- [ ] 启动开发服务器：`npm run dev`
- [ ] 在 SearchBar 输入想法，点击"探索"
- [ ] 确认画布出现 IdeaNode + 真实 AI 生成的 DirectionNode（非 mock 模板数据）
- [ ] 点击 DirectionNode 的展开按钮，输入意见，确认子方向由真实 AI 生成
- [ ] 从 TextNode 拖线创建 ChatNode，发送消息，确认流式回复正常
- [ ] 断开网络或填入错误 key，确认降级到 Mock 或显示错误状态

---

## 开放问题处理

| 问题 | 处理方式 |
|------|----------|
| `generateDirections` 输出格式 | 用 `jsonMatch` 正则提取 JSON 数组，兼容 markdown 代码块包裹 |
| 流式错误处理 | `try/catch` 捕获后 `yield { type: 'error' }`，ChatNode 已有 error 状态展示 |
| key 安全 | 开发阶段 `.env.local` + `dangerouslyAllowBrowser`，生产环境后续加后端代理 |

---

## 文件变更清单

| 文件 | 操作 |
|------|------|
| `src/canvas/lib/real-ai-client.ts` | 新增 |
| `src/canvas/lib/ai-client.ts` | 修改（3行 → 7行） |
| `.env.local` | 新增（不提交 git） |
| `package.json` | 新增依赖 `@anthropic-ai/sdk` |

---

## 验收标准

- [ ] 有 `VITE_ANTHROPIC_API_KEY` 时，方向生成和对话均调用真实 Anthropic API
- [ ] 无 key 时自动降级到 MockAI，应用正常运行
- [ ] 流式对话逐字输出，无卡顿
- [ ] `generateDirections` 返回结构化数据（title/summary/keywords），格式与 `Direction` 类型一致
- [ ] TypeScript 编译无报错
