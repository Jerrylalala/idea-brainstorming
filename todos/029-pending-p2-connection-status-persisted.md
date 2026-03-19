---
status: pending
priority: p2
issue_id: "029"
tags: [code-review, data-integrity, architecture]
dependencies: []
---

# Connection.status 运行时状态被持久化到 localStorage

## Problem Statement

`Connection` 接口中的 `status` 字段（`'idle' | 'testing' | 'connected' | 'error'`）是运行时状态，不应被序列化到 localStorage。当前实现将整个 `Connection` 对象直接 `JSON.stringify` 存储，导致 `status` 也被持久化。页面刷新后，上次的 `status`（如 `'connected'`）会被恢复，但实际连接状态未经验证，造成误导性 UI。

## Findings

- `src/canvas/lib/ai-config-store.ts`：`saveConnections()` 直接序列化整个 `Connection[]`，包含 `status`
- `src/canvas/lib/ai-config-store.ts`：`loadConnections()` 反序列化后直接使用，`status` 被还原为上次值
- 用户刷新页面后，连接可能显示为 `'connected'`，但实际 API Key 可能已失效
- Kieran、DHH、Data Integrity Guardian 均独立发现此问题

## Proposed Solutions

### Option 1: 保存时剥离 status，加载时重置为 idle（推荐）

**Approach:**

```typescript
function saveConnections(connections: Connection[]) {
  const toSave = connections.map(({ status: _, ...rest }) => rest)
  localStorage.setItem(STORAGE_KEY_CONNECTIONS, JSON.stringify(toSave))
}

function loadConnections(): Connection[] {
  // ...
  return parsed.map(c => ({ ...c, status: 'idle' as const }))
}
```

**Pros:** 语义正确，status 始终反映真实运行时状态
**Cons:** 需要修改两处
**Effort:** 15 分钟
**Risk:** Low

---

### Option 2: 将 status 从 Connection 接口中分离

**Approach:** 创建 `ConnectionConfig`（持久化）和 `ConnectionState`（运行时）两个类型，store 中合并使用。

**Pros:** 类型层面强制分离
**Cons:** 改动较大，影响所有消费方
**Effort:** 1-2 小时
**Risk:** Medium

## Recommended Action

Option 1，最小改动，立即修复语义问题。

## Technical Details

**Affected files:**
- `src/canvas/lib/ai-config-store.ts` — `saveConnections` 和 `loadConnections`

## Acceptance Criteria

- [ ] `saveConnections` 不序列化 `status` 字段
- [ ] `loadConnections` 加载后所有连接 `status` 为 `'idle'`
- [ ] 手动测试：设置连接为 connected，刷新页面，状态应显示为 idle

## Work Log

### 2026-03-19 - Code Review Discovery

**By:** Claude Code (review agents: Kieran, DHH, Data Integrity Guardian)
