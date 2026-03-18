---
name: pendingFocusNodeIds 模块级可变全局状态
description: use-auto-layout.ts 使用模块级 let 变量存储聚焦状态，绕过 React/Zustand 系统
type: architecture
status: pending
priority: p2
issue_id: "007"
tags: [code-review, architecture, state-management, react]
---

## Problem Statement

`use-auto-layout.ts` 使用模块级可变变量存储聚焦目标：

```typescript
let pendingFocusNodeIds: string[] = []
export function setPendingFocusNodes(parentId: string, childIds: string[]) {
  pendingFocusNodeIds = [parentId, ...childIds]
}
```

这是一个绕过 React 状态系统的全局可变状态，存在以下问题：
1. **不可追踪**：状态变化不触发 React 重渲染，调试困难
2. **并发不安全**：多个组件实例或 StrictMode 双重渲染时行为不可预测
3. **测试困难**：模块状态在测试间泄漏，需要手动重置
4. **与 issue 006 耦合**：Store 反向依赖 Hook 的根本原因

**Why:** 模块级全局状态是 React 应用中的反模式，会导致难以复现的 bug。

**How to apply:** 所有需要跨组件共享的状态都应通过 React Context 或 Zustand Store 管理。

## Findings

**位置：** `src/canvas/hooks/use-auto-layout.ts`

```typescript
// 模块级可变全局状态 ← 问题所在
let pendingFocusNodeIds: string[] = []

export function setPendingFocusNodes(parentId: string, childIds: string[]) {
  pendingFocusNodeIds = [parentId, ...childIds]
}

// Hook 内部读取
export function useAutoLayout() {
  // ...
  useEffect(() => {
    if (pendingFocusNodeIds.length > 0) {
      // 使用 pendingFocusNodeIds
      pendingFocusNodeIds = []  // 消费后清空
    }
  }, [layoutVersion])
}
```

**React StrictMode 风险：** StrictMode 会双重调用 Effect，可能导致 `pendingFocusNodeIds` 被消费两次（第二次为空）。

## Proposed Solutions

### 方案 A：移入 Zustand Store（推荐，与 issue 006 联动）

见 issue 006 方案 A，将 `pendingFocusNodeIds` 作为 Store 状态：

```typescript
// canvas-store.ts
pendingFocusNodeIds: [] as string[],
setPendingFocusNodes: (parentId, childIds) => {
  set({ pendingFocusNodeIds: [parentId, ...childIds] })
},
clearPendingFocusNodes: () => {
  set({ pendingFocusNodeIds: [] })
},
```

```typescript
// use-auto-layout.ts
const pendingFocusNodeIds = useCanvasStore(s => s.pendingFocusNodeIds)
const clearPendingFocusNodes = useCanvasStore(s => s.clearPendingFocusNodes)

useEffect(() => {
  if (pendingFocusNodeIds.length > 0) {
    // 使用 pendingFocusNodeIds
    clearPendingFocusNodes()
  }
}, [layoutVersion, pendingFocusNodeIds])
```

**优点：** 状态可追踪，React DevTools 可见，并发安全
**风险：** 低

### 方案 B：使用 useRef 在 Hook 内部管理

如果不想修改 Store，可以用 `useRef` 在 Hook 内部管理，通过回调传递：

```typescript
// 在 searchIdea 完成后，通过 layoutNodes 的参数传递聚焦目标
layoutNodes: (focusNodeIds?: string[]) => {
  set((s) => ({ layoutVersion: s.layoutVersion + 1, pendingFocusNodeIds: focusNodeIds ?? [] }))
}
```

**优点：** 不需要额外的 Store 字段
**缺点：** 改变了 `layoutNodes` 的签名

## Recommended Action

方案 A，与 issue 006 一起修复。

## Technical Details

- **受影响文件：** `src/canvas/hooks/use-auto-layout.ts`, `src/canvas/store/canvas-store.ts`
- **关联 issue：** 006（Store 反向依赖 Hook）

## Acceptance Criteria

- [ ] 不再使用模块级 `let` 变量存储跨组件状态
- [ ] 聚焦逻辑通过 React/Zustand 系统管理
- [ ] StrictMode 下行为正确

## Work Log

- 2026-03-18: 代码审查发现，由 review 流程创建
