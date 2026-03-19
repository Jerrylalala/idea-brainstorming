---
status: pending
priority: p1
issue_id: "026"
tags: [code-review, performance, api]
dependencies: []
---

# /api/sniff 的 AbortController 被两个请求共享，loser 请求未被及时取消

## Problem Statement

`/api/sniff` 使用 `Promise.any()` 并行探测两种格式，但两个请求共享同一个 `AbortController`。`Promise.any` resolve 后才调用 `abortController.abort()`，此时 loser 请求已在进行中，实际上消耗了用户的 token 配额，且泄漏了一个 HTTP 连接。

## Findings

- `server/app.ts:126-145`：单个 `abortController` 被两个 `tryFormat` 调用共享
- `abortController.abort()` 在 `Promise.any` resolve 后才执行（第 145 行），此时 winner 已完成
- 对于 OpenAI 兼容端点，openai 格式通常先成功，anthropic 请求仍在消耗 token
- 每次 sniff 实际发出 2 个 LLM API 请求，用户付费两次
- 在并发场景下（多标签页、快速重试），泄漏的连接会耗尽 HTTP 连接池
- Performance Oracle 和 Architecture Strategist 均独立发现此问题

## Proposed Solutions

### Option 1: 两个独立 AbortController（推荐）

**Approach:** 每个 `tryFormat` 使用独立的 controller，winner 确定后立即 abort loser。

```typescript
const controllers = {
  openai: new AbortController(),
  anthropic: new AbortController(),
}
const timeout = setTimeout(() => {
  controllers.openai.abort()
  controllers.anthropic.abort()
}, 10000)

async function tryFormat(format: 'openai' | 'anthropic'): Promise<'openai' | 'anthropic'> {
  const model = buildModel(format, body.apiKey, body.baseURL, body.model)
  const result = await generateText({
    model,
    messages: probeMessages,
    maxOutputTokens: 10,
    abortSignal: controllers[format].signal,
    maxRetries: 0,
  })
  if (!result.text) throw new Error('empty response')
  return format
}

const format = await Promise.any([tryFormat('openai'), tryFormat('anthropic')])
clearTimeout(timeout)
const loser = format === 'openai' ? 'anthropic' : 'openai'
controllers[loser].abort()  // 立即取消 loser
return c.json({ format })
```

**Pros:** 精确取消 loser，不影响 winner；token 消耗最小化
**Cons:** 代码稍复杂
**Effort:** 30 分钟
**Risk:** Low

---

### Option 2: 已知 baseURL 快速路径

**Approach:** 对 `api.anthropic.com` 等已知 URL 直接返回格式，跳过双向探测。

**Pros:** 完全避免双重 token 消耗
**Cons:** 需要维护已知 URL 列表，不够通用
**Effort:** 1 小时
**Risk:** Low

## Recommended Action

Option 1 是必须修复的 bug。Option 2 可作为后续优化。

## Technical Details

**Affected files:**
- `server/app.ts:117-157` — /api/sniff 端点

## Acceptance Criteria

- [ ] sniff 成功后，loser 请求被立即 abort
- [ ] 超时时两个请求都被 abort
- [ ] 测试：用 network tab 确认只有一个请求完整返回

## Work Log

### 2026-03-19 - Code Review Discovery

**By:** Claude Code (review agents: Performance Oracle, Architecture Strategist, DHH)
