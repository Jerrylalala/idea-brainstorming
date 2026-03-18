---
name: 死代码清理
description: tree-layout.ts 未被导入，confirmedDirections/pendingDirections 方法未被调用
type: quality
status: pending
priority: p3
issue_id: "011"
tags: [code-review, quality, cleanup]
---

## Problem Statement

代码库中存在多处死代码，增加维护负担：

1. `src/canvas/lib/tree-layout.ts` — 完整的树形布局实现文件，但没有任何文件导入它
2. `canvas-store.ts` 中的 `confirmedDirections()` 和 `pendingDirections()` 方法 — 定义在 Store 接口中，但没有任何组件调用

**Why:** 死代码会误导开发者（以为这些功能在使用中），增加代码库体积，降低可读性。

**How to apply:** 定期清理未使用的代码，保持代码库精简。

## Findings

**位置 1：** `src/canvas/lib/tree-layout.ts`

```bash
# 验证：搜索导入
grep -r "tree-layout" src/  # 无结果
```

该文件包含完整的 ELK/dagre 风格树形布局算法，但 `use-auto-layout.ts` 使用了自己内联的布局逻辑，从未导入此文件。

**位置 2：** `src/canvas/store/canvas-store.ts`

```typescript
// 接口定义
confirmedDirections: () => DirectionNodeData[]
pendingDirections: () => DirectionNodeData[]

// 实现
confirmedDirections: () => {
  return get().nodes
    .filter(n => n.type === 'direction' && n.data.status === 'confirmed')
    .map(n => (n as DirectionCanvasNode).data)
},
pendingDirections: () => { ... }
```

`DecisionDrawer` 直接通过 `useCanvasStore` 选择器获取节点，从未调用这两个方法。

## Proposed Solutions

### 方案 A：直接删除（推荐）

```bash
# 删除死代码文件
rm src/canvas/lib/tree-layout.ts

# 从 canvas-store.ts 删除：
# - CanvasState 接口中的 confirmedDirections/pendingDirections 声明
# - 对应的实现
```

**优点：** 代码库更精简，无歧义
**风险：** 极低（确认无引用后删除）

### 方案 B：保留并添加注释

添加 `// TODO: 待集成` 注释，表明这是预留代码。

**缺点：** 不推荐，死代码就是死代码，注释无法让它活起来。

## Recommended Action

方案 A。删除前用 grep 再次确认无引用。

## Technical Details

- **受影响文件：** `src/canvas/lib/tree-layout.ts`（删除）, `src/canvas/store/canvas-store.ts`（删除方法）
- **受影响接口：** `CanvasState`（移除两个方法声明）

## Acceptance Criteria

- [ ] `tree-layout.ts` 已删除
- [ ] `confirmedDirections` 和 `pendingDirections` 已从 Store 中移除
- [ ] TypeScript 编译无错误

## Work Log

- 2026-03-18: 代码审查发现，由 review 流程创建
