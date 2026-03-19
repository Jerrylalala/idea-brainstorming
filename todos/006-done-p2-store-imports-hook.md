---
name: Store 反向依赖 Hook 层
description: canvas-store.ts 导入 use-auto-layout.ts 的函数，违反依赖方向
type: architecture
status: pending
priority: p2
issue_id: "006"
tags: [code-review, architecture, dependency-inversion]
---

## Problem Statement

`canvas-store.ts` 直接导入了 `use-auto-layout.ts` 中的 `setPendingFocusNodes` 函数：

```typescript
import { setPendingFocusNodes } from '../hooks/use-auto-layout'
```

这违反了分层架构原则：Store 层（状态管理）不应依赖 Hook 层（React 组件逻辑）。Hook 层应该依赖 Store 层，而不是反过来。这会导致循环依赖风险、测试困难，以及 Store 在非 React 环境中无法使用。

**Why:** 依赖方向错误会导致模块耦合，增加维护成本，且在 SSR/测试环境中可能引发问题。

**How to apply:** Store 层只能依赖纯工具函数，不能依赖 React Hook 或 Hook 文件中的任何导出。

## Findings

**位置：** `src/canvas/store/canvas-store.ts` 第 13 行

```typescript
import { setPendingFocusNodes } from '../hooks/use-auto-layout'
```

**调用位置：**
- `searchIdea` 方法：`setPendingFocusNodes(ideaNode.id, directionNodes.map(n => n.id))`
- `submitOpinion` 方法：`setPendingFocusNodes(nodeId, childNodes.map(c => c.id))`

**`setPendingFocusNodes` 的实现：**
```typescript
// use-auto-layout.ts
let pendingFocusNodeIds: string[] = []
export function setPendingFocusNodes(parentId: string, childIds: string[]) {
  pendingFocusNodeIds = [parentId, ...childIds]
}
```

本质上是一个模块级全局变量的 setter，与 React 无关，但被放在了 Hook 文件中。

## Proposed Solutions

### 方案 A：将 pendingFocusNodeIds 移入 Store（推荐）

```typescript
// canvas-store.ts - 在 CanvasState 中添加
interface CanvasState {
  // ...
  pendingFocusNodeIds: string[]
  setPendingFocusNodes: (parentId: string, childIds: string[]) => void
}

// 实现
pendingFocusNodeIds: [],
setPendingFocusNodes: (parentId, childIds) => {
  set({ pendingFocusNodeIds: [parentId, ...childIds] })
},
```

然后在 `use-auto-layout.ts` 中订阅 store：
```typescript
const pendingFocusNodeIds = useCanvasStore(s => s.pendingFocusNodeIds)
```

**优点：** 依赖方向正确，状态统一管理，可测试
**风险：** 低，改动范围小

### 方案 B：提取为独立的信号模块

将 `pendingFocusNodeIds` 提取到 `src/canvas/lib/focus-signal.ts`，Store 和 Hook 都依赖这个纯 JS 模块。

**优点：** 不污染 Store 接口
**缺点：** 仍是模块级全局变量，只是换了位置

## Recommended Action

方案 A，将聚焦状态纳入 Store 统一管理。

## Technical Details

- **受影响文件：** `src/canvas/store/canvas-store.ts`, `src/canvas/hooks/use-auto-layout.ts`
- **需要同步修改：** `use-auto-layout.ts` 中读取 `pendingFocusNodeIds` 的逻辑

## Acceptance Criteria

- [ ] `canvas-store.ts` 不再导入任何 Hook 文件
- [ ] 聚焦逻辑功能不变
- [ ] 依赖方向：Hook → Store → Lib

## Work Log

- 2026-03-18: 代码审查发现，由 review 流程创建
