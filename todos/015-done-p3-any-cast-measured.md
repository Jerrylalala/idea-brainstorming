---
name: (node as any).measured 访问 ReactFlow 内部属性
description: use-auto-layout.ts 使用 any 类型转换访问 ReactFlow 未公开的 measured 属性
type: quality
status: pending
priority: p3
issue_id: "015"
tags: [code-review, quality, reactflow, typescript]
---

## Problem Statement

`use-auto-layout.ts` 中通过 `(node as any).measured` 访问 ReactFlow 节点的内部测量属性：

```typescript
const measuredNodes = new Set(
  rfNodes
    .filter(node => (node as any).measured?.width && (node as any).measured?.height)
    .map(node => node.id)
)
```

`measured` 是 ReactFlow 的内部属性，未在公开类型定义中暴露。使用 `as any` 绕过类型系统存在以下风险：
1. ReactFlow 升级时该属性可能被重命名或移除，编译器不会报错
2. 代码意图不清晰，其他开发者不知道这是内部 API

**Why:** 依赖未公开的内部 API 会在库升级时静默失效，难以排查。

**How to apply:** 优先使用官方公开 API，必须使用内部属性时应添加注释说明风险。

## Findings

**位置：** `src/canvas/hooks/use-auto-layout.ts` - `runLayout` 函数

```typescript
// 当前实现
const measuredNodes = new Set(
  rfNodes
    .filter(node => (node as any).measured?.width && (node as any).measured?.height)
    .map(node => node.id)
)
```

**ReactFlow 官方替代方案：**
- `useNodesInitialized()` hook：当所有节点都被测量后返回 `true`（见 issue 003 方案 B）
- `node.width` 和 `node.height`：ReactFlow v11+ 中节点的公开尺寸属性（测量后由 ReactFlow 填充）

## Proposed Solutions

### 方案 A：使用公开的 width/height 属性（推荐）

```typescript
// ReactFlow v11+ 中，测量后的节点有 width 和 height 属性
const measuredNodes = new Set(
  rfNodes
    .filter(node => node.width != null && node.height != null)
    .map(node => node.id)
)
```

**优点：** 使用公开 API，类型安全，升级友好
**风险：** 极低，需确认当前 ReactFlow 版本支持

### 方案 B：使用 useNodesInitialized（与 issue 003 方案 B 联动）

```typescript
const nodesInitialized = useNodesInitialized()
// 只在 nodesInitialized=true 时执行布局，不需要手动检查 measured
```

**优点：** 完全使用官方 API
**缺点：** 需要重构布局触发逻辑（见 issue 003）

### 方案 C：保留 any 但添加类型声明

```typescript
interface MeasuredNode {
  measured?: { width: number; height: number }
}

const measuredNodes = new Set(
  rfNodes
    .filter(node => (node as unknown as MeasuredNode).measured?.width)
    .map(node => node.id)
)
```

**优点：** 比 `as any` 更明确，但仍是内部 API
**缺点：** 仍然依赖未公开属性

## Recommended Action

方案 A，先验证 `node.width/height` 在当前 ReactFlow 版本中可用。

## Technical Details

- **受影响文件：** `src/canvas/hooks/use-auto-layout.ts`
- **关联 issue：** 003（runLayout 无限递归，方案 B 使用 useNodesInitialized）

## Acceptance Criteria

- [ ] 不再使用 `as any` 访问 ReactFlow 内部属性
- [ ] 使用公开 API 检测节点是否已测量
- [ ] TypeScript 类型检查通过

## Work Log

- 2026-03-18: 代码审查发现，由 review 流程创建
