---
name: useAutoLayout Effect2 触发范围过宽
description: storeNodes.length 变化时触发布局，text/chat 节点增删也会触发不必要的重新布局
type: performance
status: pending
priority: p2
issue_id: "008"
tags: [code-review, performance, reactflow]
---

## Problem Statement

`use-auto-layout.ts` 中的 Effect 2 监听 `storeNodes.length` 变化来触发布局：

```typescript
useEffect(() => {
  if (storeNodes.length > 0) runLayout()
}, [storeNodes.length])
```

但 `storeNodes` 包含所有节点类型（text、chat、direction、idea）。当用户在画布上添加文本节点或发送聊天消息时，`storeNodes.length` 变化，触发不必要的树形布局重新计算，浪费 CPU 并可能导致布局抖动。

**Why:** 不必要的布局触发会影响性能，且可能在用户操作文本/聊天节点时产生意外的画布移动。

**How to apply:** Effect 依赖项应精确匹配实际需要响应的状态变化。

## Findings

**位置：** `src/canvas/hooks/use-auto-layout.ts` - Effect 2

```typescript
// Effect 2：节点数量变化时触发布局
useEffect(() => {
  if (storeNodes.length > 0) runLayout()
}, [storeNodes.length])  // ← 所有节点类型都会触发
```

**触发场景（不应触发布局）：**
- 用户双击画布添加文本节点
- 用户从边创建聊天节点
- 用户展开笔记（`expandNote`）

**与 Effect 1 的叠加：** `layoutVersion` 变化时 Effect 1 也会触发布局，两个 Effect 可能同时触发，产生两条并行的 rAF 链（见 issue 003）。

## Proposed Solutions

### 方案 A：只监听 direction/idea 节点数量（推荐）

```typescript
const directionNodeCount = useCanvasStore(
  s => s.nodes.filter(n => n.type === 'direction' || n.type === 'idea').length
)

useEffect(() => {
  if (directionNodeCount > 0) runLayout()
}, [directionNodeCount])
```

**优点：** 精确触发，不影响文本/聊天节点操作
**风险：** 低

### 方案 B：移除 Effect 2，统一通过 layoutVersion 触发

所有需要布局的操作（`searchIdea`、`submitOpinion`）都已调用 `layoutNodes()` 触发 `layoutVersion` 变化，Effect 1 会响应。Effect 2 是冗余的。

```typescript
// 删除 Effect 2，只保留 Effect 1
useEffect(() => {
  if (layoutVersion > 0) runLayout()
}, [layoutVersion])
```

**优点：** 消除冗余，布局触发路径唯一
**缺点：** 需要确认所有布局触发点都调用了 `layoutNodes()`
**风险：** 低

## Recommended Action

方案 B，消除冗余 Effect，统一布局触发路径。

## Technical Details

- **受影响文件：** `src/canvas/hooks/use-auto-layout.ts`
- **关联 issue：** 003（runLayout 无限递归，两条 rAF 链叠加风险）

## Acceptance Criteria

- [ ] 添加文本/聊天节点不触发树形布局
- [ ] direction/idea 节点增删时布局正常触发
- [ ] 布局触发路径清晰，无冗余

## Work Log

- 2026-03-18: 代码审查发现，由 review 流程创建
