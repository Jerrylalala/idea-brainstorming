---
status: pending
priority: p2
issue_id: "043"
tags: [code-review, security, error-handling]
dependencies: []
---

# /api/chat 流式错误直接转发 SDK 原始错误信息，可能泄露 API Key 片段

## Problem Statement

`server/app.ts` 的 `/api/chat` 流式处理中，catch 块将 `err.message` 直接发送给客户端：

```typescript
send({ type: 'error', error: err instanceof Error ? err.message : '未知错误' })
```

Vercel AI SDK 的错误信息可能包含：部分 API Key（`sk-proj-...`）、内部主机名（来自 `ECONNREFUSED` 堆栈）、TLS 证书细节。这些信息会被流式传输到浏览器，可通过 DevTools Network 面板查看。

## Findings

- `server/app.ts:86`：`err.message` 原样发送到客户端流
- 全局 `app.onError` 正确返回通用错误，但流内部 catch 绕过了它
- Security Sentinel 发现此问题

## Proposed Solutions

### Option 1: 流内错误脱敏（推荐）

**Approach:**

```typescript
function sanitizeStreamError(err: unknown): string {
  if (!(err instanceof Error)) return '未知错误'
  const msg = err.message
  if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('Invalid API key')) {
    return 'API Key 无效，请检查设置'
  }
  if (msg.includes('429') || msg.includes('rate limit')) {
    return '请求频率超限，请稍后重试'
  }
  if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('ETIMEDOUT')) {
    return '无法连接到 AI 服务，请检查网络和 URL'
  }
  // 通用错误，不暴露原始信息
  return 'AI 服务请求失败，请重试'
}

// 在 catch 块中：
send({ type: 'error', error: sanitizeStreamError(err) })
```

**Pros:** 防止敏感信息泄露，用户仍能看到有意义的错误类别
**Cons:** 调试时需要查看服务端日志
**Effort:** 20 分钟
**Risk:** Low

## Recommended Action

Option 1，同时在服务端 `console.error` 记录原始错误供调试。

## Technical Details

**Affected files:**
- `server/app.ts:85-87` — 流式 catch 块

## Acceptance Criteria

- [ ] 流式错误不包含 API Key 片段
- [ ] 流式错误不包含网络层细节（ECONNREFUSED 等）
- [ ] 服务端日志仍记录原始错误

## Work Log

### 2026-03-19 - Security Audit Discovery

**By:** Claude Code (Security Sentinel background agent)
