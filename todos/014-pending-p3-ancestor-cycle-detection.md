---
name: submitOpinion 祖先链遍历无环检测
description: submitOpinion 中遍历 parentNodeId 链时无循环检测，理论上可能无限循环
type: quality
status: pending
priority: p3
issue_id: "014"
tags: [code-review, quality, edge-case]
---

## Problem Statement

`submitOpinion` 中通过 `parentNodeId` 遍历祖先链构建上下文：

```typescript
let currentId: string | null = node.data.parentNodeId
while (currentId) {
  const parentNode = get().nodes.find(n => n.id === currentId)
  if (!parentNode) break
  // ...
  currentId = parentNode.data.parentNodeId
}
```

如果节点数据因 bug 或数据损坏形成循环引用（A.parentNodeId → B，B.parentNodeId → A），此循环将无限执行，挂起 UI。

**Why:** 虽然正常情况下不会发生，但防御性编程要求对树遍历添加循环检测。

**How to apply:** 所有图/树遍历都应维护已访问节点集合。

## Findings

**位置：** `src/canvas/store/canvas-store.ts` - `submitOpinion` 方法（第 423-439 行）

```typescript
const ancestorTitles: string[] = []
let currentId: string | null = node.data.parentNodeId

while (currentId) {
  const parentNode = get().nodes.find(n => n.id === currentId)
  if (!parentNode) break  // 节点不存在时退出，但循环引用时不退出

  if (parentNode.type === 'direction') {
    ancestorTitles.unshift(parentNode.data.title)
    currentId = parentNode.data.parentNodeId  // ← 如果形成环，永远不为 null
  } else if (parentNode.type === 'idea') {
    ancestorTitles.unshift(parentNode.data.idea)
    currentId = null  // 正常终止
  } else {
    break
  }
}
```

**触发条件：** 数据损坏或未来代码 bug 导致 `parentNodeId` 形成环。

## Proposed Solutions

### 方案 A：添加已访问集合（推荐）

```typescript
const ancestorTitles: string[] = []
let currentId: string | null = node.data.parentNodeId
const visited = new Set<string>([node.id])  // 防止循环

while (currentId) {
  if (visited.has(currentId)) {
    console.warn('[submitOpinion] 检测到祖先链循环引用，终止遍历')
    break
  }
  visited.add(currentId)

  const parentNode = get().nodes.find(n => n.id === currentId)
  if (!parentNode) break
  // ...
}
```

**优点：** 防御性编程，O(n) 空间，不影响正常路径性能
**风险：** 极低

## Recommended Action

方案 A，一行代码的防御。

## Technical Details

- **受影响文件：** `src/canvas/store/canvas-store.ts`
- **受影响方法：** `submitOpinion`

## Acceptance Criteria

- [ ] 祖先链遍历有循环检测
- [ ] 检测到循环时打印警告并安全退出
- [ ] 正常情况下行为不变

## Work Log

- 2026-03-18: 代码审查发现，由 review 流程创建
