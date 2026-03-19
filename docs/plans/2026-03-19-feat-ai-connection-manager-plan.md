---
title: "feat: AI Connection Manager — 多连接 + 自动格式嗅探"
type: feat
date: 2026-03-19
risk_score: 6
risk_level: medium
risk_note: "涉及 localStorage 数据迁移（不可逆）+ 多文件重构 + 外部 API 依赖"
---

# feat: AI Connection Manager — 多连接 + 自动格式嗅探

## Overview

**Goal**: 将 AI 配置从「按 Provider 类型」重构为「按连接 ID」，用户只需填 baseURL + apiKey + model，系统自动嗅探 API 格式（OpenAI vs Anthropic），支持多连接管理。

**Tech Stack**: TypeScript, Zustand, Hono, Vercel AI SDK v6, React

**Architecture**: 新增 `Connection` 数据结构替代 `ProviderPreset`；后端新增 `/api/sniff` 端点做并行格式探测；前端重建设置弹窗为连接列表 + 添加表单；右侧状态栏显示当前模型。

**Brainstorm**: `docs/brainstorms/2026-03-19-ai-connection-manager-brainstorm.md`

---

## Task 1: 定义 Connection 接口 + 新存储 key

**文件**: `src/canvas/lib/ai-config-store.ts`

**操作**:
- [ ] 在文件顶部新增 `Connection` 接口
- [ ] 新增存储 key 常量
- [ ] `status` 不持久化 — 仅作为运行时状态，`loadConnections` 时强制重置为 `'idle'`

**代码**:
```typescript
export interface Connection {
  id: string                        // uuid
  name: string                      // 自动从域名提取，用户可改
  baseURL: string                   // 含 /v1
  apiKey: string
  model: string                     // 用户指定的实际使用模型
  format: 'openai' | 'anthropic'   // 自动嗅探结果
  status: 'connected' | 'idle' | 'error'  // 运行时状态，加载时重置为 'idle'
}

const STORAGE_KEY_CONNECTIONS = 'ai_connections'
const STORAGE_KEY_ACTIVE_ID = 'ai_active_connection_id'
// 保留旧常量供迁移函数使用（Task 14 清理时不删这两行）
const STORAGE_KEY_CONFIGS = 'ai_configs'
const STORAGE_KEY_ACTIVE = 'ai_active_provider'
const LEGACY_KEY = 'ai_config'
```

**验证**:
- [ ] TypeScript 编译无报错

---

## Task 2: 编写旧数据迁移函数

**文件**: `src/canvas/lib/ai-config-store.ts`

**操作**:
- [ ] 新增 `migrateFromLegacy()` 函数，将旧 `ProviderPreset` 格式迁移为 `Connection[]`
- [ ] 旧 `kimi-coding` → format: 'anthropic'，其余 → format: 'openai'

**代码**:
```typescript
function extractName(baseURL: string): string {
  try {
    const host = new URL(baseURL).hostname  // e.g. api.siliconflow.cn
    const parts = host.split('.')
    // 取倒数第二段，首字母大写：siliconflow → SiliconFlow
    const raw = parts.length >= 2 ? parts[parts.length - 2] : parts[0]
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  } catch {
    return 'Custom'
  }
}

function migrateFromLegacy(): Connection[] {
  const rawConfigs = localStorage.getItem(STORAGE_KEY_CONFIGS)
  const rawActive = localStorage.getItem(STORAGE_KEY_ACTIVE)
  if (!rawConfigs) return []

  const configs = JSON.parse(rawConfigs) as Partial<Record<ProviderPreset, ProviderConfig>>
  const connections: Connection[] = []

  for (const [provider, cfg] of Object.entries(configs)) {
    if (!cfg) continue
    const preset = PROVIDER_PRESETS[provider as ProviderPreset]
    const baseURL = cfg.baseURL ?? preset?.baseURL ?? ''
    connections.push({
      id: crypto.randomUUID(),
      name: preset?.label ?? extractName(baseURL),
      baseURL,
      apiKey: cfg.apiKey,
      model: cfg.model,
      format: (provider === 'anthropic' || provider === 'kimi-coding') ? 'anthropic' : 'openai',
      status: 'idle',
    })
  }

  // 清理旧 key
  localStorage.removeItem(STORAGE_KEY_CONFIGS)
  localStorage.removeItem(STORAGE_KEY_ACTIVE)
  localStorage.removeItem(LEGACY_KEY)
  if (import.meta.env.DEV) console.info('[ai-config] 已迁移旧 provider 格式到 Connection[]')
  return connections
}
```

**验证**:
- [ ] 旧 localStorage 数据迁移后不丢失 apiKey

---

## Task 3: 重构 Zustand Store 为 Connection 模型

**文件**: `src/canvas/lib/ai-config-store.ts`

**操作**:
- [ ] 替换 `AIConfigStore` 接口，使用 `Connection[]` + `activeId`
- [ ] 新增 `addConnection`、`removeConnection`、`setActiveId`、`updateConnectionStatus` 方法
- [ ] `loadConnections()` 函数：先检测旧格式并迁移，再读新格式

**代码**:
```typescript
function loadConnections(): { connections: Connection[]; activeId: string } {
  try {
    // 检测旧格式并迁移
    const hasLegacy = localStorage.getItem(STORAGE_KEY_CONFIGS) || localStorage.getItem(LEGACY_KEY)
    if (hasLegacy) {
      const connections = migrateFromLegacy()
      if (connections.length > 0) {
        localStorage.setItem(STORAGE_KEY_CONNECTIONS, JSON.stringify(connections))
        const activeId = connections[0].id
        localStorage.setItem(STORAGE_KEY_ACTIVE_ID, activeId)
        return { connections, activeId }
      }
    }

    const raw = localStorage.getItem(STORAGE_KEY_CONNECTIONS)
    const rawId = localStorage.getItem(STORAGE_KEY_ACTIVE_ID)
    const connections: Connection[] = raw
      ? (JSON.parse(raw) as Connection[]).map(c => ({ ...c, status: 'idle' as const }))  // 重置运行时状态
      : []
    const activeId = rawId && connections.some(c => c.id === rawId)
      ? rawId
      : (connections[0]?.id ?? '')
    return { connections, activeId }
  } catch {
    return { connections: [], activeId: '' }
  }
}

interface AIConfigStore {
  connections: Connection[]
  activeId: string
  client: AIClient
  addConnection: (conn: Connection) => void
  removeConnection: (id: string) => void
  setActiveId: (id: string) => void
  updateConnectionStatus: (id: string, status: Connection['status']) => void
}
```

**验证**:
- [ ] Store 初始化不报错，`connections` 为数组

---

## Task 4: 更新 ProxyAIClient 使用 format 字段

**文件**: `src/canvas/lib/proxy-ai-client.ts`

**操作**:
- [ ] 将 `AIConfig`（含 `provider: ProviderPreset`）替换为 `ConnectionConfig`（含 `format`）
- [ ] 更新 POST body 发送 `format` 而非 `provider`
- [ ] 注意：`ConnectionConfig` 是 `Connection` 的子集，避免重复定义

**代码**:
```typescript
// 直接用 Connection 的 Pick，不新增冗余接口
export type ConnectionConfig = Pick<Connection, 'format' | 'baseURL' | 'apiKey' | 'model'>

// ProxyAIClient 构造函数改为接收 ConnectionConfig
export class ProxyAIClient implements AIClient {
  constructor(private config: ConnectionConfig) {}

  async *streamChat(req: ChatRequest, signal?: AbortSignal): AsyncGenerator<ChatChunk> {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        format: this.config.format,
        baseURL: this.config.baseURL,
        apiKey: this.config.apiKey,
        model: this.config.model,
        messages: req.messages.map(m => ({ role: m.role, content: m.text })),
      }),
    })
    // ... 其余流式读取逻辑不变（NDJSON 解析保持原样）
  }
}
```

**验证**:
- [ ] 发送请求 body 中有 `format` 字段，无 `provider` 字段

---

## Task 5: 更新 server/provider.ts + server/app.ts 按 format 路由

**文件**: `server/provider.ts`, `server/app.ts`

**操作**:
- [ ] `buildModel` 签名从 `(provider, ...)` 改为 `(format, ...)`，删除 `ProviderPreset` 依赖
- [ ] `AIProxyBody` 中 `provider` 改为 `format`，更新两个路由的 `buildModel` 调用

**代码** (`server/provider.ts`):
```typescript
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'

export function buildModel(
  format: 'openai' | 'anthropic',
  apiKey: string,
  baseURL: string,
  model: string,
): LanguageModel {
  if (format === 'anthropic') {
    return createAnthropic({ apiKey, baseURL })(model)
  }
  return createOpenAI({ apiKey, baseURL }).chat(model)
}
```

**代码** (`server/app.ts` 修改处):
```typescript
type AIProxyBody = {
  format: 'openai' | 'anthropic'   // 替代旧的 provider
  apiKey: string
  baseURL: string
  model: string
}

// /api/chat 和 /api/directions 中：
const languageModel = buildModel(body.format, body.apiKey, body.baseURL, body.model)
```

**验证**:
- [ ] 编译无报错，用 DeepSeek 测试聊天仍正常（format: 'openai'）

---

## Task 6: 新增 /api/sniff 端点（并行格式嗅探）

**文件**: `server/app.ts`

**操作**:
- [ ] 新增 `POST /api/sniff` 路由
- [ ] 用 `Promise.any()` 并行测试 OpenAI 和 Anthropic 格式
- [ ] 探针 prompt 固定为 `"Reply with one word: ok"` 以最小化 token 消耗

**代码**:
```typescript
app.post('/api/sniff', async (c) => {
  const body = await c.req.json<{ apiKey: string; baseURL: string; model: string }>()

  if (!isAllowedBaseURL(body.baseURL)) {
    return c.json({ error: 'Base URL 不允许' }, 400)
  }

  const probeMessages = [{ role: 'user' as const, content: 'Reply with one word: ok' }]
  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), 10000)

  async function tryFormat(format: 'openai' | 'anthropic'): Promise<'openai' | 'anthropic'> {
    const model = buildModel(format, body.apiKey, body.baseURL, body.model)
    const result = await generateText({
      model,
      messages: probeMessages,
      maxTokens: 10,
      abortSignal: abortController.signal,
      maxRetries: 0,
    })
    if (!result.text) throw new Error('empty response')
    return format
  }

  try {
    const format = await Promise.any([tryFormat('openai'), tryFormat('anthropic')])
    clearTimeout(timeout)
    abortController.abort()  // 取消另一个仍在运行的请求
    return c.json({ format })
  } catch (err) {
    clearTimeout(timeout)
    if (abortController.signal.aborted) {
      return c.json({ error: '连接超时（10s），请检查网络或 URL' }, 400)
    }
    // 从 AggregateError 提取两种格式各自的错误信息
    const errors = err instanceof AggregateError ? err.errors : [err]
    const details = errors.map((e: unknown) => e instanceof Error ? e.message : String(e)).join(' / ')
    return c.json({ error: `两种格式均失败：${details}` }, 400)
  }
})
```

**验证**:
- [ ] `POST /api/sniff` 对 DeepSeek 返回 `{ format: 'openai' }`
- [ ] 对 Kimi for Coding 返回 `{ format: 'anthropic' }`
- [ ] 两种格式都失败时，错误信息包含具体原因（如 401 Unauthorized）

---

## Task 7: URL 校验内联到添加表单（不新建文件）

**文件**: `src/components/ai-settings-modal.tsx`

**操作**:
- [ ] 在 `AddConnectionForm` 组件内直接定义 `validateBaseURL` 函数（不新建 `url-validator.ts`）
- [ ] 同时将 `extractName` 定义在模块顶部（供表单和迁移函数共用）

**代码**:
```typescript
// ai-settings-modal.tsx 顶部（模块级，供表单和迁移共用）
export function extractName(baseURL: string): string {
  try {
    const parts = new URL(baseURL).hostname.split('.')
    const raw = parts.length >= 2 ? parts[parts.length - 2] : parts[0]
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  } catch {
    return 'Custom'
  }
}

// AddConnectionForm 内部
function validateBaseURL(url: string): { valid: boolean; warning?: string; error?: string } {
  if (!url) return { valid: false, error: '请填写 Base URL' }
  let parsed: URL
  try { parsed = new URL(url) } catch { return { valid: false, error: '不是合法的 URL 格式' } }
  const { protocol, hostname, pathname } = parsed
  if (protocol !== 'https:' && !(protocol === 'http:' && (hostname === 'localhost' || hostname === '127.0.0.1'))) {
    return { valid: false, error: '必须使用 HTTPS（本地地址除外）' }
  }
  if (pathname.endsWith('/')) return { valid: true, warning: '建议去掉末尾斜杠' }
  if (!pathname.endsWith('/v1') && !pathname.includes('/v1/')) return { valid: true, warning: '路径通常以 /v1 结尾，请确认' }
  return { valid: true }
}
```

**验证**:
- [ ] `validateBaseURL('https://api.deepseek.com/v1')` → `{ valid: true }`

---

## Task 8: 重建 AISettingsModal — 连接列表视图

**文件**: `src/components/ai-settings-modal.tsx`

**操作**:
- [ ] 替换现有 Provider 下拉为连接列表
- [ ] 每行显示：状态点 + 名称 + baseURL 摘要 + 格式标签 + [启用] 按钮

**代码**:
```tsx
function ConnectionList({ onAdd }: { onAdd: () => void }) {
  const { connections, activeId, setActiveId, removeConnection } = useAIConfigStore()

  return (
    <div className="space-y-2">
      {connections.map(conn => (
        <div key={conn.id} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
          <span className={cn('h-2 w-2 rounded-full flex-shrink-0', {
            'bg-emerald-500': conn.status === 'connected',
            'bg-slate-300': conn.status === 'idle',
            'bg-red-400': conn.status === 'error',
          })} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800">{conn.name}</p>
            <p className="truncate text-xs text-slate-400">{conn.baseURL} · {conn.format === 'openai' ? 'OpenAI 格式' : 'Anthropic 格式'}</p>
          </div>
          {activeId === conn.id
            ? <span className="text-xs text-emerald-600 font-medium">启用中</span>
            : <button onClick={() => setActiveId(conn.id)} className="text-xs text-slate-500 hover:text-slate-800">启用</button>
          }
          <button onClick={() => removeConnection(conn.id)} className="text-slate-300 hover:text-red-400">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button onClick={onAdd} className="flex w-full items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700">
        <Plus className="h-4 w-4" /> 添加新连接
      </button>
    </div>
  )
}
```

**验证**:
- [ ] 列表渲染不报错，点击「启用」切换 activeId

---

## Task 9: 重建 AISettingsModal — 添加连接表单 + 嗅探流程

**文件**: `src/components/ai-settings-modal.tsx`

**操作**:
- [ ] 新增 `AddConnectionForm` 组件，包含 baseURL / apiKey / model 输入
- [ ] 点击「添加」时调用 `/api/sniff`，成功后保存连接
- [ ] 嗅探中显示进度，失败显示具体错误

**代码**:
```tsx
function AddConnectionForm({ onBack }: { onBack: () => void }) {
  const { addConnection } = useAIConfigStore()
  const [baseURL, setBaseURL] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [name, setName] = useState('')
  const [sniffStatus, setSniffStatus] = useState<'idle' | 'sniffing' | 'ok' | 'error'>('idle')
  const [sniffMsg, setSniffMsg] = useState('')

  const urlValidation = validateBaseURL(baseURL)

  async function handleAdd() {
    if (!urlValidation.valid || !apiKey || !model) return
    setSniffStatus('sniffing')
    setSniffMsg('')
    try {
      const res = await fetch('/api/sniff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, baseURL, model }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? '嗅探失败')

      const conn: Connection = {
        id: crypto.randomUUID(),
        name: name || extractName(baseURL),
        baseURL,
        apiKey,
        model,
        format: data.format,
        status: 'connected',
      }
      addConnection(conn)
      setSniffStatus('ok')
      setTimeout(onBack, 800)
    } catch (e) {
      setSniffStatus('error')
      setSniffMsg(e instanceof Error ? e.message : '添加失败')
    }
  }

  return (
    <div className="space-y-4">
      {/* baseURL / apiKey / model / name 输入框 — 同现有样式 */}
      {urlValidation.warning && (
        <p className="text-xs text-amber-500">{urlValidation.warning}</p>
      )}
      {urlValidation.error && (
        <p className="text-xs text-red-500">{urlValidation.error}</p>
      )}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onBack}>返回</Button>
        <Button size="sm" onClick={handleAdd}
          disabled={!urlValidation.valid || !apiKey || !model || sniffStatus === 'sniffing'}>
          {sniffStatus === 'sniffing' ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />检测格式中...</> : '添加连接'}
        </Button>
      </div>
      {sniffStatus === 'error' && <p className="text-xs text-red-500">{sniffMsg}</p>}
    </div>
  )
}
```

**验证**:
- [ ] 填入 DeepSeek 信息后点「添加连接」，嗅探成功，连接出现在列表中

---

## Task 10: 新建 AIStatusBadge 组件

**文件**: `src/components/ai-status-badge.tsx`（新建）

**操作**:
- [ ] 读取 `activeId` 对应的 `Connection`，显示状态点 + 模型名
- [ ] 点击跳转到设置弹窗

**代码**:
```tsx
import { useAIConfigStore } from '@/canvas/lib/ai-config-store'
import { useUIStore } from '@/store/ui-store'

export function AIStatusBadge() {
  const { connections, activeId } = useAIConfigStore()
  const setSettingsOpen = useUIStore(s => s.setSettingsOpen)
  const active = connections.find(c => c.id === activeId)

  const dotColor = !active
    ? 'bg-slate-300'
    : active.status === 'connected' ? 'bg-emerald-500'
    : active.status === 'error' ? 'bg-red-400'
    : 'bg-amber-400'

  const label = !active
    ? '未配置 AI'
    : active.status === 'error'
    ? `${active.model}（Key 可能已过期）`
    : active.model

  return (
    <button
      onClick={() => setSettingsOpen(true)}
      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
    >
      <span className={`h-2 w-2 rounded-full ${dotColor}`} />
      <span className="max-w-[120px] truncate">{label}</span>
    </button>
  )
}
```

**验证**:
- [ ] 组件渲染不报错，显示当前活跃连接的模型名

---

## Task 11: 将 AIStatusBadge 挂载到画布 UI

**文件**: 找到输入框所在组件（`src/components/chat-input.tsx` 或类似）

**操作**:
- [ ] 在输入框右上角区域引入 `<AIStatusBadge />`
- [ ] 确认位置：输入框容器的右上角，不遮挡输入内容

**代码**:
```tsx
import { AIStatusBadge } from './ai-status-badge'

// 在输入框容器内，右上角位置：
<div className="relative">
  <div className="absolute right-2 top-2 z-10">
    <AIStatusBadge />
  </div>
  {/* 原有输入框内容 */}
</div>
```

**验证**:
- [ ] 画布页面右上角可见状态徽章，点击可打开设置弹窗

---

## Task 12: 更新 Store 的 buildClient 逻辑

**文件**: `src/canvas/lib/ai-config-store.ts`

**操作**:
- [ ] `buildActiveClient` 改为从 `Connection` 构建 `ProxyAIClient`
- [ ] `addConnection` 保存后自动设为 activeId 并重建 client
- [ ] `updateConnectionStatus` 只更新 status 字段，不重建 client

**代码**:
```typescript
function buildClientFromConnection(conn: Connection | undefined): AIClient {
  if (!conn || !conn.apiKey) return new MockAIClient()
  return new ProxyAIClient({
    format: conn.format,
    baseURL: conn.baseURL,
    apiKey: conn.apiKey,
    model: conn.model,
  })
}

// store 实现：
addConnection: (conn) => {
  const newConns = [...get().connections, conn]
  localStorage.setItem(STORAGE_KEY_CONNECTIONS, JSON.stringify(newConns))
  localStorage.setItem(STORAGE_KEY_ACTIVE_ID, conn.id)
  set({ connections: newConns, activeId: conn.id, client: buildClientFromConnection(conn) })
},

setActiveId: (id) => {
  localStorage.setItem(STORAGE_KEY_ACTIVE_ID, id)
  const conn = get().connections.find(c => c.id === id)
  set({ activeId: id, client: buildClientFromConnection(conn) })
},

removeConnection: (id) => {
  const newConns = get().connections.filter(c => c.id !== id)
  localStorage.setItem(STORAGE_KEY_CONNECTIONS, JSON.stringify(newConns))
  const newActiveId = get().activeId === id ? (newConns[0]?.id ?? '') : get().activeId
  localStorage.setItem(STORAGE_KEY_ACTIVE_ID, newActiveId)
  const newActive = newConns.find(c => c.id === newActiveId)
  set({ connections: newConns, activeId: newActiveId, client: buildClientFromConnection(newActive) })
},

updateConnectionStatus: (id, status) => {
  const newConns = get().connections.map(c => c.id === id ? { ...c, status } : c)
  set({ connections: newConns })
},
```

**验证**:
- [ ] 切换连接后 `client` 实例更新，聊天使用新连接

---

## Task 13: 清理旧类型和引用

**文件**: `src/canvas/lib/ai-config-store.ts`, `src/canvas/types.ts`, 所有引用处

**操作**:
- [ ] 删除 `PROVIDER_PRESETS`、`PROVIDER_MODELS`、`ProviderPreset`、`ProviderConfig`、`AIConfig`（如无其他引用）
- [ ] 删除旧的 `buildClient(config: AIConfig)`、`toAIConfig`、`loadConfigs`、`loadFromEnv` 函数
- [ ] **保留** `STORAGE_KEY_CONFIGS`、`STORAGE_KEY_ACTIVE`、`LEGACY_KEY` 三个常量（迁移函数依赖）
- [ ] `loadFromEnv` 函数：迁移为从环境变量创建 `Connection` 对象（`VITE_AI_API_KEY` + `VITE_AI_BASE_URL` → Connection with format sniffed or defaulting to 'openai'）；若无环境变量则返回空数组
- [ ] 搜索所有 `import { ..., ProviderPreset, ... }` 并更新

**操作**:
```bash
# 搜索残留引用
grep -r "ProviderPreset\|PROVIDER_PRESETS\|PROVIDER_MODELS\|AIConfig\|ProviderConfig" src/ server/ --include="*.ts" --include="*.tsx"
```

**验证**:
- [ ] 搜索结果为空（或仅剩迁移函数内的临时引用）
- [ ] `pnpm tsc --noEmit` 无报错

---

## Task 14: E2E 验证 + 提交

**操作**:
- [ ] 启动开发服务器：`pnpm dev`
- [ ] 打开设置弹窗，验证连接列表为空（首次）
- [ ] 添加 DeepSeek 连接：填入 `https://api.deepseek.com/v1` + key + `deepseek-chat`，点「添加连接」
- [ ] 验证嗅探成功，连接出现在列表，状态徽章显示 `deepseek-chat`
- [ ] 发送一条消息，验证聊天正常
- [ ] 添加第二个连接（Kimi for Coding），切换启用，验证聊天切换
- [ ] 刷新页面，验证连接列表持久化

**提交**:
```bash
git add src/canvas/lib/ai-config-store.ts \
        src/canvas/lib/proxy-ai-client.ts src/components/ai-settings-modal.tsx \
        src/components/ai-status-badge.tsx server/provider.ts server/app.ts
git commit -m "feat(ai): AI Connection Manager — 多连接 + 自动格式嗅探

- Connection[] 替代 ProviderPreset，支持多连接管理
- /api/sniff 端点并行探测 OpenAI/Anthropic 格式
- 旧 localStorage 数据自动迁移
- 右侧状态徽章显示当前模型

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## 风险评估

| 维度 | 分数 | 说明 |
|------|------|------|
| 安全/隐私 | 1 | apiKey 存 localStorage，无新增风险 |
| 可逆性 | 2 | localStorage 迁移不可逆（旧 key 被删除） |
| 影响范围 | 1 | 本地个人项目 |
| 变更规模 | 1 | 约 6 个文件 |
| 外部依赖 | 1 | 依赖用户填入的第三方 API |

**总分**: 6/10 🟡 中风险

**主要风险**: localStorage 迁移不可逆，建议在迁移前备份旧数据（迁移函数已实现，但无回滚机制）。

---

## 遗留问题（来自 brainstorm）

1. 嗅探探针 prompt 已定为 `"Reply with one word: ok"`（见 Task 7）
2. 连接名称提取规则：`api.siliconflow.cn` → `SiliconFlow`（见 Task 2 `extractName`）
3. 旧 `kimi-coding` 迁移：format 设为 `'anthropic'`（见 Task 2）
4. 状态徽章位置：输入框右上角（见 Task 12，具体位置待确认组件结构）
