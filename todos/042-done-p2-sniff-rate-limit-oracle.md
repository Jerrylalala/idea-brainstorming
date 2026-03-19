---
status: pending
priority: p2
issue_id: "042"
tags: [code-review, security, api, rate-limiting]
dependencies: [040]
---

# /api/sniff 无认证无限速，可作为网络探测 oracle 和 token 消耗放大器

## Problem Statement

`/api/sniff` 每次调用发起两个并行 LLM API 请求，且无速率限制、无认证、错误信息详细（包含 `ECONNREFUSED`/`ENOTFOUND` 等网络错误）。攻击者可以：
1. 通过迭代 `baseURL` 枚举内网主机和端口（网络拓扑 oracle）
2. 在紧循环中调用，放大 API Key 持有者的 token 消耗

## Findings

- `server/app.ts:118-157`：无速率限制，无认证
- 错误信息通过 `AggregateError.errors` 原样返回，包含网络层细节
- 结合 P1-1 SSRF 漏洞，可探测内网拓扑
- Security Sentinel 发现此问题

## Proposed Solutions

### Option 1: 错误信息脱敏 + 简单速率限制（推荐）

**Approach:**

```typescript
// 错误信息脱敏
const sanitizeError = (e: unknown): string => {
  if (!(e instanceof Error)) return '连接失败'
  if (e.message.includes('ECONNREFUSED') || e.message.includes('ENOTFOUND')) {
    return '无法连接到指定地址，请检查 URL'
  }
  if (e.message.includes('401') || e.message.includes('403')) {
    return 'API Key 无效或无权限'
  }
  return '连接失败，请检查 URL 和 API Key'
}

// 简单内存速率限制（每 IP 每分钟 10 次）
const sniffRateLimit = new Map<string, { count: number; resetAt: number }>()
```

**Pros:** 消除信息泄露，限制滥用
**Cons:** 内存速率限制在多实例部署时不共享
**Effort:** 30 分钟
**Risk:** Low

## Recommended Action

Option 1，先修复 P1-1 SSRF，再做错误脱敏。

## Technical Details

**Affected files:**
- `server/app.ts:142-156` — 错误处理和返回

## Acceptance Criteria

- [ ] 错误信息不包含 `ECONNREFUSED`/`ENOTFOUND`/`ETIMEDOUT` 等网络细节
- [ ] 连续调用超过阈值时返回 429

## Work Log

### 2026-03-19 - Security Audit Discovery

**By:** Claude Code (Security Sentinel background agent)
