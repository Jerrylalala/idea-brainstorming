---
status: pending
priority: p2
issue_id: "036"
tags: [code-review, data-integrity, migration]
dependencies: [025]
---

# migrateFromLegacy 迁移后不保留 active provider，始终使用 connections[0]

## Problem Statement

`migrateFromLegacy()` 从旧格式迁移时，读取了 `STORAGE_KEY_ACTIVE`（旧的 active provider key），但迁移后的 `useAIConnectionStore` 没有将对应的连接设为 active。`loadConnections()` 中 `activeId` 始终设为 `connections[0]?.id`，忽略了用户在旧版本中选择的 active provider。用户升级后会发现 active provider 被重置，需要重新手动选择。

## Findings

- `src/canvas/lib/ai-config-store.ts`：`migrateFromLegacy()` 读取 `STORAGE_KEY_ACTIVE` 但未使用其值
- `src/canvas/lib/ai-config-store.ts`：`loadConnections()` 中 `activeId: connections[0]?.id` 硬编码为第一个
- 旧版本用户可能将 Anthropic 设为 active，迁移后变成 DeepSeek（第一个）
- Data Integrity Guardian 发现此问题

## Proposed Solutions

### Option 1: migrateFromLegacy 返回 activeId，loadConnections 使用它（推荐）

**Approach:**

```typescript
function migrateFromLegacy(): { connections: Connection[]; activeId?: string } {
  // ...
  const activeProvider = localStorage.getItem(STORAGE_KEY_ACTIVE) as ProviderPreset | null
  // ...
  const activeConnection = activeProvider
    ? connections.find(c => c.id.startsWith(activeProvider))
    : undefined

  return { connections, activeId: activeConnection?.id }
}

// 在 loadConnections 中：
const { connections, activeId } = migrateFromLegacy()
if (connections.length > 0) {
  localStorage.setItem(STORAGE_KEY_CONNECTIONS, JSON.stringify(connections))
  localStorage.removeItem(STORAGE_KEY_CONFIGS)
  localStorage.removeItem(STORAGE_KEY_ACTIVE)
  return {
    connections: connections.map(c => ({ ...c, status: 'idle' })),
    activeId: activeId ?? connections[0].id,
  }
}
```

**Pros:** 保留用户的 active provider 选择
**Cons:** 需要修改函数签名
**Effort:** 30 分钟
**Risk:** Low

---

### Option 2: 迁移后提示用户重新选择 active provider

**Approach:** 迁移完成后，在 UI 中显示提示"检测到配置迁移，请确认当前使用的 AI 连接"。

**Pros:** 用户主动确认，避免静默错误
**Cons:** 需要 UI 工作
**Effort:** 1 小时
**Risk:** Low

## Recommended Action

Option 1，在迁移时保留 active provider 选择。

## Technical Details

**Affected files:**
- `src/canvas/lib/ai-config-store.ts` — `migrateFromLegacy` 和 `loadConnections`

## Acceptance Criteria

- [ ] 迁移后 active provider 与旧版本一致
- [ ] 如果旧 active provider 不在迁移结果中，回退到 `connections[0]`
- [ ] 手动测试：设置旧格式 active=anthropic，刷新，新格式 activeId 应指向 anthropic 连接

## Work Log

### 2026-03-19 - Code Review Discovery

**By:** Claude Code (review agents: Data Integrity Guardian)
