---
title: "feat: AI 连接可靠性 PR1 — 智能URL探测 + 测试按钮"
type: feat
date: 2026-03-19
risk_score: 3
risk_level: low
risk_note: "纯前端改动，后端零改动；涉及 localStorage 写入但完全可逆；影响范围仅限本地工具"
---

# feat: AI 连接可靠性 PR1 — 智能URL探测 + 测试按钮

## Overview

**Goal**: 修复用户输入无路径 URL（如 `https://www.fucheers.top`）时连接失败的问题，并为已有连接提供主动测试能力。
**Tech Stack**: React + Zustand + TypeScript，复用现有 `/api/sniff` 后端接口
**Architecture**: 纯前端改动。`ai-settings-modal.tsx` 负责 UI 和探测逻辑，`ai-config-store.ts` 新增 `updateConnection` 方法。后端零改动。

---

## 背景与根因

（see brainstorm: docs/brainstorms/2026-03-19-connection-reliability-system-brainstorm.md）

Vercel AI SDK 的 `createOpenAI({ baseURL })` 会在 `baseURL` 后追加 `/chat/completions`。用户输入 `https://www.fucheers.top`（无路径），实际请求打到 `https://www.fucheers.top/chat/completions`，而正确 endpoint 是 `https://www.fucheers.top/v1/chat/completions`。

UI 目前只显示黄色警告「路径通常以 /v1 结尾」，但不阻止提交，也不自动修正。

---

## 功能 1：智能 URL 探测（添加连接时）

### 设计决策

- **候选列表**（仅当 URL 无路径时生成）：`[/v1, 原始, /api/v1, /api]`
  - `/v1` 优先：OpenAI 兼容格式最常见路径
  - 原始 URL：部分中转服务直接在根路径提供服务
  - `/api/v1`：少数服务商使用
  - `/api`：Ollama 原生路径（SpecFlow 补充）
- **有路径则跳过**：`pathname !== '/'` 时直接用原始 URL，不猜测
- **存储成功 URL**：不存用户原始输入，存探测成功的 URL
- **全部失败时**：允许强制添加，显示警告「无法验证连接，已保存但可能无法使用」（不阻塞用户）
- **取消/关闭 Modal**：使用 `AbortController` abort 正在进行的 fetch，防止组件卸载后状态更新

### 候选生成函数

```typescript
// src/components/ai-settings-modal.tsx
function generateCandidates(rawURL: string): string[] {
  try {
    const { pathname } = new URL(rawURL)
    if (pathname !== '/' && pathname !== '') return [rawURL]
  } catch {
    return [rawURL] // 非法 URL 直接返回原始，让 validateBaseURL 处理
  }
  const base = rawURL.replace(/\/$/, '')
  return [base + '/v1', base, base + '/api/v1', base + '/api']
}
```

### 探测循环逻辑

```typescript
// handleAdd 中的探测循环（替换原有单次 /api/sniff 调用）
const abortController = new AbortController()
// abortControllerRef.current = abortController  // 存 ref 供取消用

let successURL: string | null = null
let successFormat: 'openai' | 'anthropic' | null = null

for (const candidate of generateCandidates(baseURL)) {
  setSniffMsg(`正在探测 ${candidate}...`)
  try {
    const res = await fetch('/api/sniff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, baseURL: candidate, model }),
      signal: abortController.signal,
    })
    const data = await res.json()
    if (res.ok && !data.error) {
      successURL = candidate
      successFormat = data.format
      break
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return // 用户取消，静默退出
    // 其他错误继续尝试下一个候选
  }
}

if (successURL && successFormat) {
  // 正常添加
} else {
  // 全部失败：允许强制添加，使用原始 URL，format 默认 'openai'
  setSniffStatus('error')
  setSniffMsg('无法自动验证连接，已保存但可能无法使用')
  // 仍然添加连接，让用户自行判断
  successURL = baseURL
  successFormat = 'openai'
}
```

---

## 功能 2：测试按钮（已有连接）

### 设计决策

- 每个连接行加「测试」按钮，点击后 loading → 成功/失败图标
- 成功：更新 `status + baseURL + format`（静默 URL 修正）
- 失败：更新 `status: 'error'`
- 图标显示 3 秒后恢复默认（本地 UI 状态，不持久化）
- 测试中途删除连接：`updateConnection` 对不存在的 id 静默忽略
- 多个连接同时测试：各自独立管理 loading 状态，无并发限制

### Store 新增方法

```typescript
// src/canvas/lib/ai-config-store.ts — 在 AIConnectionStore interface 中新增
updateConnection: (id: string, partial: Partial<Pick<Connection, 'baseURL' | 'format' | 'status'>>) => void
```

```typescript
// 实现
updateConnection: (id, partial) => {
  const exists = get().connections.some(c => c.id === id)
  if (!exists) return // 静默忽略已删除的连接
  const newConnections = get().connections.map(c => c.id === id ? { ...c, ...partial } : c)
  saveConnections(newConnections)
  set({
    connections: newConnections,
    // 如果修改的是当前活跃连接，同步重建 client
    ...(get().activeId === id && partial.baseURL || partial.format || partial.apiKey
      ? { client: buildClientFromConnection(newConnections.find(c => c.id === id)) }
      : {}),
  })
},
```

### 测试按钮 UI（ConnectionList 中每行）

```tsx
// 每个连接行新增测试按钮，需要本地 state 管理 per-connection 的测试状态
// 使用 Map<id, 'idle'|'testing'|'ok'|'error'> 存在 ConnectionList 的 useState 中
```

---

## 任务拆解

### Task 1: 在 ai-config-store.ts 新增 updateConnection 方法

**文件**: `src/canvas/lib/ai-config-store.ts`

**操作**:
- [x] 在 `AIConnectionStore` interface 中新增 `updateConnection` 签名
- [x] 在 `create()` 实现中新增 `updateConnection` 方法体

**代码**:

在 `AIConnectionStore` interface（约第 172 行）新增：
```typescript
updateConnection: (id: string, partial: Partial<Pick<Connection, 'baseURL' | 'format' | 'status'>>) => void
```

在 `create<AIConnectionStore>((set, get) => ({` 实现中，`updateConnectionStatus` 之后新增：
```typescript
updateConnection: (id, partial) => {
  if (!get().connections.some(c => c.id === id)) return
  const newConnections = get().connections.map(c =>
    c.id === id ? { ...c, ...partial } : c
  )
  saveConnections(newConnections)
  const updatedConn = newConnections.find(c => c.id === id)
  set({
    connections: newConnections,
    ...(get().activeId === id
      ? { client: buildClientFromConnection(updatedConn) }
      : {}),
  })
},
```

**验证**:
- [x] TypeScript 编译无报错：`pnpm tsc --noEmit`

---

### Task 2: 在 ai-settings-modal.tsx 添加 generateCandidates 函数

**文件**: `src/components/ai-settings-modal.tsx`

**操作**:
- [x] 在文件顶部（`validateBaseURL` 函数之后）新增 `generateCandidates` 函数

**代码**:
```typescript
// 智能 URL 候选列表生成（仅当 URL 无路径时展开）
function generateCandidates(rawURL: string): string[] {
  try {
    const { pathname } = new URL(rawURL)
    if (pathname !== '/' && pathname !== '') return [rawURL]
  } catch {
    return [rawURL]
  }
  const base = rawURL.replace(/\/$/, '')
  return [base + '/v1', base, base + '/api/v1', base + '/api']
}
```

**验证**:
- [ ] TypeScript 编译无报错：`pnpm tsc --noEmit`

---

### Task 3: 改造 AddConnectionForm — 添加 AbortController ref 和探测循环

**文件**: `src/components/ai-settings-modal.tsx:69`

**操作**:
- [ ] 在 `AddConnectionForm` 组件中新增 `abortControllerRef`
- [ ] 在 `useEffect` cleanup 中 abort 进行中的请求
- [ ] 将 `handleAdd` 中的单次 `/api/sniff` 调用替换为候选探测循环

**代码**:

在 `AddConnectionForm` 函数体顶部（`useState` 声明之后）新增：
```typescript
const abortControllerRef = useRef<AbortController | null>(null)

useEffect(() => {
  return () => { abortControllerRef.current?.abort() }
}, [])
```

同时在 import 行新增 `useRef, useEffect`（修改第 1 行 import）：
```typescript
import { useState, useRef, useEffect } from 'react'
```

**验证**:
- [ ] TypeScript 编译无报错：`pnpm tsc --noEmit`

---

### Task 4: 替换 handleAdd 中的探测逻辑

**文件**: `src/components/ai-settings-modal.tsx:82`

**操作**:
- [ ] 将 `handleAdd` 函数体完整替换为候选探测循环版本

**代码**:
```typescript
async function handleAdd() {
  if (!canAdd) return
  setSniffStatus('sniffing')
  setSniffMsg('')

  const ac = new AbortController()
  abortControllerRef.current = ac

  const candidates = generateCandidates(baseURL)
  let successURL: string | null = null
  let successFormat: 'openai' | 'anthropic' | null = null

  for (const candidate of candidates) {
    setSniffMsg(`正在探测 ${candidate}...`)
    try {
      const res = await fetch('/api/sniff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, baseURL: candidate, model }),
        signal: ac.signal,
      })
      const data = await res.json() as { format?: string; error?: string }
      if (res.ok && !data.error && data.format) {
        successURL = candidate
        successFormat = data.format as 'openai' | 'anthropic'
        break
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      // 继续尝试下一个候选
    }
  }

  const finalURL = successURL ?? baseURL
  const finalFormat = successFormat ?? 'openai'

  const conn: Connection = {
    id: crypto.randomUUID(),
    name: name.trim() || extractName(finalURL),
    baseURL: finalURL,
    apiKey,
    model,
    format: finalFormat,
    status: 'connected',
  }
  addConnection(conn)

  if (successURL) {
    setSniffStatus('ok')
    const corrected = successURL !== baseURL ? `（已自动修正为 ${successURL}）` : ''
    setSniffMsg(`已添加「${conn.name}」（${finalFormat === 'openai' ? 'OpenAI 格式' : 'Anthropic 格式'}）${corrected}`)
  } else {
    setSniffStatus('error')
    setSniffMsg(`无法验证连接，已保存「${conn.name}」，请确认 URL 和 API Key 是否正确`)
  }
  setTimeout(onBack, 1800)
}
```

**验证**:
- [ ] TypeScript 编译无报错：`pnpm tsc --noEmit`
- [ ] 手动测试：输入 `https://api.deepseek.com`（无 `/v1`），应自动探测到 `https://api.deepseek.com/v1`
- [ ] 手动测试：输入 `https://api.deepseek.com/v1`（有路径），应直接用原始 URL

---

### Task 5: 更新 sniffing 状态时的按钮文字

**文件**: `src/components/ai-settings-modal.tsx:205`

**操作**:
- [ ] 将按钮文字从「正在嗅探格式...」改为动态显示探测进度

**代码**:

将第 206 行：
```tsx
{sniffStatus === 'sniffing' ? '正在嗅探格式...' : '添加连接'}
```
改为：
```tsx
{sniffStatus === 'sniffing' ? (sniffMsg || '正在探测...') : '添加连接'}
```

同时移除第 208 行的静态提示文字（探测进度已在按钮内显示）：
```tsx
// 删除这行：
<p className="text-xs text-slate-400">点击「添加连接」将自动检测 API 格式（OpenAI / Anthropic），约需 3-10 秒</p>
```
改为：
```tsx
<p className="text-xs text-slate-400">将自动尝试多个路径（/v1、/api 等），找到可用的为止</p>
```

**验证**:
- [ ] 视觉检查：探测进行中按钮显示「正在探测 https://xxx/v1...」

---

### Task 6: 在 ConnectionList 中添加测试按钮

**文件**: `src/components/ai-settings-modal.tsx:24`

**操作**:
- [ ] 在 `ConnectionList` 中新增 per-connection 测试状态管理
- [ ] 每个连接行新增「测试」按钮
- [ ] 从 store 引入 `updateConnection`

**代码**:

完整替换 `ConnectionList` 函数：
```tsx
function ConnectionList({ onAdd }: { onAdd: () => void }) {
  const { connections, activeId, setActiveId, removeConnection, updateConnection } = useAIConnectionStore()
  const [testStates, setTestStates] = useState<Record<string, 'idle' | 'testing' | 'ok' | 'error'>>({})

  async function handleTest(conn: Connection) {
    setTestStates(s => ({ ...s, [conn.id]: 'testing' }))
    try {
      const res = await fetch('/api/sniff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: conn.apiKey, baseURL: conn.baseURL, model: conn.model }),
      })
      const data = await res.json() as { format?: string; error?: string }
      if (res.ok && !data.error && data.format) {
        updateConnection(conn.id, {
          status: 'connected',
          format: data.format as 'openai' | 'anthropic',
        })
        setTestStates(s => ({ ...s, [conn.id]: 'ok' }))
      } else {
        updateConnection(conn.id, { status: 'error' })
        setTestStates(s => ({ ...s, [conn.id]: 'error' }))
      }
    } catch {
      updateConnection(conn.id, { status: 'error' })
      setTestStates(s => ({ ...s, [conn.id]: 'error' }))
    }
    setTimeout(() => setTestStates(s => ({ ...s, [conn.id]: 'idle' })), 3000)
  }

  return (
    <div className="space-y-2">
      {connections.length === 0 && (
        <p className="py-4 text-center text-sm text-slate-400">暂无连接，点击下方添加</p>
      )}
      {connections.map(conn => {
        const ts = testStates[conn.id] ?? 'idle'
        return (
          <div key={conn.id} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
            <span className={cn('h-2 w-2 flex-shrink-0 rounded-full', {
              'bg-emerald-500': conn.status === 'connected',
              'bg-slate-300': conn.status === 'idle',
              'bg-red-400': conn.status === 'error',
            })} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">{conn.name}</p>
              <p className="truncate text-xs text-slate-400">
                {conn.baseURL} · {conn.format === 'openai' ? 'OpenAI 格式' : 'Anthropic 格式'}
              </p>
            </div>
            {/* 测试按钮 */}
            <button
              onClick={() => handleTest(conn)}
              disabled={ts === 'testing'}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 disabled:opacity-50"
              aria-label="测试连接"
            >
              {ts === 'testing' && <Loader2 className="h-3 w-3 animate-spin" />}
              {ts === 'ok' && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
              {ts === 'error' && <AlertCircle className="h-3 w-3 text-red-400" />}
              {ts === 'idle' && <span>测试</span>}
            </button>
            {activeId === conn.id
              ? <span className="text-xs font-medium text-emerald-600">启用中</span>
              : <button onClick={() => setActiveId(conn.id)} className="text-xs text-slate-500 hover:text-slate-800">启用</button>
            }
            <button
              onClick={() => removeConnection(conn.id)}
              className="text-slate-300 hover:text-red-400"
              aria-label="删除连接"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      })}
      <button
        onClick={onAdd}
        className="flex w-full items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700"
      >
        <Plus className="h-4 w-4" /> 添加新连接
      </button>
    </div>
  )
}
```

**验证**:
- [ ] TypeScript 编译无报错：`pnpm tsc --noEmit`
- [ ] 视觉检查：每个连接行有「测试」文字按钮
- [ ] 手动测试：点击测试，loading → 成功图标 → 3 秒后恢复「测试」文字

---

### Task 7: 验证 validateBaseURL 的警告逻辑与新探测行为一致

**文件**: `src/components/ai-settings-modal.tsx:10`

**操作**:
- [ ] 检查 `validateBaseURL` 的警告文字是否需要更新，因为现在系统会自动探测 `/v1`

**代码**:

将第 19 行的警告文字：
```typescript
if (!pathname.endsWith('/v1') && !pathname.includes('/v1/')) return { valid: true, warning: '路径通常以 /v1 结尾，请确认' }
```
改为：
```typescript
if (!pathname.endsWith('/v1') && !pathname.includes('/v1/')) return { valid: true, warning: '未检测到 /v1 路径，将自动尝试多个路径' }
```

**验证**:
- [ ] 视觉检查：输入 `https://api.example.com` 时显示新警告文字

---

### Task 8: 端到端手动验证

**操作**:
- [ ] 启动开发服务器（用户手动运行 `pnpm dev`）
- [ ] 测试场景 1：输入无路径 URL（如 `https://api.deepseek.com`），验证自动探测到 `/v1`
- [ ] 测试场景 2：输入有路径 URL（如 `https://api.deepseek.com/v1`），验证直接使用
- [ ] 测试场景 3：输入无效 URL，验证全部候选失败后仍可添加（带警告）
- [ ] 测试场景 4：点击已有连接的「测试」按钮，验证 loading → 成功/失败 → 3 秒恢复
- [ ] 测试场景 5：探测进行中关闭 Modal，验证无 React 警告

**验证**:
- [ ] TypeScript 编译无报错：`pnpm tsc --noEmit`
- [ ] 所有手动测试场景通过

---

## 受影响文件

| 文件 | 改动类型 |
|------|---------|
| `src/components/ai-settings-modal.tsx` | 修改（主要改动） |
| `src/canvas/lib/ai-config-store.ts` | 修改（新增 updateConnection） |

后端文件：**零改动**。

---

## 验收标准

- [ ] 用户输入 `https://api.deepseek.com`（无 `/v1`），系统自动探测并存储 `https://api.deepseek.com/v1`
- [ ] 用户输入 `https://api.deepseek.com/v1`（有路径），系统直接使用，不生成候选列表
- [ ] 探测进行中，按钮显示当前正在探测的 URL
- [ ] 全部候选失败时，仍可添加连接，显示警告提示
- [ ] 关闭 Modal 时，正在进行的探测请求被 abort，无 React 状态更新警告
- [ ] 连接列表每行有「测试」按钮
- [ ] 点击测试：loading → 成功（绿色图标）或失败（红色图标）→ 3 秒后恢复
- [ ] 测试成功后，连接的 `status` 更新为 `connected`
- [ ] `updateConnection` 对已删除连接的 id 静默忽略
- [ ] TypeScript 编译无报错

---

## 参考资料

- Brainstorm: `docs/brainstorms/2026-03-19-connection-reliability-system-brainstorm.md`
- 现有 sniff 端点: `server/app.ts:179`
- 现有 handleAdd: `src/components/ai-settings-modal.tsx:82`
- 现有 Connection interface: `src/canvas/lib/ai-config-store.ts:8`
- SSRF 防护（已有，后端零改动）: `server/app.ts:35-61`
