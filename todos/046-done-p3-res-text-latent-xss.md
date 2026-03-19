---
status: pending
priority: p3
issue_id: "046"
tags: [code-review, security, xss]
dependencies: []
---

# proxy-ai-client.ts 将 res.text() 放入错误字符串，潜在 XSS 风险

## Problem Statement

`src/canvas/lib/proxy-ai-client.ts` 中，HTTP 错误响应体被直接包含在错误字符串中：

```typescript
yield { type: 'error', error: `HTTP ${res.status}: ${await res.text()}` }
```

如果此字符串未来被 `dangerouslySetInnerHTML` 或 markdown 渲染器渲染，响应体中的 HTML/JS 内容会导致 XSS。当前代码库无 `dangerouslySetInnerHTML` 用法，风险为潜在（latent）。

## Findings

- `src/canvas/lib/proxy-ai-client.ts:24,76`：`res.text()` 直接插入错误字符串
- 全局 grep 确认当前无 `dangerouslySetInnerHTML` 用法
- Security Sentinel 发现此问题

## Proposed Solutions

### Option 1: 截断并转义响应体（推荐）

**Approach:**

```typescript
const body = await res.text()
const safeBody = body.slice(0, 200).replace(/[<>&"']/g, c => `&#${c.charCodeAt(0)};`)
yield { type: 'error', error: `HTTP ${res.status}: ${safeBody}` }
```

**Pros:** 防止 XSS，限制错误信息长度
**Cons:** 错误信息可能被截断
**Effort:** 5 分钟
**Risk:** Low

## Recommended Action

Option 1，防御性编程，为未来添加 markdown 渲染做准备。

## Technical Details

**Affected files:**
- `src/canvas/lib/proxy-ai-client.ts` — 两处 `res.text()` 调用

## Acceptance Criteria

- [ ] 错误字符串中的 HTML 特殊字符被转义
- [ ] 错误信息长度不超过 200 字符

## Work Log

### 2026-03-19 - Security Audit Discovery

**By:** Claude Code (Security Sentinel background agent)
