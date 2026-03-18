---
title: "feat: AI 配置面板（Provider 选择 + localStorage 持久化）"
type: feat
date: 2026-03-18
risk_score: 3
risk_level: low
risk_note: "API key 存 localStorage，不进 git，本地 demo 场景风险可接受"
---

## Overview

**Goal**: 在 Settings 面板里让用户通过 UI 配置 AI provider（DeepSeek/Kimi/自定义中转），配置存 localStorage，切换立即生效无需刷新
**Tech Stack**: Zustand store、localStorage、Proxy pattern、Tailwind overlay（无需新依赖）
**Architecture**: 新增 `ai-config-store.ts` 管理配置和 client 实例；`ai-client.ts` 改用 Proxy 透明转发；Settings 弹窗通过左栏入口打开

> 来源：派对模式讨论（2026-03-18），决策：localStorage + Zustand store + Proxy，不引入新 UI 依赖

---

## 背景

当前问题：
- AI provider 配置只能手动改 `.env.local` 文件
- 切换 provider（DeepSeek/Kimi/Claude中转）需要改文件并重启
- 左栏 Settings 按钮点击无响应（已知缺口）
- `aiClient` 是模块级单例，切换配置需刷新页面

目标：用户在 UI 里填一次配置，保存后立即生效，下次打开自动恢复。

---

## 文件变更清单

| 文件 | 操作 |
|------|------|
| `src/canvas/lib/ai-config-store.ts` | 新增 |
| `src/canvas/lib/ai-client.ts` | 修改（改为 Proxy） |
| `src/components/ai-settings-modal.tsx` | 新增 |
| `src/store/ui-store.ts` | 修改（加 settingsOpen 状态） |
| `src/components/left-nav-pane.tsx` | 修改（Settings 按钮加 onClick） |
| `src/App.tsx` | 修改（挂载 AISettingsModal） |

---

## 任务清单

### Task 1: 新增 ai-config-store.ts — 核心 store

**文件**: `src/canvas/lib/ai-config-store.ts`

**操作**:
- [x] 创建新文件
- [x] 定义 AIConfig 类型和 provider 预设
- [x] 实现 localStorage 读写
- [x] 实现 client 实例动态重建

**代码**:
```ts
import { create } from 'zustand'
import { MockAIClient } from './mock-ai'
import { AnthropicAIClient } from './real-ai-client'
import { OpenAICompatibleClient } from './openai-compatible-client'
import type { AIClient } from '../types'

export type ProviderPreset = 'deepseek' | 'kimi' | 'qwen' | 'anthropic' | 'custom'

export interface AIConfig {
  provider: ProviderPreset
  baseURL: string
  apiKey: string
  model: string
}

export const PROVIDER_PRESETS: Record<ProviderPreset, { label: string; baseURL: string; model: string }> = {
  deepseek: { label: 'DeepSeek', baseURL: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  kimi: { label: 'Kimi（月之暗面）', baseURL: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  qwen: { label: '阿里云百炼', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  anthropic: { label: 'Anthropic 直连', baseURL: 'https://api.anthropic.com', model: 'claude-sonnet-4-6' },
  custom: { label: '自定义中转', baseURL: '', model: '' },
}

const STORAGE_KEY = 'ai_config'

function buildClient(config: AIConfig | null): AIClient {
  if (!config || !config.apiKey) return new MockAIClient()
  if (config.provider === 'anthropic') {
    return new AnthropicAIClient(config.apiKey, config.baseURL || undefined)
  }
  return new OpenAICompatibleClient(config.apiKey, config.baseURL, config.model)
}

function loadFromStorage(): AIConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AIConfig) : null
  } catch {
    return null
  }
}

// 环境变量兜底（开发者模式）
function loadFromEnv(): AIConfig | null {
  const aiKey = import.meta.env.VITE_AI_API_KEY as string | undefined
  const aiURL = import.meta.env.VITE_AI_BASE_URL as string | undefined
  const aiModel = (import.meta.env.VITE_AI_MODEL as string | undefined) ?? 'deepseek-chat'
  if (aiKey && aiURL) {
    return { provider: 'custom', baseURL: aiURL, apiKey: aiKey, model: aiModel }
  }
  const anthKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
  const anthURL = import.meta.env.VITE_ANTHROPIC_BASE_URL as string | undefined
  if (anthKey) {
    return { provider: 'anthropic', baseURL: anthURL ?? '', apiKey: anthKey, model: 'claude-sonnet-4-6' }
  }
  return null
}

const initialConfig = loadFromStorage() ?? loadFromEnv()

interface AIConfigStore {
  config: AIConfig | null
  client: AIClient
  setConfig: (config: AIConfig) => void
  clearConfig: () => void
}

export const useAIConfigStore = create<AIConfigStore>((set) => ({
  config: initialConfig,
  client: buildClient(initialConfig),

  setConfig: (config) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    set({ config, client: buildClient(config) })
  },

  clearConfig: () => {
    localStorage.removeItem(STORAGE_KEY)
    set({ config: null, client: new MockAIClient() })
  },
}))
```

**验证**:
- [x] 运行 `npx tsc --noEmit` 确认无 TypeScript 报错

---

### Task 2: 修改 ai-client.ts — 改为 Proxy 透明转发

**文件**: `src/canvas/lib/ai-client.ts`

**操作**:
- [x] 替换全部内容，改为从 store 动态读取，canvas-store 无需任何改动

**代码**:
```ts
import { useAIConfigStore } from './ai-config-store'
import type { AIClient } from '../types'

// Proxy 透明转发：所有方法调用转给 store 中当前最新的 client 实例
// canvas-store.ts 中 import { aiClient } 的写法完全不需要改动
export const aiClient: AIClient = new Proxy({} as AIClient, {
  get(_target, prop: string) {
    const client = useAIConfigStore.getState().client
    return (client as unknown as Record<string, unknown>)[prop]
  },
})
```

**验证**:
- [x] 运行 `npx tsc --noEmit` 确认无报错
- [x] canvas-store.ts 中 `import { aiClient }` 无需任何修改

---

### Task 3: 修改 ui-store.ts — 加 settingsOpen 状态

**文件**: `src/store/ui-store.ts`

**操作**:
- [x] 在 UIState 接口加 `settingsOpen: boolean` 和对应 action
- [x] 初始值为 `false`

**代码**（替换全部内容）:
```ts
import { create } from 'zustand';

interface UIState {
    leftCollapsed: boolean;
    rightDrawerOpen: boolean;
    settingsOpen: boolean;
    setLeftCollapsed: (value: boolean) => void;
    toggleLeftCollapsed: () => void;
    setRightDrawerOpen: (value: boolean) => void;
    toggleRightDrawer: () => void;
    setSettingsOpen: (value: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
    leftCollapsed: true,
    rightDrawerOpen: true,
    settingsOpen: false,

    setLeftCollapsed: (value) => set({ leftCollapsed: value }),
    toggleLeftCollapsed: () =>
        set((state) => ({ leftCollapsed: !state.leftCollapsed })),

    setRightDrawerOpen: (value) => set({ rightDrawerOpen: value }),
    toggleRightDrawer: () =>
        set((state) => ({ rightDrawerOpen: !state.rightDrawerOpen })),

    setSettingsOpen: (value) => set({ settingsOpen: value }),
}));
```

**验证**:
- [x] 运行 `npx tsc --noEmit` 确认无报错

---

### Task 4: 新增 ai-settings-modal.tsx — Settings 弹窗 UI

**文件**: `src/components/ai-settings-modal.tsx`

**操作**:
- [x] 创建新文件
- [x] 实现 Provider 下拉选择（选中自动填 URL 和 Model）
- [x] API Key 密码输入框
- [x] 测试连接按钮（发送 "Hi" 验证 key 有效）
- [x] 保存按钮 + 清除配置按钮
- [x] 使用 fixed overlay（无需新依赖）

**代码**:
```tsx
import { useState } from 'react'
import { X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@/store/ui-store'
import { useAIConfigStore, PROVIDER_PRESETS, type AIConfig, type ProviderPreset } from '@/canvas/lib/ai-config-store'
import { OpenAICompatibleClient } from '@/canvas/lib/openai-compatible-client'
import { AnthropicAIClient } from '@/canvas/lib/real-ai-client'

export function AISettingsModal() {
  const settingsOpen = useUIStore((s) => s.settingsOpen)
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)
  const { config, setConfig, clearConfig } = useAIConfigStore()

  const [provider, setProvider] = useState<ProviderPreset>(config?.provider ?? 'deepseek')
  const [baseURL, setBaseURL] = useState(config?.baseURL ?? PROVIDER_PRESETS.deepseek.baseURL)
  const [apiKey, setApiKey] = useState(config?.apiKey ?? '')
  const [model, setModel] = useState(config?.model ?? PROVIDER_PRESETS.deepseek.model)
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [testMsg, setTestMsg] = useState('')

  if (!settingsOpen) return null

  function handleProviderChange(p: ProviderPreset) {
    setProvider(p)
    if (p !== 'custom') {
      setBaseURL(PROVIDER_PRESETS[p].baseURL)
      setModel(PROVIDER_PRESETS[p].model)
    }
  }

  async function handleTest() {
    if (!apiKey || !baseURL) return
    setTestStatus('loading')
    setTestMsg('')
    try {
      const client = provider === 'anthropic'
        ? new AnthropicAIClient(apiKey, baseURL || undefined)
        : new OpenAICompatibleClient(apiKey, baseURL, model)
      const gen = client.streamChat({
        messages: [{ id: 'test', role: 'user', text: 'Hi', createdAt: Date.now() }],
        sourceRefs: [],
      })
      // 只读第一个 chunk，收到即成功
      const first = await gen.next()
      if (first.value?.type === 'error') throw new Error(first.value.error)
      setTestStatus('ok')
      setTestMsg('连接成功 ✓')
    } catch (e) {
      setTestStatus('error')
      setTestMsg(e instanceof Error ? e.message : '连接失败')
    }
  }

  function handleSave() {
    const cfg: AIConfig = { provider, baseURL, apiKey, model }
    setConfig(cfg)
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

          {/* Base URL */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Base URL</label>
            <input
              type="text"
              value={baseURL}
              onChange={(e) => setBaseURL(e.target.value)}
              placeholder="https://api.example.com/v1"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
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
          </div>

          {/* Model */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Model</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="deepseek-chat"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          {/* 测试连接 */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={!apiKey || !baseURL || testStatus === 'loading'}
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
            onClick={() => { clearConfig(); setSettingsOpen(false) }}
            className="text-sm text-slate-400 hover:text-slate-600"
          >
            清除配置（使用 Mock）
          </button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(false)} className="h-8 rounded-lg">
              取消
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!apiKey || !baseURL || !model} className="h-8 rounded-lg">
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
- [x] 运行 `npx tsc --noEmit` 确认无报错

---

### Task 5: 修改 left-nav-pane.tsx — Settings 按钮接通

**文件**: `src/components/left-nav-pane.tsx`

**操作**:
- [x] 导入 `useUIStore` 中的 `setSettingsOpen`
- [x] 为 Settings 按钮添加 `onClick` 处理

**代码**（修改部分）:
```tsx
// 在现有 import 中添加（已有 useUIStore）
const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)

// 将 Settings 标题按钮的 className 行后添加 onClick：
// 找到渲染 group.title 的 button，改为：
<button
  className={cn(
    'flex h-9 w-full items-center rounded-xl px-3 text-sm text-slate-700',
    group.title === 'All Sessions' && 'bg-slate-200/80',
    group.title === 'Settings' && 'hover:bg-slate-200/60 cursor-pointer'
  )}
  onClick={group.title === 'Settings' ? () => setSettingsOpen(true) : undefined}
>
```

**验证**:
- [x] 点击左栏 Settings 按钮，弹窗出现

---

### Task 6: 修改 App.tsx — 挂载 AISettingsModal

**文件**: `src/App.tsx`

**操作**:
- [x] 导入 `AISettingsModal`
- [x] 在 JSX 中添加 `<AISettingsModal />`

**代码**（替换全部内容）:
```tsx
import { TopBar } from '@/components/top-bar';
import { LeftNavPane } from '@/components/left-nav-pane';
import { SessionListPane } from '@/components/session-list-pane';
import { DecisionDrawer } from '@/components/decision-drawer';
import { BrainstormCanvas } from '@/canvas/brainstorm-canvas';
import { AISettingsModal } from '@/components/ai-settings-modal';

export default function App() {
  return (
    <div className="h-screen bg-white text-slate-800">
      <TopBar />
      <div className="grid h-[calc(100vh-44px)] grid-cols-[auto_auto_1fr_auto]">
        <LeftNavPane />
        <SessionListPane />
        <BrainstormCanvas />
        <DecisionDrawer />
      </div>
      <AISettingsModal />
    </div>
  );
}
```

**验证**:
- [x] `npm run dev` 正常启动
- [x] 点击左栏 Settings → 弹窗出现
- [x] 填入 provider/key/url/model → 保存 → 刷新页面配置仍在（localStorage 持久化）
- [x] 改配置后立即生效，无需刷新（Proxy 方案）

---

## 风险评估

```
总分 3/10 — 低风险 🟢
  安全/隐私: 1  可逆性: 1  影响范围: 0
  变更规模: 1  外部依赖: 0
主要风险：API key 存 localStorage，本地 demo 场景可接受
```

---

## 验收标准

- [x] 左栏 Settings 按钮点击有响应，弹出 AI 配置弹窗
- [x] Provider 下拉选择自动填充 URL 和 Model
- [x] API Key 输入框为密码类型（不明文显示）
- [x] 测试连接按钮发送请求并展示成功/失败状态
- [x] 保存后配置写入 localStorage，刷新页面自动恢复
- [x] 配置改变后无需刷新页面，AI 调用立即使用新 client
- [x] 无 key 时降级到 MockAI，不崩溃
- [x] TypeScript 编译无报错

