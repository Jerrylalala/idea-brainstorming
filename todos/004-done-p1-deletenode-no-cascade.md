---
name: deleteNode 无级联删除
description: 删除父节点时子节点和子边残留画布，产生孤立节点
type: bug
status: pending
priority: p1
issue_id: "004"
tags: [code-review, state-management, ux]
---

## Problem Statement

`deleteNode` 只删除目标节点及其直接连边，不递归删除子节点。删除一个 direction 节点后，其所有子 direction 节点（通过 `parentNodeId` 关联）仍留在画布上，成为无父节点的孤立节点，且无法通过正常 UI 操作删除。

**Why:** 用户删除一个方向节点时，期望整棵子树都消失，孤立节点会污染画布状态。

**How to apply:** 任何树形结构的删除操作都需要递归处理子节点。

## Findings

**位置：** `src/canvas/store/canvas-store.ts` - `deleteNode` 方法

```typescript
deleteNode: (nodeId) => {
  const { nodes, edges } = get()
  const deletedNodes = nodes.filter((n) => n.id === nodeId)  // ← 只删目标节点
  const deletedEdges = edges.filter((e) => e.source === nodeId || e.target === nodeId)
  // 子节点的 parentNodeId === nodeId，但它们不在 deletedNodes 里
}
```

**触发条件：**
- 删除任何有子节点的 direction 节点
- 子节点通过 `data.parentNodeId` 引用父节点，但删除逻辑不检查此字段

**undo 的连带问题：** `undoDelete` 只恢复 `lastDeleted`，如果级联删除了子树，undo 也需要恢复整棵子树。

## Proposed Solutions

### 方案 A：递归收集子树后批量删除（推荐）

```typescript
deleteNode: (nodeId) => {
  const { nodes, edges } = get()

  // 递归收集所有后代节点 ID
  const collectDescendants = (id: string, collected: Set<string>) => {
    collected.add(id)
    nodes
      .filter(n => n.type === 'direction' && (n as DirectionCanvasNode).data.parentNodeId === id)
      .forEach(child => collectDescendants(child.id, collected))
  }

  const toDelete = new Set<string>()
  collectDescendants(nodeId, toDelete)

  const deletedNodes = nodes.filter(n => toDelete.has(n.id))
  const deletedEdges = edges.filter(e => toDelete.has(e.source) || toDelete.has(e.target))

  set({
    lastDeleted: { nodes: deletedNodes, edges: deletedEdges },
    nodes: nodes.filter(n => !toDelete.has(n.id)),
    edges: edges.filter(e => !toDelete.has(e.source) && !toDelete.has(e.target)),
  })
  // undo 自动恢复整棵子树（lastDeleted 包含所有节点）
}
```

**优点：** 完整清理，undo 也能完整恢复
**风险：** 低

### 方案 B：仅删除直接子节点（一层）

只删除直接子节点，不递归。

**缺点：** 多层树仍有孤立节点，不推荐。

## Recommended Action

方案 A。

## Technical Details

- **受影响文件：** `src/canvas/store/canvas-store.ts`
- **受影响方法：** `deleteNode`, `undoDelete`

## Acceptance Criteria

- [ ] 删除父节点时，所有后代节点和相关边一并删除
- [ ] undo 能恢复整棵子树
- [ ] 删除叶节点时行为不变

## Work Log

- 2026-03-18: 代码审查发现，由 review 流程创建
