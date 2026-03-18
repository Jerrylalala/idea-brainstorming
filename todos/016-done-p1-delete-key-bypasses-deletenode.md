---
name: Delete 键删除绕过 deleteNode，撤销功能失效
description: ReactFlow deleteKeyCode 触发 onNodesChange 而非 deleteNode，lastDeleted 不被设置，撤销 Toast 永远不出现
type: bug
status: pending
priority: p1
issue_id: "016"
tags: [code-review, ux, reactflow, regression]
---

## Problem Statement

`brainstorm-canvas.tsx` 配置了 `deleteKeyCode="Delete"`，ReactFlow 会在用户按 Delete 键时通过 `onNodesChange` 发出 `remove` 类型的变更，最终调用 `applyNodeChanges`。但 `deleteNode()` store 方法（负责设置 `lastDeleted` 快照）从未被调用。

结果：
1. **撤销 Toast 永远不出现**：`DeleteToast` 组件监听 `lastDeleted`，但 Delete 键路径不设置它
2. **不级联删除子树**：与 issue 004 相同，Delete 键删除父节点后子节点残留（且此路径更常用）
3. **功能性回归**：撤销功能对用户完全不可用

**Why:** 核心 UX 功能（撤销删除）对用户完全失效，是功能性回归。

**How to apply:** ReactFlow 的 `onNodesChange` 需要拦截 `remove` 类型变更，走自定义删除逻辑。

## Findings

**位置：** `src/canvas/brainstorm-canvas.tsx` + `src/canvas/store/canvas-store.ts`

```typescript
// brainstorm-canvas.tsx
<ReactFlow
  deleteKeyCode="Delete"          // ← Delete 键触发 onNodesChange
  onNodesChange={onNodesChange}   // ← 直接调用 applyNodeChanges
/>

// canvas-store.ts
onNodesChange: (changes) => {
  set({ nodes: applyNodeChanges(changes, get().nodes) as CanvasNode[] })
  // ← 不检查 remove 类型，不调用 deleteNode，不设置 lastDeleted
},
```

**DeleteToast 永远不触发：**
```typescript
function DeleteToast() {
  const lastDeleted = useCanvasStore((s) => s.lastDeleted)  // 永远是 null
  if (!lastDeleted) return null  // 永远返回 null
  // ...
}
```

## Proposed Solutions

### 方案 A：在 onNodesChange 中拦截 remove 变更（推荐）

```typescript
onNodesChange: (changes) => {
  const removeChanges = changes.filter(c => c.type === 'remove')
  const otherChanges = changes.filter(c => c.type !== 'remove')

  // 先应用非删除变更
  if (otherChanges.length > 0) {
    set({ nodes: applyNodeChanges(otherChanges, get().nodes) as CanvasNode[] })
  }

  // 删除变更走自定义逻辑（级联 + 设置 lastDeleted）
  removeChanges.forEach(c => get().deleteNode(c.id))
},
```

**优点：** 统一删除路径，撤销和级联删除都能正常工作
**风险：** 低，需要确保 deleteNode 的级联逻辑（见 issue 004）先修复

### 方案 B：禁用 deleteKeyCode，改为手动监听键盘事件

```typescript
// 移除 deleteKeyCode="Delete"
// 在组件中手动监听
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const selectedNodes = getNodes().filter(n => n.selected)
      selectedNodes.forEach(n => deleteNode(n.id))
    }
  }
  document.addEventListener('keydown', handleKeyDown)
  return () => document.removeEventListener('keydown', handleKeyDown)
}, [getNodes, deleteNode])
```

**优点：** 完全控制删除行为
**缺点：** 需要手动处理多选删除

## Recommended Action

方案 A，与 issue 004（级联删除）一起修复，确保 `deleteNode` 先支持级联。

## Technical Details

- **受影响文件：** `src/canvas/store/canvas-store.ts`, `src/canvas/brainstorm-canvas.tsx`
- **关联 issue：** 004（deleteNode 不级联）
- **Codex 发现：** 2026-03-18 第二轮审查

## Acceptance Criteria

- [ ] 按 Delete 键删除节点后，撤销 Toast 出现
- [ ] 按 Delete 键删除父节点，子树一并删除
- [ ] 撤销后整棵子树恢复
- [ ] 多选删除正常工作

## Work Log

- 2026-03-18: Codex 第二轮审查发现，Claude 初次审查遗漏
