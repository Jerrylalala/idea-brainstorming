---
name: useRef 工厂函数每次渲染都执行
description: useRef(makePanelNodesSelector()).current 在每次渲染时调用工厂函数，虽然结果被丢弃但有不必要的开销
type: performance
status: pending
priority: p3
issue_id: "012"
tags: [code-review, performance, react]
---

## Problem Statement

`DecisionDrawer` 中使用 `useRef` 初始化选择器工厂：

```typescript
const panelSelector = useRef(makePanelNodesSelector()).current;
```

JavaScript 在调用 `useRef()` 之前会先求值参数，即每次渲染都会调用 `makePanelNodesSelector()`，创建一个新的闭包对象（包含 `cache` 变量）。虽然 `useRef` 在首次渲染后会忽略这个值，但工厂函数的调用开销仍然存在。

**Why:** 虽然 `makePanelNodesSelector()` 本身很轻量，但这是一个常见的 React 反模式，在工厂函数较重时会造成性能问题。

**How to apply:** 需要懒初始化的 `useRef` 应使用 `useMemo` 或惰性初始化模式。

## Findings

**位置：** `src/components/decision-drawer.tsx` 第 157 行

```typescript
// 当前实现：每次渲染都调用 makePanelNodesSelector()
const panelSelector = useRef(makePanelNodesSelector()).current;

// 正确的惰性初始化方式：
const panelSelector = useMemo(() => makePanelNodesSelector(), []);
// 或者：
const panelSelectorRef = useRef<ReturnType<typeof makePanelNodesSelector> | null>(null);
if (!panelSelectorRef.current) {
  panelSelectorRef.current = makePanelNodesSelector();
}
const panelSelector = panelSelectorRef.current;
```

**React 文档说明：** `useRef(initialValue)` 的 `initialValue` 参数只在首次渲染时使用，但 JS 引擎每次都会求值它。`useMemo` 才是真正的懒初始化。

## Proposed Solutions

### 方案 A：改用 useMemo（推荐）

```typescript
const panelSelector = useMemo(() => makePanelNodesSelector(), []);
```

**优点：** 语义清晰，React 官方推荐的懒初始化方式，工厂函数只调用一次
**风险：** 极低

### 方案 B：使用 useRef 惰性初始化模式

```typescript
const panelSelectorRef = useRef<ReturnType<typeof makePanelNodesSelector> | null>(null);
if (!panelSelectorRef.current) {
  panelSelectorRef.current = makePanelNodesSelector();
}
const panelSelector = panelSelectorRef.current;
```

**优点：** 不依赖 useMemo 的语义（useMemo 不保证不重新计算）
**缺点：** 代码更冗长

### 方案 C：将选择器提升为模块级单例

如果整个应用只有一个 `DecisionDrawer` 实例：

```typescript
// 模块级，只创建一次
const panelNodesSelector = makePanelNodesSelector();

export function DecisionDrawer() {
  const directionNodes = useCanvasStore(panelNodesSelector);
  // ...
}
```

**优点：** 最简单，零运行时开销
**缺点：** 多实例时共享缓存（但当前场景只有一个实例）

## Recommended Action

方案 A（`useMemo`），语义最清晰。

## Technical Details

- **受影响文件：** `src/components/decision-drawer.tsx`
- **受影响行：** 第 157 行

## Acceptance Criteria

- [ ] `makePanelNodesSelector()` 在组件生命周期内只调用一次
- [ ] 选择器缓存行为不变

## Work Log

- 2026-03-18: 代码审查发现，由 review 流程创建
