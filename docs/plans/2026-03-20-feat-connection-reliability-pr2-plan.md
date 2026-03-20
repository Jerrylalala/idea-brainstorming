---
title: "feat: AI 连接可靠性 PR2 — 懒检查 + 错误记忆 + 模型列表"
type: feat
date: 2026-03-20
risk_score: 3
risk_level: low
risk_note: "纯前端+轻量后端改动；新字段可逆；/api/models 经 isAllowedBaseURL 保护；无新外部依赖"
---

# feat: AI 连接可靠性 PR2 — 懒检查 + 错误记忆 + 模型列表

## Overview

**Goal**: 在 PR1（智能URL探测+测试按钮）基础上，补全连接生命周期管理：页面加载时后台静默验证超期连接；持久化错误信息帮助用户诊断；模型输入框支持下拉选择。
**Tech Stack**: React + Zustand + TypeScript（前端），Hono（后端），HTML `<datalist>`（combobox，零新依赖）
**Architecture**: 三个独立改动——Store 扩展（懒检查+错误记忆）、后端新路由（/api/models）、UI 增强（lastError显示+模型combobox）

---

## 背景

（see brainstorm: docs/brainstorms/2026-03-19-connection-reliability-system-brainstorm.md）

PR1 已解决「添加时URL错误」和「无法主动测试」问题。PR2 解决：
- 连接可能在用户不知情的情况下失效（API Key 过期、服务商改 URL）
- 刷新页面后 `status` 重置为 `idle`，用户不知道上次失败原因
- 模型名需要手动输入，容易拼错

---

## 功能 1：懒检查（lastVerifiedAt）

### 设计决策

- **触发时机**：store 模块加载时（`loadConnections()` 返回后立即执行），非 modal 打开时
- **阈值**：24h（`Date.now() - lastVerifiedAt > 24 * 60 * 60 * 1000`）
- **未验证过**：`lastVerifiedAt === undefined` → 触发检查
- **检查方式**：复用 `/api/sniff`，调用 `updateConnection`（PR1 已有）
- **失败时**：更新 `status: 'error'`、写 `lastError`、同时更新 `lastVerifiedAt = Date.now()`（避免每次加载都重试）
- **连接被删**：`updateConnection` 对不存在 id 静默忽略（PR1 已有此逻辑）
- **多连接并行**：`Promise.allSettled`，各自独立

---

## 功能 2：错误记忆（lastError + lastErrorAt）

### 设计决策

- Connection 新增持久化字段：`lastError?: string`、`lastErrorAt?: number`
- 触发写入时机：`/api/sniff` 失败（懒检查或手动测试按钮）
- 错误信息来源：`sanitizeSniffError` 输出（已有，后端脱敏）
- 成功时：清除 `lastError`（设为 `undefined`）
- 存储：`saveConnections` 目前只剥离 `status`，新字段直接持久化（不需额外改动 saveConnections 的剥离逻辑）
- UI：`ConnectionList` 每行在连接名下方显示小字灰色 `lastError`（如有）

---

## 功能 3：模型列表（/v1/models + datalist combobox）

### 设计决策

- **后端**：新增 `POST /api/models`，接收 `{baseURL, apiKey}`，向 `GET {baseURL}/models` 发请求，返回模型 id 列表
- **安全**：同 `/api/sniff`，先调 `isAllowedBaseURL`（SSRF 保护）
- **前端**：sniff 成功后立即调 `/api/models` 拉取列表（store 内存，不持久化）
- **UI**：模型输入框改为 `<input list="model-list">` + `<datalist>`，允许自由输入（原生降级）
- **失败降级**：`/api/models` 失败不影响主流程，仅显示空 datalist（退回纯文本输入）

---

## 受影响文件

| 文件 | 改动类型 |
|------|---------|
| `src/canvas/lib/ai-config-store.ts` | 修改（新字段+懒检查） |
| `src/components/ai-settings-modal.tsx` | 修改（lastError显示+combobox） |
| `server/app.ts` | 修改（新增 /api/models 路由） |

---

## 任务拆解

### Task 1: 扩展 Connection interface，新增三个可选字段

**文件**: `src/canvas/lib/ai-config-store.ts:8`

**操作**:
- [x] 在 `Connection` interface 中新增三个可选字段

**代码**:

将现有 `Connection` interface 修改为：
```typescript
export interface Connection {
  id: string
  name: string
  baseURL: string
  apiKey: string
  model: string
  format: 'openai' | 'anthropic'
  status: 'connected' | 'idle' | 'error'  // 运行时状态，不持久化
  lastVerifiedAt?: number   // 上次验证成功时间戳（ms），持久化
  lastError?: string        // 上次失败脱敏消息，持久化
  lastErrorAt?: number      // 上次失败时间戳（ms），持久化
}
```

同时更新 `saveConnections` 的剥离逻辑（只剥 status，新字段保留）：
```typescript
// 原来：
const toStore = connections.map(({ status: _status, ...rest }) => rest)
// 不需要改！原有逻辑只剥 status，新字段本身就会持久化 ✓
```

`isValidConnection` 类型守卫中新字段均为 optional，无需额外检查。

**验证**:
- [x] `pnpm tsc --noEmit` 无报错

---

### Task 2: 扩展 updateConnection 支持新字段，并在 AIConnectionStore interface 中更新签名

**文件**: `src/canvas/lib/ai-config-store.ts:180`

**操作**:
- [x] 更新 `AIConnectionStore` interface 中 `updateConnection` 的 partial 类型
- [x] 实现体不需要改（`{ ...c, ...partial }` 已支持任意字段扩展）

**代码**:

将 interface 中的签名从：
```typescript
updateConnection: (id: string, partial: Partial<Pick<Connection, 'baseURL' | 'format' | 'status'>>) => void
```
改为：
```typescript
updateConnection: (id: string, partial: Partial<Pick<Connection, 'baseURL' | 'format' | 'status' | 'lastVerifiedAt' | 'lastError' | 'lastErrorAt'>>) => void
```

**验证**:
- [x] `pnpm tsc --noEmit` 无报错

---

### Task 3: 在 store 初始化时触发懒检查

**文件**: `src/canvas/lib/ai-config-store.ts`（文件末尾，`export const useAIConnectionStore` 之后）

**操作**:
- [x] 在 store 定义后，module 级别添加懒检查触发逻辑

**代码**:

在文件末尾（`export const useAIConnectionStore = create<AIConnectionStore>(...)` 之后）添加：

```typescript
// 懒检查：store 加载时后台静默验证超期连接（24h）
const LAZY_CHECK_INTERVAL = 24 * 60 * 60 * 1000

function runLazyCheck() {
  const { connections } = useAIConnectionStore.getState()
  const stale = connections.filter(c => {
    if (!c.apiKey) return false
    return c.lastVerifiedAt === undefined || Date.now() - c.lastVerifiedAt > LAZY_CHECK_INTERVAL
  })
  if (stale.length === 0) return

  Promise.allSettled(
    stale.map(async (conn) => {
      try {
        const res = await fetch('/api/sniff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: conn.apiKey, baseURL: conn.baseURL, model: conn.model }),
        })
        const data = await res.json() as { format?: string; error?: string }
        if (res.ok && !data.error && data.format) {
          useAIConnectionStore.getState().updateConnection(conn.id, {
            status: 'connected',
            format: data.format as 'openai' | 'anthropic',
            lastVerifiedAt: Date.now(),
            lastError: undefined,
            lastErrorAt: undefined,
          })
        } else {
          const errMsg = data.error ?? '连接验证失败'
          useAIConnectionStore.getState().updateConnection(conn.id, {
            status: 'error',
            lastVerifiedAt: Date.now(),  // 避免每次加载都重试
            lastError: errMsg,
            lastErrorAt: Date.now(),
          })
        }
      } catch {
        useAIConnectionStore.getState().updateConnection(conn.id, {
          status: 'error',
          lastVerifiedAt: Date.now(),
          lastError: '无法连接到 AI 服务，请检查网络和 URL',
          lastErrorAt: Date.now(),
        })
      }
    })
  )
}

// 延迟 1 秒启动，避免阻塞首屏渲染
setTimeout(runLazyCheck, 1000)
```

**验证**:
- [x] `pnpm tsc --noEmit` 无报错

---

### Task 4: 手动测试按钮成功时清除 lastError，失败时写入 lastError

**文件**: `src/components/ai-settings-modal.tsx:40`（`handleTest` 函数）

**操作**:
- [x] 在 `handleTest` 成功分支补充清除 `lastError`
- [x] 在 `handleTest` 失败分支补充写入 `lastError`

**代码**:

将现有 `handleTest` 函数替换为：
```typescript
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
        lastVerifiedAt: Date.now(),
        lastError: undefined,
        lastErrorAt: undefined,
      })
      setTestStates(s => ({ ...s, [conn.id]: 'ok' }))
    } else {
      const errMsg = data.error ?? '连接验证失败'
      updateConnection(conn.id, {
        status: 'error',
        lastVerifiedAt: Date.now(),
        lastError: errMsg,
        lastErrorAt: Date.now(),
      })
      setTestStates(s => ({ ...s, [conn.id]: 'error' }))
    }
  } catch {
    updateConnection(conn.id, {
      status: 'error',
      lastVerifiedAt: Date.now(),
      lastError: '无法连接到 AI 服务，请检查网络和 URL',
      lastErrorAt: Date.now(),
    })
    setTestStates(s => ({ ...s, [conn.id]: 'error' }))
  }
  setTimeout(() => setTestStates(s => ({ ...s, [conn.id]: 'idle' })), 3000)
}
```

**验证**:
- [x] `pnpm tsc --noEmit` 无报错

---

### Task 5: 在 ConnectionList 行中显示 lastError

**文件**: `src/components/ai-settings-modal.tsx:77`（连接名下方）

**操作**:
- [x] 在连接名称 `<p>` 下方添加 lastError 显示

**代码**:

将现有的 `<div className="min-w-0 flex-1">` 内容替换为：
```tsx
<div className="min-w-0 flex-1">
  <p className="truncate text-sm font-medium text-slate-800">{conn.name}</p>
  <p className="truncate text-xs text-slate-400">
    {conn.baseURL} · {conn.format === 'openai' ? 'OpenAI 格式' : 'Anthropic 格式'}
  </p>
  {conn.lastError && (
    <p className="truncate text-xs text-red-400" title={conn.lastError}>
      上次失败：{conn.lastError}
    </p>
  )}
</div>
```

**验证**:
- [x] 视觉检查：有 lastError 的连接行显示红色小字

---

### Task 6: 新增 POST /api/models 后端路由

**文件**: `server/app.ts`（在 `/api/sniff` 路由之后）

**操作**:
- [x] 在 `app.post('/api/sniff', ...)` 之后添加 `/api/models` 路由

**代码**:

在 `export default app` 之前插入：

```typescript
// === POST /api/models — 拉取模型列表 ===
app.post('/api/models', async (c) => {
  const body = await c.req.json<{ apiKey: string; baseURL: string }>()

  if (!body.apiKey?.trim()) return c.json({ error: 'apiKey 不能为空' }, 400)
  if (!body.baseURL?.trim() || !isAllowedBaseURL(body.baseURL)) {
    return c.json({ error: 'Base URL 不允许（仅支持 HTTPS 公网地址）' }, 400)
  }

  try {
    const modelsURL = body.baseURL.replace(/\/$/, '') + '/models'
    const res = await fetch(modelsURL, {
      headers: { Authorization: `Bearer ${body.apiKey}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return c.json({ error: `模型列表请求失败（${res.status}）` }, 400)
    const data = await res.json() as { data?: { id: string }[] }
    const models = (data.data ?? []).map((m: { id: string }) => m.id).filter(Boolean)
    return c.json({ models })
  } catch (e) {
    console.error('[api/models]', e instanceof Error ? e.message : e)
    return c.json({ error: '无法获取模型列表' }, 400)
  }
})
```

**验证**:
- [x] `pnpm tsc --noEmit` 无报错

---

### Task 7: 替换模型输入框为 datalist combobox，并在 sniff 成功后拉取模型列表

**文件**: `src/components/ai-settings-modal.tsx:119`（`AddConnectionForm` 组件）

**操作**:
- [x] 新增 `modelOptions` state（`string[]`）和 `fetchModels` 函数
- [x] 在 `handleAdd` 的 `successURL` 分支中调用 `fetchModels`
- [x] 将模型 `<input>` 替换为 `<input list="model-datalist">` + `<datalist>`

**代码**:

在 `AddConnectionForm` 的 state 声明区域（`sniffMsg` 之后）新增：
```typescript
const [modelOptions, setModelOptions] = useState<string[]>([])

async function fetchModels(bURL: string, key: string) {
  try {
    const res = await fetch('/api/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseURL: bURL, apiKey: key }),
    })
    const data = await res.json() as { models?: string[]; error?: string }
    if (res.ok && data.models) setModelOptions(data.models)
  } catch {
    // 拉取失败静默处理，保持 datalist 为空
  }
}
```

在 `handleAdd` 函数中，`successURL` 赋值之后（即 `break` 之后的 `if (successURL && successFormat)` 成功路径），触发模型列表拉取：

在 `addConnection(conn)` 调用之前添加：
```typescript
// 后台拉取模型列表（不 await，不阻塞主流程）
fetchModels(finalURL, apiKey)
```

将模型输入 `<input>` 替换为：
```tsx
{/* Model */}
<div>
  <label className="mb-1.5 block text-sm font-medium text-slate-700">模型 ID</label>
  <input
    type="text"
    list="model-datalist"
    value={model}
    onChange={(e) => setModel(e.target.value)}
    placeholder="如 deepseek-chat、kimi-k2-5、claude-sonnet-4-6"
    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
  />
  <datalist id="model-datalist">
    {modelOptions.map(m => <option key={m} value={m} />)}
  </datalist>
</div>
```

**验证**:
- [x] `pnpm tsc --noEmit` 无报错
- [x] 视觉检查：模型输入框可自由输入，sniff 成功后有下拉选项

---

### Task 8: 端到端手动验证

**操作**:
- [ ] 启动开发服务器（`pnpm dev`）
- [ ] 测试场景 1：新建连接 → sniff 成功 → 模型列表下拉出现
- [ ] 测试场景 2：刷新页面 → 1 秒后超期连接触发懒检查（Network 面板可见 /api/sniff 请求）
- [ ] 测试场景 3：手动测试按钮失败 → 连接行显示红色错误信息 → 刷新页面仍显示
- [ ] 测试场景 4：手动测试按钮成功 → 红色错误信息消失
- [ ] 测试场景 5：`/api/models` 拉取失败 → 模型输入框退回纯文本，主流程不受影响

**验证**:
- [ ] `pnpm tsc --noEmit` 无报错
- [ ] 所有手动测试场景通过

---

## 验收标准

- [ ] Connection interface 新增 `lastVerifiedAt?`、`lastError?`、`lastErrorAt?`，持久化到 localStorage
- [ ] 页面加载 1 秒后，24h 未验证的连接自动静默触发 `/api/sniff`
- [ ] 懒检查成功：`lastVerifiedAt` 更新，`lastError` 清除，`status` → `connected`
- [ ] 懒检查失败：`lastVerifiedAt` 更新（避免循环重试），`lastError` 写入脱敏信息，`status` → `error`
- [ ] 手动测试按钮成功：同懒检查成功逻辑
- [ ] 手动测试按钮失败：同懒检查失败逻辑
- [ ] ConnectionList 每行在 URL 下方显示 `lastError`（如有，红色小字）
- [ ] `POST /api/models` 路由经 `isAllowedBaseURL` 保护，返回 `{ models: string[] }`
- [ ] sniff 成功后后台调用 `/api/models`，成功则模型 datalist 显示选项
- [ ] `/api/models` 失败不影响连接添加主流程
- [ ] `pnpm tsc --noEmit` 无报错

---

## 参考资料

- Brainstorm: `docs/brainstorms/2026-03-19-connection-reliability-system-brainstorm.md`
- PR1 plan: `docs/plans/2026-03-19-feat-connection-reliability-pr1-plan.md`
- 现有 sniff 端点: `server/app.ts:179`
- isAllowedBaseURL: `server/app.ts:48`
- sanitizeSniffError: `server/app.ts:80`
- Connection interface: `src/canvas/lib/ai-config-store.ts:8`
- updateConnection（PR1 新增）: `src/canvas/lib/ai-config-store.ts:227`
