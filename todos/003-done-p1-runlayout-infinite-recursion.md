---
name: runLayout 无限递归无终止条件
description: 节点无法被 ReactFlow 测量时，rAF 链无限执行，导致页面卡死
type: bug
status: pending
priority: p1
issue_id: "003"
tags: [code-review, performance, reactflow, infinite-loop]
---

## Problem Statement

`use-auto-layout.ts` 中的 `runLayout` 在节点未被测量时会递归调用自身（通过双 rAF），没有任何终止条件。如果某个节点因为 CSS 问题、渲染错误或 ReactFlow 内部问题永远无法被测量，rAF 链会以每帧 2 次的速度无限执行，持续占用主线程，导致页面完全卡死。

**Why:** 可以在生产环境造成页面卡死，是最高优先级的稳定性问题。

**How to apply:** 所有递归/重试逻辑都必须有最大重试次数限制。

## Findings

**位置：** `src/canvas/hooks/use-auto-layout.ts` - `runLayout` 函数

```typescript
const allMeasured = layoutableNodes.every(n => measuredNodes.has(n.id))
if (!allMeasured) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      runLayout()  // ← 无终止条件的递归
    })
  })
  return
}
```

**触发条件：**
- 节点 CSS 包含 `display: none` 或 `visibility: hidden`
- 节点组件抛出渲染错误（被 ErrorBoundary 捕获，节点不渲染）
- 节点类型未在 `nodeTypes` 中注册
- ReactFlow 的 ResizeObserver 在某些浏览器版本下静默失败

**叠加风险：** Effect 2（`storeNodes.length` 变化时）也会调用 `runLayout`，两条 rAF 链会并行运行，互相叠加，加速 CPU 消耗。

## Proposed Solutions

### 方案 A：重试计数器 + 超时降级（推荐）

```typescript
const retryCount = useRef(0)
const MAX_RETRIES = 20  // 约 20 帧 ≈ 333ms@60fps

const runLayout = useCallback(() => {
  // ...（获取 rfNodes、measuredNodes 等）

  const allMeasured = layoutableNodes.every(n => measuredNodes.has(n.id))
  if (!allMeasured) {
    if (retryCount.current >= MAX_RETRIES) {
      console.warn('[useAutoLayout] 节点测量超时，使用默认尺寸执行布局')
      retryCount.current = 0
      // 用默认尺寸强制执行一次布局，而不是无限等待
      const layoutedNodes = getLayoutedElements(layoutableNodes, layoutableEdges, measuredNodes)
      // ...apply layout
      return
    }
    retryCount.current++
    requestAnimationFrame(() => requestAnimationFrame(() => runLayout()))
    return
  }

  retryCount.current = 0  // 成功后重置
  // ...正常布局
}, [getNodes, fitView])
```

**优点：** 最小改动，完全解决无限循环，降级策略合理
**风险：** 低

### 方案 B：使用 `nodesInitialized` 替代手动测量检查

ReactFlow 提供 `useNodesInitialized()` hook，当所有节点都被测量后返回 `true`。可以用它替代手动检查 `measuredNodes`：

```typescript
// 只在 nodesInitialized=true 时执行布局，不需要递归重试
useEffect(() => {
  if (!nodesInitialized || layoutVersion <= 0) return
  runLayout()
}, [nodesInitialized, layoutVersion])
```

**优点：** 利用 ReactFlow 官方 API，更可靠
**缺点：** `nodesInitialized` 在节点增删时会短暂变为 false，可能导致布局延迟
**风险：** 中

## Recommended Action

方案 A 立即修复，方案 B 作为长期重构方向。

## Technical Details

- **受影响文件：** `src/canvas/hooks/use-auto-layout.ts`
- **受影响函数：** `runLayout`

## Acceptance Criteria

- [ ] 节点无法测量时，最多重试 20 次后停止
- [ ] 超时后使用默认尺寸执行布局，不卡死
- [ ] 正常情况下布局行为不变

## Work Log

- 2026-03-18: 代码审查发现，由 review 流程创建
