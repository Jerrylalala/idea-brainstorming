---
status: pending
priority: p1
issue_id: "027"
tags: [code-review, simplicity, duplication]
dependencies: []
---

# extractName 函数在两个文件中重复定义

## Problem Statement

`extractName(baseURL)` 函数在 `ai-config-store.ts` 和 `ai-settings-modal.tsx` 中各有一份完全相同的实现。两份实现会悄悄分叉，未来维护时容易遗漏其中一处。

## Findings

- `src/canvas/lib/ai-config-store.ts:113-123`：`export function extractName(baseURL: string)`
- `src/components/ai-settings-modal.tsx:10-18`：`export function extractName(baseURL: string)`
- 两份实现逻辑完全相同（取 hostname 倒数第二段，首字母大写）
- `ai-settings-modal.tsx` 已经从 `ai-config-store.ts` 导入其他内容，可以直接复用
- Code Simplicity Reviewer 和 Architecture Strategist 均发现此问题

## Proposed Solutions

### Option 1: 删除 modal 中的副本，从 store 导入（推荐）

**Approach:** 删除 `ai-settings-modal.tsx` 中的 `extractName` 定义，改为从 store 导入。

```typescript
// ai-settings-modal.tsx
import { useAIConnectionStore, type Connection, extractName } from '@/canvas/lib/ai-config-store'
// 删除本地的 extractName 定义
```

**Pros:** 单一来源，改动最小
**Cons:** 无
**Effort:** 5 分钟
**Risk:** Low

## Recommended Action

Option 1，直接删除 modal 中的副本。

## Technical Details

**Affected files:**
- `src/components/ai-settings-modal.tsx:10-18` — 删除此处定义
- `src/components/ai-settings-modal.tsx` import 行 — 添加 `extractName` 到导入列表

## Acceptance Criteria

- [ ] `extractName` 只在 `ai-config-store.ts` 中定义一次
- [ ] `ai-settings-modal.tsx` 从 store 导入 `extractName`
- [ ] TypeScript 编译通过

## Work Log

### 2026-03-19 - Code Review Discovery

**By:** Claude Code (review agents: Code Simplicity Reviewer, Architecture Strategist)
