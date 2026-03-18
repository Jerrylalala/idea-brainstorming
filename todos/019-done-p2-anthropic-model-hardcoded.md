---
name: AnthropicAIClient MODEL 硬编码，用户设置的 model 字段被忽略
description: AnthropicAIClient 使用常量 MODEL='claude-sonnet-4-6'，而不是 store 中用户配置的 model 字段
type: bug
status: pending
priority: p2
issue_id: "019"
tags: [code-review, ai, configuration, anthropic]
---

## Problem Statement

`AnthropicAIClient` 构造函数没有 `model` 参数，内部使用硬编码常量 `const MODEL = 'claude-sonnet-4-6'`。但 `OpenAICompatibleClient` 接受 `model` 作为构造函数参数，两者 API 不对称。

用户在 `AISettingsModal` 修改了 Anthropic 的 model 字段（如改为 `claude-opus-4-6`），`store.setConfig()` 会保存这个值，但 `buildClient()` 创建 `AnthropicAIClient` 时没有传入 model，实际调用始终使用 `claude-sonnet-4-6`，导致用户设置静默无效。

**Why:** 用户体验：用户修改配置看起来成功，但运行时行为不变，这是误导性的。

## Findings

**位置：** `src/canvas/lib/real-ai-client.ts` 第 4 行，`src/canvas/lib/ai-config-store.ts` `buildClient` 函数

```typescript
// real-ai-client.ts
const MODEL = 'claude-sonnet-4-6'  // 硬编码，从不使用构造函数参数

// ai-config-store.ts
if (config.provider === 'anthropic') {
  return new AnthropicAIClient(config.apiKey, config.baseURL || undefined)
  // 注意：config.model 完全没有传入！
}
```

两个接口对比：
```typescript
// OpenAICompatibleClient：正确
constructor(apiKey: string, baseURL: string, model: string)

// AnthropicAIClient：不一致
constructor(apiKey: string, baseURL?: string)  // 缺少 model 参数
```

## Proposed Solutions

### 方案 A（推荐）：给 AnthropicAIClient 加 model 参数

```typescript
// real-ai-client.ts
export class AnthropicAIClient implements AIClient {
  private client: Anthropic
  private model: string  // 改为实例变量

  constructor(apiKey: string, model: string, baseURL?: string) {
    this.model = model
    this.client = new Anthropic({
      apiKey,
      ...(baseURL ? { baseURL } : {}),
      dangerouslyAllowBrowser: true,
    })
  }

  async *streamChat(input: ChatRequest) {
    const stream = this.client.messages.stream({
      model: this.model,  // 使用实例变量
      max_tokens: 2048,
      ...
    })
  }
}

// ai-config-store.ts - buildClient
if (config.provider === 'anthropic') {
  return new AnthropicAIClient(config.apiKey, config.model, config.baseURL || undefined)
}
```

同时在 `AISettingsModal` 的 handleTest 中也传入 model：
```typescript
new AnthropicAIClient(apiKey, model, baseURL || undefined)
```

## Acceptance Criteria

- [ ] `AnthropicAIClient` 构造函数接受 `model` 参数
- [ ] `buildClient()` 传入 `config.model`
- [ ] `handleTest()` 中也传入 model
- [ ] 用户在 Settings 中修改 Anthropic model 后，实际 API 调用使用新 model（可通过网络面板验证 request body）

## Work Log

- 2026-03-18: 代码审查发现，由 architecture-strategist agent 标记为 P2-B
