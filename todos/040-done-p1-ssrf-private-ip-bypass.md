---
status: pending
priority: p1
issue_id: "040"
tags: [code-review, security, ssrf]
dependencies: []
---

# isAllowedBaseURL 未拦截 RFC 1918 / link-local HTTPS，存在 SSRF 漏洞

## Problem Statement

`server/app.ts` 的 `isAllowedBaseURL` 对所有 `https:` URL 无条件放行。攻击者可以将 `baseURL` 设为内网地址（如 `https://169.254.169.254/latest/meta-data`），通过 `/api/sniff` 或 `/api/chat` 端点让服务器向 AWS IMDS 或内网主机发起请求，窃取云实例凭证或探测内网拓扑。

## Findings

- `server/app.ts:17-28`：`if (protocol === 'https:') return true` — 无私有 IP 过滤
- 以下 URL 均可通过校验：
  - `https://169.254.169.254/latest/meta-data` — AWS IMDS 凭证窃取
  - `https://10.0.0.1/v1` — RFC 1918
  - `https://192.168.1.1/v1` — RFC 1918
  - `https://172.16.0.1/v1` — RFC 1918
- Vercel AI SDK 会对 `baseURL` 发起真实 HTTP 请求
- Security Sentinel 发现此问题

## Proposed Solutions

### Option 1: 添加私有 IP 段阻断（推荐）

**Approach:**

```typescript
const BLOCKED_HOST_PATTERNS = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,   // link-local / AWS IMDS
  /^127\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /^0\./,
]

function isAllowedBaseURL(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url)
    if (BLOCKED_HOST_PATTERNS.some(r => r.test(hostname))) return false
    if (protocol === 'https:') return true
    if (protocol === 'http:' && (hostname === 'localhost' || hostname === '127.0.0.1')) return true
    return false
  } catch {
    return false
  }
}
```

**Pros:** 阻断所有已知私有段，防御 SSRF
**Cons:** 需要维护 IP 段列表
**Effort:** 15 分钟
**Risk:** Low

---

### Option 2: DNS 解析后校验（更彻底）

**Approach:** 在发起请求前先 DNS 解析 hostname，校验解析结果不在私有段。

**Pros:** 防御 DNS rebinding 攻击
**Cons:** 增加延迟，实现复杂
**Effort:** 1 小时
**Risk:** Medium

## Recommended Action

Option 1，立即修复正则阻断。

## Technical Details

**Affected files:**
- `server/app.ts:17-28` — `isAllowedBaseURL` 函数

## Acceptance Criteria

- [ ] `https://169.254.169.254/...` 返回 400
- [ ] `https://10.0.0.1/...` 返回 400
- [ ] `https://192.168.1.1/...` 返回 400
- [ ] 合法公网 HTTPS URL 仍然通过

## Work Log

### 2026-03-19 - Security Audit Discovery

**By:** Claude Code (Security Sentinel background agent)
