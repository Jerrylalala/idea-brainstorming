---
name: generateDirections prompt 模板在两个客户端完整重复
description: AnthropicAIClient 和 OpenAICompatibleClient 各有一份完全相同的 prompt 构建逻辑和 JSON 解析逻辑
type: quality
status: pending
priority: p2
issue_id: "021"
tags: [code-review, dry, ai-client, prompt]
---

## Problem Statement

`real-ai-client.ts` 第 49-90 行和 `openai-compatible-client.ts` 第 47-84 行持有完全相同的：
1. `contextPart` 模板字符串构建（6 行）
2. `prompt` 字符串（15 行中文提示词）
3. JSON 提取逻辑 `text.match(/\[[\s\S]*\]/)`（4 行）

Prompt 调优时必须同步修改两处，实践中极易遗漏，导致两个 client 行为不一致。

## Proposed Solutions

### 方案 A（推荐）：提取到现有 prompt-builder.ts

```typescript
// src/canvas/lib/prompt-builder.ts - 新增两个函数

export function buildDirectionPrompt(input: DirectionRequest): string {
  const contextPart = input.parentContext
    ? `
父方向：${input.parentContext.parentTitle}
父摘要：${input.parentContext.parentSummary}
用户补充意见：${input.parentContext.userOpinion}
祖先链：${input.parentContext.ancestorTitles.join(' → ')}
`
    : ''

  return `你是一个创意探索助手。用户正在探索以下想法：

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
}

export function parseDirectionsJSON(text: string): Direction[] {
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('AI 返回格式错误')
  return JSON.parse(jsonMatch[0]) as Direction[]
}
```

两个 client 的 `generateDirections` 改为：

```typescript
async generateDirections(input: DirectionRequest): Promise<Direction[]> {
  const prompt = buildDirectionPrompt(input)
  // ... 各自的 API 调用（这部分确实不同）
  const text = /* 从 response 提取文本 */
  return parseDirectionsJSON(text)
}
```

净减少约 25 行重复代码。

## Acceptance Criteria

- [ ] `buildDirectionPrompt` 和 `parseDirectionsJSON` 在 `prompt-builder.ts` 中定义
- [ ] 两个 client 的 `generateDirections` 使用这两个函数
- [ ] 两处 `import { AnthropicAIClient }` 的 prompt 内容完全一致

## Work Log

- 2026-03-18: 代码审查发现，architecture-strategist (P2-A) + performance-oracle (Finding 4) + code-simplicity-reviewer 三方一致确认
