---
status: pending
priority: p2
issue_id: "033"
tags: [code-review, data-integrity, error-handling]
dependencies: []
---

# removeConnection 中 localStorage.setItem 失败时静默丢失数据

## Problem Statement

`removeConnection` 和 `updateConnection` 等写操作调用 `saveConnections()`，而 `saveConnections()` 内部的 `localStorage.setItem()` 可能因存储配额超限（`QuotaExceededError`）或隐私模式限制而抛出异常。当前代码没有 try/catch，异常会向上冒泡导致 store 状态与持久化状态不一致：内存中已删除，但 localStorage 未更新（或反之）。

## Findings

- `src/canvas/lib/ai-config-store.ts`：`saveConnections()` 直接调用 `localStorage.setItem()`，无错误处理
- `removeConnection`、`updateConnection`、`addConnection` 均调用 `saveConnections()`
- 如果 `setItem` 抛出，Zustand state 已更新但持久化失败，刷新后数据恢复
- 隐私模式下 Safari 的 localStorage 配额为 0，必然失败
- Data Integrity Guardian 发现此问题

## Proposed Solutions

### Option 1: saveConnections 内部 try/catch + 错误回调（推荐）

**Approach:**

```typescript
function saveConnections(connections: Connection[]): boolean {
  try {
    const toSave = connections.map(({ status: _, ...rest }) => rest)
    localStorage.setItem(STORAGE_KEY_CONNECTIONS, JSON.stringify(toSave))
    return true
  } catch (err) {
    console.error('[ai-config-store] 保存连接失败:', err)
    return false
  }
}
```

调用方可以根据返回值决定是否回滚 state 或显示错误提示。

**Pros:** 防止静默数据丢失，提供错误可见性
**Cons:** 调用方需要处理返回值（可选）
**Effort:** 15 分钟
**Risk:** Low

---

### Option 2: 全局错误边界 + toast 提示

**Approach:** 在 `saveConnections` 失败时触发全局 toast 提示用户"保存失败，请检查浏览器存储设置"。

**Pros:** 用户可见的错误反馈
**Cons:** 需要 toast 基础设施
**Effort:** 30 分钟
**Risk:** Low

## Recommended Action

Option 1，最小改动，先让错误可见。

## Technical Details

**Affected files:**
- `src/canvas/lib/ai-config-store.ts` — `saveConnections` 函数

## Acceptance Criteria

- [ ] `saveConnections` 内部有 try/catch
- [ ] 失败时 `console.error` 记录错误
- [ ] 不会因 localStorage 异常导致未捕获错误

## Work Log

### 2026-03-19 - Code Review Discovery

**By:** Claude Code (review agents: Data Integrity Guardian)
