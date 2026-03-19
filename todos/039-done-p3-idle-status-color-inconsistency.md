---
status: pending
priority: p3
issue_id: "039"
tags: [code-review, ui, consistency]
dependencies: []
---

# idle 状态颜色不一致：AIStatusBadge 用 amber，ConnectionList 用 slate

## Problem Statement

两个组件对 `idle` 状态使用了不同的颜色：
- `src/components/ai-status-badge.tsx`：`'bg-amber-400'`（黄色）
- `src/components/ai-settings-modal.tsx` 的 `ConnectionList`：`'bg-slate-300'`（灰色）

灰色更符合"未激活/空闲"的语义，黄色通常表示"警告/注意"。两处不一致会让用户对 idle 状态产生困惑。

## Findings

- `src/components/ai-status-badge.tsx`：`case 'idle': return 'bg-amber-400'`
- `src/components/ai-settings-modal.tsx`：`case 'idle': return 'bg-slate-300'`
- 两个组件都显示连接状态点，但颜色语义不同
- Code Simplicity Reviewer 发现此问题

## Proposed Solutions

### Option 1: 提取共享的状态颜色映射（推荐）

**Approach:**

```typescript
// src/canvas/lib/connection-status.ts
export const STATUS_COLORS = {
  idle: 'bg-slate-300',
  testing: 'bg-amber-400',
  connected: 'bg-green-500',
  error: 'bg-red-500',
} as const

// 两个组件都从这里导入
```

**Pros:** 单一来源，消除不一致
**Cons:** 需要新建共享文件
**Effort:** 15 分钟
**Risk:** Low

---

### Option 2: 直接修改 ai-status-badge.tsx 中的颜色

**Approach:** 将 `ai-status-badge.tsx` 中的 `'bg-amber-400'` 改为 `'bg-slate-300'`。

**Pros:** 最小改动
**Cons:** 颜色仍然分散在两处，未来可能再次分叉
**Effort:** 2 分钟
**Risk:** Low

## Recommended Action

Option 2 作为快速修复，Option 1 作为后续重构。

## Technical Details

**Affected files:**
- `src/components/ai-status-badge.tsx` — idle 颜色

## Acceptance Criteria

- [ ] 两个组件的 idle 状态颜色一致
- [ ] idle 使用灰色（`bg-slate-300`），testing 使用黄色（`bg-amber-400`）

## Work Log

### 2026-03-19 - Code Review Discovery

**By:** Claude Code (review agents: Code Simplicity Reviewer)
