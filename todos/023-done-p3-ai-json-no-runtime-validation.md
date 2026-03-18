---
name: AI 返回的 JSON 无运行时结构校验，直接 as Direction[] 类型断言
description: generateDirections 解析 AI JSON 时使用编译时断言而非运行时校验，AI 返回异常结构会静默进入状态
type: quality
status: pending
priority: p3
issue_id: "023"
tags: [code-review, validation, ai, type-safety]
---

## Problem Statement

两个 client 的 `generateDirections` 都执行：

```typescript
return JSON.parse(jsonMatch[0]) as Direction[]
// as Direction[] 是 TypeScript 编译时断言，运行时不做任何检查
```

AI 可能返回：超长字符串（渲染问题）、缺少必填字段（runtime TypeError）、注入恶意内容（若有 XSS 向量）。

## Proposed Solutions

### 方案 A（推荐）：使用 zod 做运行时校验

```typescript
// 安装 zod（如项目未有）或使用现有校验工具
import { z } from 'zod'

const DirectionSchema = z.array(z.object({
  title: z.string().max(20),
  summary: z.string().max(100),
  keywords: z.array(z.string().max(20)).max(10),
}))

// 在 parseDirectionsJSON（抽取后）中
export function parseDirectionsJSON(text: string): Direction[] {
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('AI 返回格式错误')
  return DirectionSchema.parse(JSON.parse(jsonMatch[0]))
}
```

### 方案 B（轻量）：手动校验关键字段

```typescript
function validateDirections(raw: unknown): Direction[] {
  if (!Array.isArray(raw)) throw new Error('AI 返回格式错误')
  return raw.map((item, i) => {
    if (typeof item.title !== 'string' || typeof item.summary !== 'string') {
      throw new Error(`第 ${i + 1} 条方向格式错误`)
    }
    return {
      title: String(item.title).slice(0, 20),
      summary: String(item.summary).slice(0, 100),
      keywords: Array.isArray(item.keywords)
        ? item.keywords.slice(0, 10).map(k => String(k).slice(0, 20))
        : [],
    }
  })
}
```

## Acceptance Criteria

- [ ] AI 返回缺少 title/summary 字段时，抛出可读错误而非 runtime TypeError
- [ ] AI 返回超长字符串时，截断而非直接渲染

## Work Log

- 2026-03-18: 代码审查发现，由 security-sentinel agent 标记为 P2-2
