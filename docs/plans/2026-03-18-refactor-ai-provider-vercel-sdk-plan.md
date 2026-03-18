---
title: "refactor: 用 Vercel AI SDK 替换手写 AI provider 客户端层"
type: refactor
date: 2026-03-18
risk_score: 3
risk_level: low
risk_note: "本地个人工具，只改 client 层，不动 store/UI，完全可逆"
---

## Overview

**Goal**: 用 Vercel AI SDK（`ai` + `@ai-sdk/openai` + `@ai-sdk/anthropic`）替换手写的 `OpenAICompatibleClient` 和 `AnthropicAIClient`，同时修复 Kimi baseURL 硬编码和测试无超时两个 bug。

**Tech Stack**: Vercel AI SDK v5（50k+ Stars，MIT），现有 Zustand store + Proxy 透明转发架构不变。

**Architecture**: 只替换 client 层实现，`ai-client.ts` 的 Proxy 透明转发、`ai-config-store.ts` 的 store 逻辑、`ai-settings-modal.tsx` 的 UI 结构全部保留，改动最小化。

> 来源：`docs/brainstorms/2026-03-18-ai-provider-glue-brainstorm.md`

---

## 问题背景

1. **Kimi baseURL 硬编码**（`ai-config-store.ts:33`）— 写死 `https://api.moonshot.cn/v1`，用户官网 URL 不同时无法修改，只能绕道 custom provider
2. **测试无超时**（`ai-settings-modal.tsx:44-64`）— `handleTest` 无限等待，provider 无响应时 loading 永不结束
3. **重复造轮子** — `openai-compatible-client.ts` + `real-ai-client.ts` 手写了 HTTP 请求、流式解析、错误处理，Vercel AI SDK 已内置

---

## 关键决策（来自 brainstorm）

| 决策 | 选择 | 理由 |
|------|------|------|
| 底层 SDK | Vercel AI SDK | 50k Stars，行业标准，长期维护 |
| Anthropic 浏览器访问 | 传 header `anthropic-dangerous-direct-browser-access: true` | SDK 官方推荐方案，替代 `dangerouslyAllowBrowser` |
| Kimi baseURL | 所有预设 provider 改为可编辑 | 不同用户官网 URL 可能不同 |
| 测试超时 | 5 秒 AbortController | 超时后显示明确错误提示 |
| 迁移范围 | 只改 client 层 | 不动 store/UI，降低风险 |

---

## 任务列表

### Task 1: 安装 Vercel AI SDK 依赖

**文件**: `package.json`
**操作**:
- [x] 在项目根目录运行安装命令

**代码**:
```bash
npm install ai @ai-sdk/openai @ai-sdk/anthropic
```

**验证**:
- [x] 运行 `cat package.json | grep '"ai"'` 确认 `"ai"` 出现在 dependencies
- [x] 运行 `cat package.json | grep '@ai-sdk'` 确认两个包都已安装

---

### Task 2: 重写 openai-compatible-client.ts

**文件**: `src/canvas/lib/openai-compatible-client.ts`
**操作**:
- [x] 完整替换文件内容，用 `@ai-sdk/openai` + `streamText` + `generateText` 实现

**代码**:
```typescript
import { createOpenAI } from '@ai-sdk/openai'
import { streamText, generateText } from 'ai'
import type { AIClient, ChatRequest, ChatChunk, DirectionRequest, Direction } from '../types'
import { buildDirectionPrompt, parseDirectionsJSON } from './prompt-builder'

export class OpenAICompatibleClient implements AIClient {
  private model: ReturnType<ReturnType<typeof createOpenAI>>

  constructor(apiKey: string, baseURL: string, modelId: string) {
    const provider = createOpenAI({ apiKey, baseURL, compatibility: 'compatible' })
    this.model = provider(modelId)
  }

  async *streamChat(input: ChatRequest): AsyncGenerator<ChatChunk> {
    const messages = input.messages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.text,
    }))

    try {
      const result = streamText({ model: this.model, messages })
      for await (const delta of result.textStream) {
        yield { type: 'delta', text: delta }
      }
      yield { type: 'done' }
    } catch (err) {
      yield { type: 'error', error: err instanceof Error ? err.message : '未知错误' }
    }
  }

  async generateDirections(input: DirectionRequest): Promise<Direction[]> {
    const result = await generateText({
      model: this.model,
      messages: [{ role: 'user', content: buildDirectionPrompt(input) }],
    })
    return parseDirectionsJSON(result.text)
  }
}
```

**验证**:
- [x] 运行 `npm run build` 确认 TypeScript 编译无报错

---

### Task 3: 重写 real-ai-client.ts

**文件**: `src/canvas/lib/real-ai-client.ts`
**操作**:
- [x] 完整替换文件内容，用 `@ai-sdk/anthropic` 实现，通过 header 解决浏览器访问限制

**代码**:
```typescript
import { createAnthropic } from '@ai-sdk/anthropic'
import { streamText, generateText } from 'ai'
import type { AIClient, ChatRequest, ChatChunk, DirectionRequest, Direction } from '../types'
import { buildDirectionPrompt, parseDirectionsJSON } from './prompt-builder'

// 浏览器直连 Anthropic 需要此 header（官方推荐方案，替代 dangerouslyAllowBrowser）
const BROWSER_HEADER = { 'anthropic-dangerous-direct-browser-access': 'true' }

export class AnthropicAIClient implements AIClient {
  private model: ReturnType<ReturnType<typeof createAnthropic>>

  constructor(apiKey: string, modelId: string, baseURL?: string) {
    const provider = createAnthropic({
      apiKey,
      ...(baseURL ? { baseURL } : {}),
      headers: BROWSER_HEADER,
    })
    this.model = provider(modelId)
  }

  async *streamChat(input: ChatRequest): AsyncGenerator<ChatChunk> {
    const systemMsg = input.messages.find(m => m.role === 'system')
    const messages = input.messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.text }))

    try {
      const result = streamText({
        model: this.model,
        system: systemMsg?.text,
        messages,
      })
      for await (const delta of result.textStream) {
        yield { type: 'delta', text: delta }
      }
      yield { type: 'done' }
    } catch (err) {
      yield { type: 'error', error: err instanceof Error ? err.message : '未知错误' }
    }
  }

  async generateDirections(input: DirectionRequest): Promise<Direction[]> {
    const result = await generateText({
      model: this.model,
      messages: [{ role: 'user', content: buildDirectionPrompt(input) }],
    })
    return parseDirectionsJSON(result.text)
  }
}
```

**验证**:
- [x] 运行 `npm run build` 确认编译无报错

---

### Task 4: 让所有预设 provider 的 baseURL 可编辑

**文件**: `src/canvas/lib/ai-config-store.ts`
**操作**:
- [x] 修改 `ProviderConfig` 接口，`baseURL` 改为所有 provider 都可选存储（不只 custom）
- [x] 修改 `toAIConfig`，优先使用用户保存的 `baseURL`，fallback 到 preset

当前 `ProviderConfig`（第 11-15 行）：
```typescript
export interface ProviderConfig {
  apiKey: string
  model: string
  baseURL?: string  // 仅 custom provider 使用
}
```

改为（注释更新，逻辑不变，但语义扩展到所有 provider）：
```typescript
export interface ProviderConfig {
  apiKey: string
  model: string
  baseURL?: string  // 用户自定义 baseURL，覆盖 preset 默认值（所有 provider 均支持）
}
```

`toAIConfig` 函数（第 81-88 行）已经是 `cfg.baseURL ?? PROVIDER_PRESETS[provider].baseURL`，逻辑正确，**无需修改**。

**验证**:
- [x] 确认 `toAIConfig` 函数逻辑：`cfg.baseURL ?? PROVIDER_PRESETS[provider].baseURL`（已正确）

---

### Task 5: UI 允许所有 provider 编辑 baseURL

**文件**: `src/components/ai-settings-modal.tsx`
**操作**:
- [x] 删除 `isCustom` 对 baseURL 输入框的 `readOnly` 限制，所有 provider 均可编辑
- [x] 更新 `handleSave` 中的 `cfg` 构建，始终保存 `baseURL`
- [x] 删除「预设 Provider 的地址已锁定」提示文字

修改 `handleProviderChange`（第 28-42 行），让非 custom provider 也加载已保存的 baseURL：
```typescript
function handleProviderChange(p: ProviderPreset) {
  setProvider(p)
  const existing = configs[p]
  setApiKey(existing?.apiKey ?? '')
  // 优先用已保存的 baseURL，否则用 preset 默认值
  setBaseURL(existing?.baseURL ?? PROVIDER_PRESETS[p].baseURL)
  setModel(existing?.model ?? PROVIDER_PRESETS[p].model)
  setTestStatus('idle')
  setTestMsg('')
}
```

修改 baseURL 输入框（第 101-115 行）：
```tsx
<div>
  <label className="mb-1.5 block text-sm font-medium text-slate-700">Base URL</label>
  <input
    type="text"
    value={baseURL}
    onChange={(e) => setBaseURL(e.target.value)}
    placeholder="https://api.example.com/v1"
    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
  />
  <p className="mt-1 text-xs text-slate-400">
    默认值来自预设，可修改为官网实际地址
  </p>
</div>
```

修改 `handleSave`（第 66-74 行），始终保存 baseURL：
```typescript
function handleSave() {
  const cfg: ProviderConfig = {
    apiKey,
    model,
    baseURL,  // 始终保存，toAIConfig 会优先使用此值
  }
  updateProviderConfig(provider, cfg)
  setSettingsOpen(false)
}
```

修改 `handleTest`（第 44-64 行），始终使用当前 `baseURL` state（不再区分 isCustom）：
```typescript
async function handleTest() {
  if (!apiKey) return
  setTestStatus('loading')
  setTestMsg('')
  const gen = buildClient({ provider, baseURL, apiKey, model }).streamChat({
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
    await gen.return(undefined)
  }
}
```

**验证**:
- [x] 打开 AI 设置，切换到 Kimi，确认 baseURL 输入框可编辑
- [x] 修改 Kimi baseURL 后保存，重新打开设置确认已保留

---

### Task 6: 测试函数加 5 秒超时

**文件**: `src/components/ai-settings-modal.tsx`
**操作**:
- [x] 在 `handleTest` 中加入 `AbortController` + 5 秒超时，超时后显示明确提示

将 Task 5 中的 `handleTest` 进一步更新为：
```typescript
async function handleTest() {
  if (!apiKey) return
  setTestStatus('loading')
  setTestMsg('')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  const gen = buildClient({ provider, baseURL, apiKey, model }).streamChat({
    messages: [{ id: 'test', role: 'user', text: 'Hi', createdAt: Date.now() }],
    sourceRefs: [],
  })
  try {
    // 竞速：第一个 chunk 或超时
    const first = await Promise.race([
      gen.next(),
      new Promise<never>((_, reject) =>
        controller.signal.addEventListener('abort', () => reject(new Error('连接超时，请检查网络或 URL')))
      ),
    ])
    if ((first as Awaited<ReturnType<typeof gen.next>>).value?.type === 'error') {
      throw new Error((first as Awaited<ReturnType<typeof gen.next>>).value?.error)
    }
    setTestStatus('ok')
    setTestMsg('连接成功 ✓')
  } catch (e) {
    setTestStatus('error')
    setTestMsg(e instanceof Error ? e.message : '连接失败')
  } finally {
    clearTimeout(timeout)
    await gen.return(undefined)
  }
}
```

**验证**:
- [x] 配置一个错误的 baseURL，点击「测试连接」，5 秒内应显示「连接超时，请检查网络或 URL」
- [x] 配置正确的 key，测试应在 5 秒内显示「连接成功 ✓」

---

### Task 7: 删除旧的 openai 和 @anthropic-ai/sdk 依赖（可选）

**文件**: `package.json`
**操作**:
- [x] 确认 `openai` 和 `@anthropic-ai/sdk` 在项目其他地方是否还有引用
- [x] 如无其他引用，卸载旧依赖

**代码**:
```bash
# 先确认是否还有其他引用
grep -r "from 'openai'" src/ --include="*.ts" --include="*.tsx"
grep -r "from '@anthropic-ai/sdk'" src/ --include="*.ts" --include="*.tsx"

# 如果只有 client 文件引用（已被替换），则卸载
npm uninstall openai @anthropic-ai/sdk
```

**验证**:
- [x] 运行 `npm run build` 确认编译无报错
- [x] 运行 `npm run dev` 确认应用正常启动

---

## 不动的文件

- `src/canvas/lib/ai-client.ts` — Proxy 透明转发，无需改动
- `src/canvas/lib/mock-ai.ts` — Mock 客户端，无需改动
- `src/canvas/lib/prompt-builder.ts` — Prompt 构建，无需改动
- `src/canvas/types.ts` — AIClient 接口定义，无需改动
- `src/canvas/lib/ai-config-store.ts` — store 逻辑基本不变（仅注释更新）

---

## 风险评估

风险评估：3/10 — 低风险 🟢
- 安全/隐私: 0（无敏感数据变更）
- 可逆性: 1（代码重构，git revert 可还原）
- 影响范围: 0（本地个人工具）
- 变更规模: 1（5 个源文件）
- 外部依赖: 1（新增 Vercel AI SDK，MIT 许可证，50k Stars）

主要风险：Vercel AI SDK 的 `streamText` 在浏览器直连 Anthropic 时需要传 header，已有官方解决方案。

---

## 验收标准

- [x] Kimi 可以填写自定义 baseURL 并保存
- [x] 测试连接在 5 秒内超时并显示明确提示
- [x] DeepSeek / Kimi / Qwen / Anthropic 流式对话正常工作
- [x] `npm run build` 无 TypeScript 报错
- [x] 旧的 `openai` 和 `@anthropic-ai/sdk` 包可以安全卸载
