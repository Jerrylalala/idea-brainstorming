---
status: pending
priority: p2
issue_id: "035"
tags: [code-review, security, api]
dependencies: []
---

# /api/sniff 缺少对 apiKey 和 model 的输入校验

## Problem Statement

`/api/sniff` 端点只校验了 `baseURL`（通过 `isAllowedBaseURL`），但没有校验 `apiKey` 和 `model` 是否为非空字符串。如果 `apiKey` 为空字符串，会向第三方 API 发送无认证请求，可能触发 401 错误但错误信息不明确；如果 `model` 为空，部分 provider 会返回 400 或使用默认模型，导致 sniff 结果不可靠。同样的问题也存在于 `/api/chat` 和 `/api/directions`。

## Findings

- `server/app.ts:118-123`：`/api/sniff` 只校验 `baseURL`，不校验 `apiKey`/`model`
- `server/app.ts:39-47`：`/api/chat` 同样只校验 `baseURL`
- `server/app.ts:99-104`：`/api/directions` 同样只校验 `baseURL`
- 空 `apiKey` 会导致向第三方 API 发送无认证请求
- Kieran Rails Reviewer 发现此问题（适用于 TypeScript 后端）

## Proposed Solutions

### Option 1: 提取公共校验函数，在所有端点复用（推荐）

**Approach:**

```typescript
function validateAIProxyBody(body: Partial<AIProxyBody>): string | null {
  if (!body.apiKey?.trim()) return 'apiKey 不能为空'
  if (!body.model?.trim()) return 'model 不能为空'
  if (!body.baseURL?.trim()) return 'baseURL 不能为空'
  if (!isAllowedBaseURL(body.baseURL)) return 'Base URL 不允许（仅支持 HTTPS 公网地址）'
  return null
}

// 在每个端点中：
const validationError = validateAIProxyBody(body)
if (validationError) return c.json({ error: validationError }, 400)
```

**Pros:** DRY，所有端点统一校验逻辑
**Cons:** 需要修改三个端点
**Effort:** 20 分钟
**Risk:** Low

---

### Option 2: 仅在 /api/sniff 添加校验

**Approach:** 只修复 sniff 端点，其他端点保持现状。

**Pros:** 改动最小
**Cons:** 其他端点仍有同样问题
**Effort:** 10 分钟
**Risk:** Low

## Recommended Action

Option 1，统一校验所有端点。

## Technical Details

**Affected files:**
- `server/app.ts` — 三个端点均需添加校验

## Acceptance Criteria

- [ ] 空 `apiKey` 返回 400 错误
- [ ] 空 `model` 返回 400 错误
- [ ] 三个端点均有统一校验

## Work Log

### 2026-03-19 - Code Review Discovery

**By:** Claude Code (review agents: Kieran TypeScript Reviewer, Security Sentinel)
