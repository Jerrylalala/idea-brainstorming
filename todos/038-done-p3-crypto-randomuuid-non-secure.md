---
status: pending
priority: p3
issue_id: "038"
tags: [code-review, security, compatibility]
dependencies: []
---

# crypto.randomUUID() 在非 HTTPS 上下文中不可用

## Problem Statement

`src/canvas/lib/ai-config-store.ts` 中使用 `crypto.randomUUID()` 生成连接 ID。`crypto.randomUUID()` 是 Web Crypto API 的一部分，在非安全上下文（HTTP，非 localhost）中不可用，会抛出 `TypeError`。虽然生产环境通常是 HTTPS，但本地开发如果通过 IP 地址（如 `http://192.168.1.x:5173`）访问，会导致添加连接时崩溃。

## Findings

- `src/canvas/lib/ai-config-store.ts`：`id: crypto.randomUUID()` 用于生成连接 ID
- `crypto.randomUUID()` 在 `window.isSecureContext === false` 时不可用
- 本地开发通过局域网 IP 访问时会触发此问题
- Security Sentinel 发现此问题

## Proposed Solutions

### Option 1: 添加 fallback 到 Math.random（推荐）

**Approach:**

```typescript
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // fallback for non-secure contexts
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}
```

**Pros:** 兼容非安全上下文，不影响生产环境
**Cons:** fallback 的随机性略低（但对 UI ID 足够）
**Effort:** 10 分钟
**Risk:** Low

---

### Option 2: 使用 nanoid 库

**Approach:** 引入 `nanoid`（Stars 24k+），它在所有环境中都能生成安全随机 ID。

**Pros:** 更安全，更短的 ID
**Cons:** 引入新依赖
**Effort:** 10 分钟
**Risk:** Low

## Recommended Action

Option 1，不引入新依赖，简单 fallback 即可。

## Technical Details

**Affected files:**
- `src/canvas/lib/ai-config-store.ts` — `crypto.randomUUID()` 调用处

## Acceptance Criteria

- [ ] 在非安全上下文中添加连接不崩溃
- [ ] 生成的 ID 在同一会话中唯一

## Work Log

### 2026-03-19 - Code Review Discovery

**By:** Claude Code (review agents: Security Sentinel)
