---
name: 拖拽排序与 localStorage 初始化冲突
description: 拖拽后排序被 useEffect 依赖 Map 对象重新覆盖，导致排序丢失
type: bug
status: pending
priority: p2
issue_id: "005"
tags: [code-review, ux, state-management, react]
---

## Problem Statement

`DecisionDrawer` 中的排序状态（`confirmedOrder` / `pendingOrder`）由两个 `useEffect` 管理：一个从 localStorage 初始化，一个在节点变化时同步新增/删除节点。但 `useEffect` 的依赖项包含 `confirmedNodesMap` 和 `pendingNodesMap`（`useMemo` 生成的 Map 对象），每次 store 更新都会重新生成这两个 Map，触发 `useEffect` 重新执行，将排序重置为"localStorage 存储的顺序 + 新节点追加"，覆盖用户刚完成的拖拽排序。

**Why:** 用户拖拽排序后立即被覆盖，排序功能实际上不可用。

**How to apply:** useEffect 依赖项中的对象引用必须稳定，或改用不依赖 Map 的同步逻辑。

## Findings

**位置：** `src/components/decision-drawer.tsx` - 初始化 useEffect

```typescript
// 每次 directionNodes 变化 → confirmedNodesMap/pendingNodesMap 重新生成（新 Map 引用）
// → 触发此 useEffect → 重置排序
useEffect(() => {
  // ...从 localStorage 读取并重置 confirmedOrder/pendingOrder
}, [confirmedNodesMap, pendingNodesMap]);  // ← Map 对象每次都是新引用
```

**触发时序：**
1. 用户拖拽 item A 到 item B 前面 → `setConfirmedOrder([..., A, B, ...])`
2. `moveToCategory` 更新 store → `directionNodes` 变化
3. `confirmedNodesMap` 重新生成（新 Map 引用）
4. `useEffect` 触发 → 从 localStorage 读取旧顺序 → 覆盖步骤 1 的排序

## Proposed Solutions

### 方案 A：分离初始化与同步逻辑（推荐）

将"首次初始化"和"节点增删同步"分开处理：

```typescript
// 只在挂载时初始化一次（空依赖数组）
useEffect(() => {
  const storedConfirmed = localStorage.getItem(STORAGE_KEY_CONFIRMED)
  const initialIds = Array.from(confirmedNodesMap.keys())
  if (storedConfirmed) {
    try {
      const parsed = JSON.parse(storedConfirmed) as string[]
      const valid = parsed.filter(id => confirmedNodesMap.has(id))
      const newIds = initialIds.filter(id => !valid.includes(id))
      setConfirmedOrder([...valid, ...newIds])
    } catch {
      setConfirmedOrder(initialIds)
    }
  } else {
    setConfirmedOrder(initialIds)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []) // 只在挂载时运行

// 节点增删时，只追加新节点、移除已删节点，不重置顺序
useEffect(() => {
  setConfirmedOrder(prev => {
    const currentIds = new Set(confirmedNodesMap.keys())
    const filtered = prev.filter(id => currentIds.has(id))
    const newIds = Array.from(currentIds).filter(id => !prev.includes(id))
    return [...filtered, ...newIds]
  })
}, [confirmedNodesMap])
```

**优点：** 初始化和同步职责分离，拖拽排序不被覆盖
**风险：** 低

### 方案 B：用 ID 数组替代 Map 作为依赖

将 `confirmedNodesMap` 改为 `confirmedNodeIds`（字符串数组），稳定引用。

**缺点：** 需要额外的 useMemo，改动较多。

## Recommended Action

方案 A。

## Technical Details

- **受影响文件：** `src/components/decision-drawer.tsx`
- **受影响逻辑：** 排序初始化 useEffect（第 199-230 行）

## Acceptance Criteria

- [ ] 拖拽排序后，排序不被 useEffect 覆盖
- [ ] 新增节点时，追加到列表末尾，不重置已有顺序
- [ ] 删除节点时，从列表中移除，不影响其他节点顺序

## Work Log

- 2026-03-18: 代码审查发现，由 review 流程创建
