---
status: pending
priority: p2
issue_id: "044"
tags: [code-review, security, validation]
dependencies: [035]
---

# format 字段无运行时枚举校验，messages 无大小限制

## Problem Statement

`/api/chat` 和 `/api/directions` 接受 `format: 'openai' | 'anthropic'`，但 TypeScript 类型在运行时被擦除。任意字符串都能通过，`buildModel()` 对未知 format 静默回退到 OpenAI 路径。此外，`messages` 数组无数量和内容长度限制，单次请求可发送任意大的上下文，放大 API Key 持有者的 token 消耗。

## Findings

- `server/app.ts:49`：`buildModel(body.format, ...)` — format 未校验
- `server/app.ts:41`：`body.messages` — 无数量/长度限制
- `server/provider.ts`：未知 format 静默走 OpenAI 路径
- Security Sentinel 发现此问题（与 035 互补，035 修复了 apiKey/model/baseURL，此 issue 修复 format 和 messages）

## Proposed Solutions

### Option 1: 在 validateAIProxyBody 中添加 format 和 messages 校验（推荐）

**Approach:** 扩展 035 中创建的 `validateAIProxyBody` 函数：

```typescript
function validateAIProxyBody(body: Partial<AIProxyBody & { messages?: unknown[] }>): string | null {
  if (!body.apiKey?.trim()) return 'apiKey 不能为空'
  if (!body.model?.trim()) return 'model 不能为空'
  if (!body.baseURL?.trim()) return 'baseURL 不能为空'
  if (!isAllowedBaseURL(body.baseURL)) return 'Base URL 不允许（仅支持 HTTPS 公网地址）'
  if (body.format !== undefined && body.format !== 'openai' && body.format !== 'anthropic') {
    return '无效的 format 参数'
  }
  if (body.messages !== undefined) {
    if (!Array.isArray(body.messages) || body.messages.length > 100) {
      return '消息数量超出限制（最多 100 条）'
    }
  }
  return null
}
```

**Pros:** 防止 format 注入，限制 token 消耗放大
**Cons:** 需要修改已有函数
**Effort:** 15 分钟
**Risk:** Low

## Recommended Action

Option 1，扩展 035 的校验函数。

## Technical Details

**Affected files:**
- `server/app.ts` — `validateAIProxyBody` 函数

## Acceptance Criteria

- [ ] 非法 format 值返回 400
- [ ] messages 超过 100 条返回 400
- [ ] 合法请求不受影响

## Work Log

### 2026-03-19 - Security Audit Discovery

**By:** Claude Code (Security Sentinel background agent)
