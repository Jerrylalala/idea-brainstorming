---
status: pending
priority: p3
issue_id: "052"
tags: [code-review, zustand, performance, readability]
dependencies: []
---

# hasNodes/isEmpty 提取为具名 selector 或模块级常量

## Problem Statement

`isEmpty` 和 `hasNodes` 的 selector 逻辑（`s.nodes.length === 0` / `s.nodes.length > 0`）目前是 inline 函数，散落在两个不同的组件文件中。虽然 Zustand 正确识别这些 boolean 选择器不会产生不必要渲染，但提取为具名 selector 可以提高可读性和可复用性。

## Findings

- `src/canvas/search-bar.tsx:103`：
  ```tsx
  const isEmpty = useCanvasStore((s) => s.nodes.length === 0)
  ```
- `src/canvas/canvas-toolbar.tsx:269`：
  ```tsx
  const hasNodes = useCanvasStore((s) => s.nodes.length > 0)
  ```
- 两处逻辑重复且互为取反，但没有通过共享常量关联

## Proposed Solutions

### Option 1: 在 canvas-store.ts 旁边导出 selector 常量

**Approach:** 在 `canvas-store.ts` 文件末尾导出具名 selector：

```typescript
// src/canvas/store/canvas-store.ts 末尾
export const selectIsEmpty = (s: CanvasState) => s.nodes.length === 0
export const selectHasNodes = (s: CanvasState) => s.nodes.length > 0
```

消费方：
```tsx
import { useCanvasStore, selectIsEmpty } from './store/canvas-store'
const isEmpty = useCanvasStore(selectIsEmpty)
```

**Pros:**
- 可复用，一处修改（如加 loading 状态判断）影响全局
- 提高可读性

**Cons:**
- 轻微增加文件耦合

**Effort:** 10 分钟

**Risk:** Low

---

### Option 2: 保持 inline（当前做法）

**Approach:** 不改变，每处独立写 selector。

**Pros:**
- 零改动

**Cons:**
- 有轻微重复

**Effort:** 0

**Risk:** Low

## Recommended Action

P3 级别，可选做。如后续有更多 selector 需要复用，优先提取。

## Technical Details

**Affected files:**
- `src/canvas/store/canvas-store.ts` — 导出 selector
- `src/canvas/search-bar.tsx` — import selectIsEmpty
- `src/canvas/canvas-toolbar.tsx` — import selectHasNodes

## Acceptance Criteria

- [ ] selectIsEmpty / selectHasNodes 在 canvas-store.ts 中导出
- [ ] search-bar.tsx 和 canvas-toolbar.tsx 使用具名 selector
- [ ] `pnpm tsc --noEmit` 无报错

## Work Log

### 2026-03-20 - Code Review 发现

**By:** Claude Code（performance-oracle）
