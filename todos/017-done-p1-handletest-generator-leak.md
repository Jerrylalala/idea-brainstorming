---
name: handleTest 未关闭的 AsyncGenerator 导致连接泄漏
description: 测试连接时每次点击都泄漏一个 SSE 流连接，未调用 gen.return() 关闭
type: bug
status: pending
priority: p1
issue_id: "017"
tags: [code-review, ai, async, resource-leak]
---

## Problem Statement

`AISettingsModal.handleTest()` 创建一个 `streamChat` 生成器，只读第一个 chunk 后直接退出，未调用 `gen.return()` 关闭底层 HTTP 流。每次点击"测试连接"都向 AI provider 发起一个 SSE 连接，且该连接在服务端直到超时前持续占用资源。

**Why:** 用户可能连续多次测试，造成多个挂起的 streaming 连接，消耗服务端 token 预算。

## Findings

**位置：** `src/components/ai-settings-modal.tsx` 第 40-51 行

```typescript
// 当前代码 - 生成器未关闭
const gen = client.streamChat({
  messages: [{ id: 'test', role: 'user', text: 'Hi', createdAt: Date.now() }],
  sourceRefs: [],
})
const first = await gen.next()
if (first.value?.type === 'error') throw new Error(first.value.error)
setTestStatus('ok')
setTestMsg('连接成功 ✓')
// gen 从未调用 gen.return() → SSE 连接泄漏
```

Anthropic SDK 的 `messages.stream()` 和 OpenAI SDK 的 `chat.completions.create({ stream: true })` 都持有底层 HTTP/2 或 SSE 连接，必须显式关闭。

## Proposed Solutions

### 方案 A（推荐）：在 finally 块中调用 gen.return()

```typescript
async function handleTest() {
  if (!apiKey || !baseURL) return
  setTestStatus('loading')
  setTestMsg('')
  const client = provider === 'anthropic'
    ? new AnthropicAIClient(apiKey, baseURL || undefined)
    : new OpenAICompatibleClient(apiKey, baseURL, model)
  const gen = client.streamChat({
    messages: [{ id: 'test', role: 'user', text: 'Hi', createdAt: Date.now() }],
    sourceRefs: [],
  })
  try {
    const first = await gen.next()
    if (first.value?.type === 'error') throw new Error(first.value.error)
    setTestStatus('ok')
    setTestMsg('连接成功 ✓')
  } catch (e) {
    setTestStatus('error')
    setTestMsg(e instanceof Error ? e.message : '连接失败')
  } finally {
    await gen.return(undefined)  // 始终关闭流
  }
}
```

**优点：** 一行修复，无副作用。
**风险：** 无。

## Acceptance Criteria

- [ ] 点击"测试连接"后，网络面板显示连接在第一个 chunk 收到后关闭
- [ ] 连续点击多次不会积累挂起连接

## Work Log

- 2026-03-18: 代码审查发现，由 performance-oracle agent 标记为 P1
