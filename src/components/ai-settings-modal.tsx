// src/components/ai-settings-modal.tsx
import { useState, useRef, useEffect } from 'react'
import { X, CheckCircle2, AlertCircle, Loader2, Eye, EyeOff, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@/store/ui-store'
import { useAIConnectionStore, type Connection, extractName } from '@/canvas/lib/ai-config-store'
import { cn } from '@/lib/utils'

// URL 校验（内联，不新建文件）
function validateBaseURL(url: string): { valid: boolean; warning?: string; error?: string } {
  if (!url) return { valid: false, error: '请填写 Base URL' }
  let parsed: URL
  try { parsed = new URL(url) } catch { return { valid: false, error: '不是合法的 URL 格式' } }
  const { protocol, hostname, pathname } = parsed
  if (protocol !== 'https:' && !(protocol === 'http:' && (hostname === 'localhost' || hostname === '127.0.0.1'))) {
    return { valid: false, error: '必须使用 HTTPS（本地地址除外）' }
  }
  if (pathname.endsWith('/')) return { valid: true, warning: '建议去掉末尾斜杠' }
  if (!pathname.endsWith('/v1') && !pathname.includes('/v1/')) return { valid: true, warning: '未检测到 /v1 路径，将自动尝试多个路径' }
  return { valid: true }
}

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

// 连接列表视图
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
        updateConnection(conn.id, { status: 'connected', format: data.format as 'openai' | 'anthropic' })
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

// 添加连接表单
function AddConnectionForm({ onBack }: { onBack: () => void }) {
  const { addConnection } = useAIConnectionStore()
  const [baseURL, setBaseURL] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [name, setName] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [sniffStatus, setSniffStatus] = useState<'idle' | 'sniffing' | 'ok' | 'error'>('idle')
  const [sniffMsg, setSniffMsg] = useState('')
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => { abortControllerRef.current?.abort() }
  }, [])

  const urlValidation = validateBaseURL(baseURL)
  const canAdd = urlValidation.valid && !!apiKey && !!model && sniffStatus !== 'sniffing'

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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-sm text-slate-400 hover:text-slate-600">← 返回</button>
        <h3 className="text-sm font-medium text-slate-700">添加新连接</h3>
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
        {baseURL && urlValidation.error && (
          <p className="mt-1 text-xs text-red-500">{urlValidation.error}</p>
        )}
        {baseURL && urlValidation.warning && (
          <p className="mt-1 text-xs text-amber-500">{urlValidation.warning}</p>
        )}
      </div>

      {/* API Key */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">API Key</label>
        <div className="relative">
          <input
            type={showApiKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-xxxxxxxxxxxxxxxx"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 pr-9 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
          <button
            type="button"
            onClick={() => setShowApiKey(!showApiKey)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Model */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">模型 ID</label>
        <input
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="如 deepseek-chat、kimi-k2-5、claude-sonnet-4-6"
          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
      </div>

      {/* 连接名称（可选） */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          连接名称 <span className="font-normal text-slate-400">（可选，留空自动提取）</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={baseURL ? extractName(baseURL) : '自动从域名提取'}
          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
      </div>

      {/* 状态反馈 */}
      {sniffStatus === 'ok' && (
        <div className="flex items-center gap-1.5 text-sm text-emerald-600">
          <CheckCircle2 className="h-4 w-4" /> {sniffMsg}
        </div>
      )}
      {sniffStatus === 'error' && (
        <div className="flex items-center gap-1.5 text-sm text-red-500">
          <AlertCircle className="h-4 w-4" /> {sniffMsg}
        </div>
      )}

      {/* 添加按钮 */}
      <Button
        size="sm"
        onClick={handleAdd}
        disabled={!canAdd}
        className="h-8 w-full rounded-lg"
      >
        {sniffStatus === 'sniffing' && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
        {sniffStatus === 'sniffing' ? (sniffMsg || '正在探测...') : '添加连接'}
      </Button>
      <p className="text-xs text-slate-400">将自动尝试多个路径（/v1、/api 等），找到可用的为止</p>
    </div>
  )
}

// 主弹窗
export function AISettingsModal() {
  const settingsOpen = useUIStore((s) => s.settingsOpen)
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)
  const [view, setView] = useState<'list' | 'add'>('list')

  if (!settingsOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[480px] rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">我的 AI 连接</h2>
          <button onClick={() => setSettingsOpen(false)} className="rounded-lg p-1 hover:bg-slate-100">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        {view === 'list'
          ? <ConnectionList onAdd={() => setView('add')} />
          : <AddConnectionForm onBack={() => setView('list')} />
        }
      </div>
    </div>
  )
}
