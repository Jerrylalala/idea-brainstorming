---
name: AISettingsModal 直接 new 实现类，与 buildClient 逻辑重复
description: handleTest 中重复了 buildClient 的 provider→client 分发逻辑，新增 provider 时需修改两处
type: architecture
status: pending
priority: p2
issue_id: "020"
tags: [code-review, architecture, dry, ai-settings]
---

## Problem Statement

`AISettingsModal.handleTest()` 和 `ai-config-store.ts` 的 `buildClient()` 都含有"根据 provider 实例化对应 client 类"的逻辑。目前两处代码：

```typescript
// ai-settings-modal.tsx handleTest（UI 层）
const client = provider === 'anthropic'
  ? new AnthropicAIClient(apiKey, baseURL || undefined)
  : new OpenAICompatibleClient(apiKey, baseURL, model)

// ai-config-store.ts buildClient（store 层）
if (!config || !config.apiKey) return new MockAIClient()
if (config.provider === 'anthropic') {
  return new AnthropicAIClient(config.apiKey, config.baseURL || undefined)
}
return new OpenAICompatibleClient(config.apiKey, config.baseURL, config.model)
```

**Why:** 新增一个 Provider（如 Gemini、本地 Ollama）需要同时修改 `ai-config-store.ts` 和 `ai-settings-modal.tsx` 两处，违反 Open/Closed 原则。UI 组件也不应知道具体实现类的构造函数签名。

## Proposed Solutions

### 方案 A（推荐）：导出 buildClient，handleTest 直接复用

```typescript
// ai-config-store.ts - 导出 buildClient
export function buildClient(config: AIConfig | null): AIClient { ... }

// ai-settings-modal.tsx - handleTest 改为
async function handleTest() {
  if (!apiKey || !baseURL) return
  setTestStatus('loading')
  const client = buildClient({ provider, baseURL, apiKey, model })
  // ... 其余逻辑不变
}
```

移除 `ai-settings-modal.tsx` 中对 `AnthropicAIClient` 和 `OpenAICompatibleClient` 的 import。

## Acceptance Criteria

- [ ] `buildClient` 从 `ai-config-store.ts` 导出
- [ ] `AISettingsModal` 不再 import `AnthropicAIClient` 或 `OpenAICompatibleClient`
- [ ] 新增 provider 时只需修改 `buildClient` 和 `PROVIDER_PRESETS` 两处

## Work Log

- 2026-03-18: 代码审查发现，由 architecture-strategist agent 标记为 P1-B（架构）
