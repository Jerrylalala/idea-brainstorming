---
status: pending
priority: p1
issue_id: "025"
tags: [code-review, data-integrity, migration]
dependencies: []
---

# Migration 函数先删旧 Key 再写新数据，存在数据丢失风险

## Problem Statement

`migrateFromLegacy()` 在函数末尾无条件删除旧 localStorage key，但写入新格式的操作在 `loadConnections()` 中进行。如果迁移产生空数组（所有 cfg 为 falsy），旧 key 被删除但新 key 从未写入，用户的 API Key 永久丢失。

## Findings

- `ai-config-store.ts:148-151`：`localStorage.removeItem` 在循环结束后无条件执行
- `ai-config-store.ts:213-219`：`loadConnections` 只在 `connections.length > 0` 时才写入新格式
- 如果 `migrateFromLegacy()` 返回空数组，旧 key 已删，新 key 未写，用户数据消失
- 同样风险：`JSON.parse` 抛出异常时，外层 `catch` 返回空状态，但旧 key 已被删除（取决于异常发生时机）
- 多个审查代理（Kieran、DHH、Data Integrity）均独立发现此问题

## Proposed Solutions

### Option 1: 先写后删（推荐）

**Approach:** 将 `localStorage.removeItem` 移出 `migrateFromLegacy()`，改为在 `loadConnections()` 确认写入成功后执行。

```typescript
function migrateFromLegacy(): Connection[] {
  const rawConfigs = localStorage.getItem(STORAGE_KEY_CONFIGS)
  if (!rawConfigs) return []
  try {
    const configs = JSON.parse(rawConfigs) as Partial<Record<ProviderPreset, ProviderConfig>>
    const connections: Connection[] = []
    for (const [provider, cfg] of Object.entries(configs)) {
      if (!cfg) continue
      // ... build connection
    }
    return connections  // 不在这里删除旧 key
  } catch {
    return []  // 解析失败，保留旧数据
  }
}

// 在 loadConnections 中：
if (connections.length > 0) {
  localStorage.setItem(STORAGE_KEY_CONNECTIONS, JSON.stringify(connections))
  // 确认写入后才删除旧 key
  localStorage.removeItem(STORAGE_KEY_CONFIGS)
  localStorage.removeItem(STORAGE_KEY_ACTIVE)
  localStorage.removeItem(LEGACY_KEY)
}
```

**Pros:** 原子性更强，失败时旧数据保留可重试
**Cons:** 需要同时修改两个函数
**Effort:** 30 分钟
**Risk:** Low

---

### Option 2: 在 migrateFromLegacy 内部条件删除

**Approach:** 只在 `connections.length > 0` 时才删除旧 key。

**Pros:** 改动最小
**Cons:** 仍然无法处理 `localStorage.setItem` 失败的情况
**Effort:** 15 分钟
**Risk:** Low

## Recommended Action

使用 Option 1，同时在 `migrateFromLegacy` 内部加 try/catch 包裹 `JSON.parse`。

## Technical Details

**Affected files:**
- `src/canvas/lib/ai-config-store.ts:125-154` — migrateFromLegacy
- `src/canvas/lib/ai-config-store.ts:208-234` — loadConnections

## Acceptance Criteria

- [ ] 迁移产生空数组时，旧 key 不被删除
- [ ] JSON.parse 失败时，旧 key 不被删除
- [ ] 迁移成功后，旧 key 被正确清理
- [ ] 手动测试：清空 ai_connections，写入旧格式 ai_configs，刷新页面，连接正确迁移

## Work Log

### 2026-03-19 - Code Review Discovery

**By:** Claude Code (review agents: Kieran, DHH, Data Integrity Guardian)

**Actions:** 发现于并行代码审查，三个独立代理均报告此问题
