---
name: 变量名遮蔽（storeNodes 内外层同名）
description: use-auto-layout.ts 中 runLayout 内部声明的 storeNodes 遮蔽外层同名变量
type: quality
status: pending
priority: p2
issue_id: "010"
tags: [code-review, quality, readability]
---

## Problem Statement

`use-auto-layout.ts` 中存在变量名遮蔽（variable shadowing）：外层 Hook 作用域有 `storeNodes`，`runLayout` 函数内部又声明了同名的 `const storeNodes`，导致内外层引用不同的值，容易引发混淆和 bug。

**Why:** 变量遮蔽是常见的 bug 来源，特别是在 React Hook 中，外层变量通常是 stale closure 的来源。

**How to apply:** 内层作用域的变量应使用不同名称，避免遮蔽外层变量。

## Findings

**位置：** `src/canvas/hooks/use-auto-layout.ts`

```typescript
export function useAutoLayout() {
  // 外层：从 store 订阅的节点（可能是 stale closure）
  const storeNodes = useCanvasStore(s => s.nodes)
  const storeEdges = useCanvasStore(s => s.edges)

  const runLayout = useCallback(() => {
    // 内层：重新从 store 获取最新节点（为了避免 stale closure）
    const storeNodes = useCanvasStore.getState().nodes  // ← 遮蔽外层 storeNodes
    const storeEdges = useCanvasStore.getState().edges  // ← 遮蔽外层 storeEdges

    // 后续代码使用的是内层 storeNodes，但读者可能误以为是外层
  }, [getNodes, fitView])
}
```

**潜在 bug：** Effect 2 依赖外层 `storeNodes.length`，但 `runLayout` 内部使用内层 `storeNodes`。如果两者不同步，可能导致布局基于过时数据。

## Proposed Solutions

### 方案 A：重命名内层变量（推荐）

```typescript
const runLayout = useCallback(() => {
  // 明确表示这是从 store 直接获取的最新快照
  const latestNodes = useCanvasStore.getState().nodes
  const latestEdges = useCanvasStore.getState().edges

  // 后续使用 latestNodes / latestEdges
}, [getNodes, fitView])
```

**优点：** 消除歧义，代码意图清晰
**风险：** 极低（纯重命名）

### 方案 B：移除外层订阅，统一在 runLayout 内获取

如果外层 `storeNodes` 只用于 Effect 2 的 `.length` 依赖，可以改为：

```typescript
// 只订阅 direction/idea 节点数量（见 issue 008）
const directionNodeCount = useCanvasStore(s =>
  s.nodes.filter(n => n.type === 'direction' || n.type === 'idea').length
)
// 移除外层 storeNodes/storeEdges 订阅
```

**优点：** 消除遮蔽的根本原因，同时解决 issue 008
**风险：** 低

## Recommended Action

方案 A 立即修复，方案 B 与 issue 008 一起处理。

## Technical Details

- **受影响文件：** `src/canvas/hooks/use-auto-layout.ts`
- **关联 issue：** 008（Effect2 触发范围过宽）

## Acceptance Criteria

- [ ] `runLayout` 内部不再有与外层同名的变量
- [ ] 代码意图清晰，无歧义

## Work Log

- 2026-03-18: 代码审查发现，由 review 流程创建
