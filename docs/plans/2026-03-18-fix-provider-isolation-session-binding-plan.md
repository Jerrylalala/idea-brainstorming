---
title: "fix: AI 供应商隔离 + Session 画布绑定 + 头脑风暴 Prompt"
type: fix
date: 2026-03-18
risk_score: 2
risk_level: low
risk_note: "本地工具，无外部依赖，改动限于 6 个源文件，代码可 git revert"
---

# fix: AI 供应商隔离 + Session 画布绑定 + 头脑风暴 Prompt

## Overview

**Goal**: 修复 3 个 P0 Bug + 1 个 P1 功能（Brainstorm Prompt 优化）
**Tech Stack**: Zustand / React / TypeScript / localStorage
**Architecture**: 4 个独立模块改动，互不依赖，按顺序执行

> 来源：`docs/brainstorms/2026-03-18-ai-integration-and-feature-gaps-brainstorm.md`（第六节）

---

## 问题总览

| # | 优先级 | 问题 | 根因 |
|---|--------|------|------|
| 1 | P0 Bug | 切换供应商时 API Key 被覆盖 | `ai_config` 单对象写入，覆盖所有供应商数据 |
| 2 | P0 Feature | 模型只能手动输入，无选择 | model 字段是 text input，无预设列表 |
| 3 | P0 Bug | Session 切换不切换画布 | `canvasStore` 全局单例，无 session 感知 |
| 4 | P1 Feature | AI 直接回答而非头脑风暴引导 | `buildSystemPrompt` 无引导者角色定义 |

---

## 实施计划

### Task 1: 重写 `ai-config-store.ts` — 按供应商隔离存储

**文件**: `src/canvas/lib/ai-config-store.ts`
**操作**:
- [ ] 新增 `ProviderConfig` 类型（per-provider，无 provider 字段）
- [ ] 新增 `ModelOption` 类型 + `PROVIDER_MODELS` 常量（官方文档模型列表）
- [ ] 改存储结构：`ai_config` 单对象 → `ai_configs`（map）+ `ai_active_provider`
- [ ] 新增迁移逻辑：读到旧 `ai_config` 时自动转换并清理
- [ ] 重构 store 方法：`updateProviderConfig` + `setActiveProvider` + `clearProviderConfig`
- [ ] 保留 `buildClient` + `client` 字段（`ai-client.ts` 的 Proxy 无需改动）

**代码**:

```typescript
// src/canvas/lib/ai-config-store.ts
import { create } from 'zustand'
import { MockAIClient } from './mock-ai'
import { AnthropicAIClient } from './real-ai-client'
import { OpenAICompatibleClient } from './openai-compatible-client'
import type { AIClient } from '../types'

export type ProviderPreset = 'deepseek' | 'deepseek-anthropic' | 'kimi' | 'qwen' | 'anthropic' | 'custom'

// Per-provider 配置（key 就是 provider，无需重复存）
export interface ProviderConfig {
  apiKey: string
  model: string
  baseURL?: string  // 仅 custom provider 使用
}

// Legacy type，buildClient 函数使用
export interface AIConfig {
  provider: ProviderPreset
  baseURL: string
  apiKey: string
  model: string
}

export interface ModelOption {
  id: string
  label: string
}

export const PROVIDER_PRESETS: Record<ProviderPreset, { label: string; baseURL: string; model: string }> = {
  deepseek: { label: 'DeepSeek (OpenAI 兼容)', baseURL: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  'deepseek-anthropic': { label: 'DeepSeek (Anthropic 格式)', baseURL: 'https://api.deepseek.com/anthropic', model: 'DeepSeek-V3.2' },
  kimi: { label: 'Kimi（月之暗面）', baseURL: 'https://api.moonshot.cn/v1', model: 'kimi-latest' },
  qwen: { label: '阿里云百炼', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  anthropic: { label: 'Anthropic / CCSwitch 中转', baseURL: 'https://api.anthropic.com', model: 'claude-sonnet-4-6' },
  custom: { label: '自定义中转', baseURL: '', model: '' },
}

// 各供应商官方文档确认的可用模型（不猜测）
export const PROVIDER_MODELS: Record<ProviderPreset, ModelOption[]> = {
  deepseek: [
    { id: 'deepseek-chat', label: 'DeepSeek V3（推荐）' },
    { id: 'deepseek-reasoner', label: 'DeepSeek R1（推理）' },
  ],
  'deepseek-anthropic': [
    { id: 'DeepSeek-V3.2', label: 'DeepSeek V3.2（推荐）' },
  ],
  kimi: [
    { id: 'kimi-latest', label: 'Kimi 最新版（推荐）' },
    { id: 'moonshot-v1-128k', label: 'Moonshot 128K' },
    { id: 'moonshot-v1-32k', label: 'Moonshot 32K' },
    { id: 'moonshot-v1-8k', label: 'Moonshot 8K' },
  ],
  qwen: [
    { id: 'qwen-max', label: 'Qwen Max（最强）' },
    { id: 'qwen-plus', label: 'Qwen Plus（推荐）' },
    { id: 'qwen-turbo', label: 'Qwen Turbo（快速）' },
  ],
  anthropic: [
    { id: 'claude-opus-4-6', label: 'Claude Opus 4.6（最强）' },
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6（推荐）' },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5（快速）' },
  ],
  custom: [],
}

const ANTHROPIC_FORMAT_PROVIDERS: ProviderPreset[] = ['anthropic', 'deepseek-anthropic']

const STORAGE_KEY_CONFIGS = 'ai_configs'
const STORAGE_KEY_ACTIVE = 'ai_active_provider'
const LEGACY_KEY = 'ai_config'  // 旧格式，用于迁移

export function buildClient(config: AIConfig | null): AIClient {
  if (!config || !config.apiKey) return new MockAIClient()
  if (ANTHROPIC_FORMAT_PROVIDERS.includes(config.provider)) {
    return new AnthropicAIClient(config.apiKey, config.model, config.baseURL || undefined)
  }
  return new OpenAICompatibleClient(config.apiKey, config.baseURL, config.model)
}

function toAIConfig(provider: ProviderPreset, cfg: ProviderConfig): AIConfig {
  return {
    provider,
    baseURL: cfg.baseURL ?? PROVIDER_PRESETS[provider].baseURL,
    apiKey: cfg.apiKey,
    model: cfg.model,
  }
}

type ConfigsMap = Partial<Record<ProviderPreset, ProviderConfig>>

function loadConfigs(): { configs: ConfigsMap; activeProvider: ProviderPreset } {
  try {
    // 迁移旧格式：检测到 ai_config 就迁移
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy) {
      const old = JSON.parse(legacy) as AIConfig
      const configs: ConfigsMap = {
        [old.provider]: { apiKey: old.apiKey, model: old.model, ...(old.provider === 'custom' ? { baseURL: old.baseURL } : {}) },
      }
      localStorage.setItem(STORAGE_KEY_CONFIGS, JSON.stringify(configs))
      localStorage.setItem(STORAGE_KEY_ACTIVE, old.provider)
      localStorage.removeItem(LEGACY_KEY)
      if (import.meta.env.DEV) console.info('[ai-config] 已自动迁移旧格式')
      return { configs, activeProvider: old.provider }
    }

    const rawConfigs = localStorage.getItem(STORAGE_KEY_CONFIGS)
    const rawActive = localStorage.getItem(STORAGE_KEY_ACTIVE)
    const configs = rawConfigs ? (JSON.parse(rawConfigs) as ConfigsMap) : {}
    const activeProvider = (rawActive as ProviderPreset | null) ?? 'deepseek'
    return { configs, activeProvider }
  } catch {
    return { configs: {}, activeProvider: 'deepseek' }
  }
}

function loadFromEnv(): { configs: ConfigsMap; activeProvider: ProviderPreset } | null {
  const aiKey = import.meta.env.VITE_AI_API_KEY as string | undefined
  const aiURL = import.meta.env.VITE_AI_BASE_URL as string | undefined
  const aiModel = (import.meta.env.VITE_AI_MODEL as string | undefined) ?? 'deepseek-chat'
  if (aiKey && aiURL) {
    return { configs: { custom: { apiKey: aiKey, model: aiModel, baseURL: aiURL } }, activeProvider: 'custom' }
  }
  const anthKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
  if (anthKey) {
    return { configs: { anthropic: { apiKey: anthKey, model: 'claude-sonnet-4-6' } }, activeProvider: 'anthropic' }
  }
  return null
}

interface AIConfigStore {
  configs: ConfigsMap
  activeProvider: ProviderPreset
  client: AIClient
  updateProviderConfig: (provider: ProviderPreset, config: ProviderConfig) => void
  setActiveProvider: (provider: ProviderPreset) => void
  clearProviderConfig: (provider: ProviderPreset) => void
}

const { configs: initConfigs, activeProvider: initActive } = loadConfigs()
const envFallback = Object.keys(initConfigs).length === 0 ? loadFromEnv() : null
const startConfigs = envFallback?.configs ?? initConfigs
const startActive = envFallback?.activeProvider ?? initActive

function buildActiveClient(configs: ConfigsMap, provider: ProviderPreset): AIClient {
  const cfg = configs[provider]
  if (!cfg) return new MockAIClient()
  return buildClient(toAIConfig(provider, cfg))
}

export const useAIConfigStore = create<AIConfigStore>((set, get) => ({
  configs: startConfigs,
  activeProvider: startActive,
  client: buildActiveClient(startConfigs, startActive),

  updateProviderConfig: (provider, config) => {
    const newConfigs = { ...get().configs, [provider]: config }
    localStorage.setItem(STORAGE_KEY_CONFIGS, JSON.stringify(newConfigs))
    localStorage.setItem(STORAGE_KEY_ACTIVE, provider)
    set({
      configs: newConfigs,
      activeProvider: provider,
      client: buildClient(toAIConfig(provider, config)),
    })
  },

  setActiveProvider: (provider) => {
    localStorage.setItem(STORAGE_KEY_ACTIVE, provider)
    const cfg = get().configs[provider]
    set({
      activeProvider: provider,
      client: cfg ? buildClient(toAIConfig(provider, cfg)) : new MockAIClient(),
    })
  },

  clearProviderConfig: (provider) => {
    const newConfigs = { ...get().configs }
    delete newConfigs[provider]
    localStorage.setItem(STORAGE_KEY_CONFIGS, JSON.stringify(newConfigs))
    set({ configs: newConfigs, client: new MockAIClient() })
  },
}))
```

**验证**:
- [ ] 运行 `npm run build` 确认 TypeScript 无报错
- [ ] 打开浏览器 DevTools → Application → localStorage，确认 `ai_config` key 不存在，`ai_configs` + `ai_active_provider` 存在

---

### Task 2: 更新 `ai-settings-modal.tsx` — 新 Store API + 模型下拉

**文件**: `src/components/ai-settings-modal.tsx`
**操作**:
- [ ] 更新 import：用 `ProviderConfig`、`PROVIDER_MODELS` 替换 `AIConfig`、旧方法
- [ ] 初始化 `provider` state 从 `activeProvider`，`apiKey` 从 `configs[activeProvider]`
- [ ] `handleProviderChange` 切换时加载该供应商已存的 apiKey（不清空）
- [ ] 将 model 字段改为下拉 `<select>`（非 custom 时）/ `<input>`（custom 时）
- [ ] `handleSave` 调用 `updateProviderConfig`（不再需要 `setActiveProvider`，`updateProviderConfig` 内部已设置）
- [ ] 清除按钮改为 `clearProviderConfig(provider)` 只清当前供应商

**代码**:

```tsx
// src/components/ai-settings-modal.tsx — 完整替换
import { useState } from 'react'
import { X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@/store/ui-store'
import {
  useAIConfigStore, PROVIDER_PRESETS, PROVIDER_MODELS,
  buildClient, type ProviderConfig, type ProviderPreset,
} from '@/canvas/lib/ai-config-store'

export function AISettingsModal() {
  const settingsOpen = useUIStore((s) => s.settingsOpen)
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)
  const { configs, activeProvider, updateProviderConfig, clearProviderConfig } = useAIConfigStore()

  const initCfg = configs[activeProvider]
  const [provider, setProvider] = useState<ProviderPreset>(activeProvider)
  const [apiKey, setApiKey] = useState(initCfg?.apiKey ?? '')
  const [baseURL, setBaseURL] = useState(initCfg?.baseURL ?? PROVIDER_PRESETS[activeProvider].baseURL)
  const [model, setModel] = useState(initCfg?.model ?? PROVIDER_PRESETS[activeProvider].model)
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [testMsg, setTestMsg] = useState('')

  if (!settingsOpen) return null

  const isCustom = provider === 'custom'

  function handleProviderChange(p: ProviderPreset) {
    setProvider(p)
    const existing = configs[p]
    // 加载该供应商已保存的 apiKey（切换供应商不清空已有配置）
    setApiKey(existing?.apiKey ?? '')
    if (p !== 'custom') {
      setBaseURL(PROVIDER_PRESETS[p].baseURL)
      setModel(existing?.model ?? PROVIDER_PRESETS[p].model)
    } else {
      setBaseURL(existing?.baseURL ?? '')
      setModel(existing?.model ?? '')
    }
    setTestStatus('idle')
    setTestMsg('')
  }

  async function handleTest() {
    if (!apiKey) return
    setTestStatus('loading')
    setTestMsg('')
    const effectiveURL = isCustom ? baseURL : PROVIDER_PRESETS[provider].baseURL
    const gen = buildClient({ provider, baseURL: effectiveURL, apiKey, model }).streamChat({
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

  function handleSave() {
    const cfg: ProviderConfig = {
      apiKey,
      model,
      ...(isCustom ? { baseURL } : {}),
    }
    updateProviderConfig(provider, cfg)
    setSettingsOpen(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[480px] rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">AI 配置</h2>
          <button onClick={() => setSettingsOpen(false)} className="rounded-lg p-1 hover:bg-slate-100">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Provider 选择 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Provider</label>
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as ProviderPreset)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              {(Object.keys(PROVIDER_PRESETS) as ProviderPreset[]).map((p) => (
                <option key={p} value={p}>{PROVIDER_PRESETS[p].label}</option>
              ))}
            </select>
          </div>

          {/* Base URL — 仅 custom 可编辑 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Base URL</label>
            <input
              type="text"
              value={isCustom ? baseURL : PROVIDER_PRESETS[provider].baseURL}
              onChange={(e) => isCustom && setBaseURL(e.target.value)}
              readOnly={!isCustom}
              placeholder="https://api.example.com/v1"
              className={`h-9 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 ${isCustom ? 'bg-white' : 'bg-slate-50 text-slate-500 cursor-default'}`}
            />
            {!isCustom && (
              <p className="mt-1 text-xs text-slate-400">预设 Provider 的地址已锁定，如需自定义请选择「自定义中转」</p>
            )}
          </div>

          {/* API Key */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-xxxxxxxxxxxxxxxx"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
            <p className="mt-1 text-xs text-slate-400">
              {configs[provider] ? '✓ 已保存此供应商的 Key' : '尚未保存此供应商的 Key'}
            </p>
          </div>

          {/* Model — 预设供应商用下拉，custom 用文本框 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Model</label>
            {isCustom ? (
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="model-name"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            ) : (
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                {PROVIDER_MODELS[provider].map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            )}
          </div>

          {/* 测试连接 */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={!apiKey || testStatus === 'loading'}
              className="h-8 rounded-lg"
            >
              {testStatus === 'loading' && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              测试连接
            </Button>
            {testStatus === 'ok' && (
              <span className="flex items-center gap-1 text-sm text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" /> {testMsg}
              </span>
            )}
            {testStatus === 'error' && (
              <span className="flex items-center gap-1 text-sm text-red-500">
                <AlertCircle className="h-3.5 w-3.5" /> {testMsg}
              </span>
            )}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="mt-6 flex justify-between">
          <button
            onClick={() => { clearProviderConfig(provider); setApiKey(''); setTestStatus('idle') }}
            className="text-sm text-slate-400 hover:text-slate-600"
          >
            清除此供应商配置
          </button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(false)} className="h-8 rounded-lg">
              取消
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!apiKey || (!isCustom ? false : !baseURL) || !model} className="h-8 rounded-lg">
              保存
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

**验证**:
- [ ] 配置 DeepSeek API Key → 保存
- [ ] 切换到 KIMI → 确认 API Key 字段**为空**（不是 DeepSeek 的 key）
- [ ] 填入 KIMI API Key → 保存
- [ ] 切回 DeepSeek → 确认 API Key 字段**显示之前保存的 DeepSeek key**
- [ ] 两个供应商都能独立测试通过

---

### Task 3: 更新 `types/session.ts` — 新增 `CanvasSnapshot`

**文件**: `src/types/session.ts`
**操作**:
- [ ] 新增 `CanvasSnapshot` 接口（引用 canvas 类型）
- [ ] `SessionItem` 新增可选字段 `canvasSnapshot`

**代码**:

```typescript
// src/types/session.ts
import type { CanvasNode, CanvasEdge } from '@/canvas/types'

export type SessionGroup = 'TODAY' | 'YESTERDAY'
export type SessionStatus = 'backlog' | 'todo' | 'needs-review' | 'done' | 'archived'

export interface CanvasSnapshot {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

export interface SessionItem {
  id: string
  title: string
  time: string
  group: SessionGroup
  status?: SessionStatus
  isActive?: boolean
  canvasSnapshot?: CanvasSnapshot  // 画布快照，用于 session 切换时恢复
}
```

**验证**:
- [ ] 运行 `npm run build` 无 TypeScript 错误

---

### Task 4: 新增 `loadSnapshot` + `clearCanvas` 到 `canvas-store.ts`

**文件**: `src/canvas/store/canvas-store.ts`
**操作**:
- [ ] 在 `CanvasState` interface 末尾新增两个方法声明
- [ ] 在 `create` 实现末尾新增两个方法实现（在 `layoutNodes` 之后）

**代码（interface 新增部分，第 56 行之后）**:

```typescript
  // Session 快照操作
  loadSnapshot: (snapshot: { nodes: CanvasNode[]; edges: CanvasEdge[] }) => void
  clearCanvas: () => void
```

**代码（实现部分，在 `layoutNodes` 实现之后，闭合括号 `}` 之前）**:

```typescript
  loadSnapshot: (snapshot) => {
    set({ nodes: snapshot.nodes, edges: snapshot.edges, lastDeleted: null })
  },

  clearCanvas: () => {
    set({ nodes: [], edges: [], lastDeleted: null })
  },
```

**验证**:
- [ ] 运行 `npm run build` 无 TypeScript 错误

---

### Task 5: 重构 `session-store.ts` — Session ↔ Canvas 双向绑定

**文件**: `src/store/session-store.ts`
**操作**:
- [ ] 新增 import：`useCanvasStore` + canvas 类型
- [ ] 重写 `setActiveSessionId`：切换前保存当前画布快照 → 加载目标 session 快照
- [ ] 重写 `createSession`：保存当前画布 → 清空画布 → 创建新 session

**代码**:

```typescript
// src/store/session-store.ts
import { create } from 'zustand'
import type { SessionItem, SessionStatus } from '@/types/session'
import { mockSessions } from '@/data/mock-sessions'
import { useCanvasStore } from '@/canvas/store/canvas-store'

interface SessionState {
  sessions: SessionItem[]
  activeSessionId: string | null
  activeFilter: SessionStatus | null
  setActiveSessionId: (id: string) => void
  setFilter: (filter: SessionStatus | null) => void
  createSession: () => void
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: mockSessions,
  activeSessionId: mockSessions.find((item) => item.isActive)?.id ?? null,
  activeFilter: null,

  setActiveSessionId: (id) => {
    const { activeSessionId, sessions } = get()
    if (id === activeSessionId) return

    // 1. 保存当前画布快照到当前 session
    const { nodes, edges } = useCanvasStore.getState()
    const updatedSessions = sessions.map((s) =>
      s.id === activeSessionId
        ? { ...s, canvasSnapshot: { nodes, edges } }
        : s
    )

    // 2. 加载目标 session 的画布快照
    const target = updatedSessions.find((s) => s.id === id)
    if (target?.canvasSnapshot) {
      useCanvasStore.getState().loadSnapshot(target.canvasSnapshot)
    } else {
      useCanvasStore.getState().clearCanvas()
    }

    set({ sessions: updatedSessions, activeSessionId: id })
  },

  setFilter: (filter) => set({ activeFilter: filter }),

  createSession: () => {
    const { activeSessionId, sessions } = get()

    // 1. 保存当前画布快照
    const { nodes, edges } = useCanvasStore.getState()

    // 2. 清空画布（新 session 从空白开始）
    useCanvasStore.getState().clearCanvas()

    const newSession: SessionItem = {
      id: `session-${Date.now()}`,
      title: 'New chat',
      time: 'now',
      group: 'TODAY',
      status: 'todo',
    }

    set({
      sessions: [
        newSession,
        ...sessions.map((item) => ({
          ...item,
          isActive: false,
          ...(item.id === activeSessionId ? { canvasSnapshot: { nodes, edges } } : {}),
        })),
      ],
      activeSessionId: newSession.id,
      activeFilter: null,
    })
  },
}))
```

**验证**:
- [ ] 在画布上创建 2-3 个节点
- [ ] 点击左侧另一个 session → 画布清空（因为那个 session 没有快照）
- [ ] 切回原 session → 原来的节点恢复
- [ ] 点击「New chat」按钮 → 当前画布保存，新建空白画布

---

### Task 6: 更新 `prompt-builder.ts` — 头脑风暴引导者 System Prompt

**文件**: `src/canvas/lib/prompt-builder.ts:4`
**操作**:
- [ ] 将 `buildSystemPrompt` 的默认 system prompt 从「发散和收敛」改为头脑风暴引导者角色
- [ ] 有引用内容时，同样保持引导模式

**代码（替换整个 `buildSystemPrompt` 函数）**:

```typescript
export function buildSystemPrompt(sourceRefs: SourceRef[]): string {
  const BRAINSTORM_ROLE = `你是一位专业的头脑风暴引导者。
当用户提出一个想法或意图时，你的任务不是直接给出答案或方案，而是通过 3-5 个精准的开放式问题帮助用户深入思考。

引导问题应覆盖以下维度（根据上下文选择最相关的）：
- 目标用户是谁？越具体越好（年龄、职业、使用场景）
- 核心痛点是什么？现有方案有什么不足？
- 市面上竞品如何做的？你的差异化或独特优势在哪里？
- 商业模式：个人自用还是卖出去？订阅制还是买断？
- 技术偏好：Web 端、App、还是两者都要？
- 规模预期：个人工具、小团队、还是面向大众？

每次回复只问问题，不要提供建议、解决方案或评价。语气友好、简洁、鼓励性。`

  if (sourceRefs.length === 0) return BRAINSTORM_ROLE

  const refs = sourceRefs
    .map((ref, i) => {
      const quote = ref.quotedText ? `"${ref.quotedText}"` : `(来自节点 ${ref.nodeId})`
      return `[引用${i + 1}] ${quote}`
    })
    .join('\n')

  return `${BRAINSTORM_ROLE}\n\n用户基于以下内容向你提问：\n\n${refs}\n\n请围绕这些引用内容，通过提问帮助用户深化思考。`
}
```

**验证**:
- [ ] 打开画布，在搜索框输入「我想做一个营销软件」
- [ ] 点击生成的某个方向节点，打开对话框
- [ ] 在对话框输入「我想开发这个方向」→ AI 应回复 3-5 个引导性问题，而非直接给方案

---

## 改动文件汇总

| 文件 | 改动类型 |
|------|---------|
| `src/canvas/lib/ai-config-store.ts` | 完整重写（存储结构 + 新 API） |
| `src/components/ai-settings-modal.tsx` | 完整重写（新 Store 绑定 + 模型下拉） |
| `src/types/session.ts` | 新增 CanvasSnapshot 类型 |
| `src/canvas/store/canvas-store.ts` | 新增 2 个方法 |
| `src/store/session-store.ts` | 完整重写（Session ↔ Canvas 绑定） |
| `src/canvas/lib/prompt-builder.ts` | 修改 buildSystemPrompt 函数 |

---

## P2 可选：拖拽性能优化

> 优先级低，可在上述 P0/P1 修复完成后处理。

**文件**: `src/canvas/nodes/chat-node.tsx`
**方案**:
- 从 `@xyflow/react` 解构 `dragging` prop（已在 `NodeProps` 中可用）
- `dragging` 为 `true` 时只渲染节点外壳 + 标题，隐藏消息列表
- 用 `React.memo` 包裹 `ChatNode` 导出

```tsx
// 在 ChatNode 内部，消息列表区域：
{!dragging && data.messages.length > 0 && (
  <div className="..." onMouseUp={handleMessageMouseUp}>
    {/* 消息列表 */}
  </div>
)}
{dragging && (
  <div className="flex h-12 items-center px-3 text-xs text-slate-400">拖动中...</div>
)}
```

---

## 风险评估

```
风险评估：2/10 — 低风险 🟢
  安全/隐私: 0  可逆性: 1  影响范围: 0
  变更规模: 1  外部依赖: 0
主要风险：Session 快照引入 cross-store 调用（session-store → canvas-store），
          需确认 Zustand getState() 调用时序正确。
```
