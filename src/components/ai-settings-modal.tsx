// src/components/ai-settings-modal.tsx
import { useState } from 'react'
import { X, CheckCircle2, AlertCircle, Loader2, Eye, EyeOff, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@/store/ui-store'
import { useAIConnectionStore, type Connection } from '@/canvas/lib/ai-config-store'
import { cn } from '@/lib/utils'

// 从 baseURL 提取显示名称（模块级，供表单和迁移共用）
export function extractName(baseURL: string): string {
  try {
    const parts = new URL(baseURL).hostname.split('.')
    const raw = parts.length >= 2 ? parts[parts.length - 2] : parts[0]
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  } catch {
    return 'Custom'
  }
}

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
  if (!pathname.endsWith('/v1') && !pathname.includes('/v1/')) return { valid: true, warning: '路径通常以 /v1 结尾，请确认' }
  return { valid: true }
}

// 连接列表视图
function ConnectionList({ onAdd }: { onAdd: () => void }) {
  const { connections, activeId, setActiveId, removeConnection } = useAIConnectionStore()

  return (
    <div className="space-y-2">
      {connections.length === 0 && (
        <p className="py-4 text-center text-sm text-slate-400">暂无连接，点击下方添加</p>
      )}
      {connections.map(conn => (
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
      ))}
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

  const urlValidation = validateBaseURL(baseURL)
  const canAdd = urlValidation.valid && !!apiKey && !!model && sniffStatus !== 'sniffing'

  async function handleAdd() {
    if (!canAdd) return
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
        name: name.trim() || extractName(baseURL),
        baseURL,
        apiKey,
        model,
        format: data.format as 'openai' | 'anthropic',
        status: 'connected',
      }
      addConnection(conn)
      setSniffStatus('ok')
      setSniffMsg(`已添加「${conn.name}」（${conn.format === 'openai' ? 'OpenAI 格式' : 'Anthropic 格式'}）`)
      setTimeout(onBack, 1200)
    } catch (e) {
      setSniffStatus('error')
      setSniffMsg(e instanceof Error ? e.message : '添加失败')
    }
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
        {sniffStatus === 'sniffing' ? '正在嗅探格式...' : '添加连接'}
      </Button>
      <p className="text-xs text-slate-400">点击「添加连接」将自动检测 API 格式（OpenAI / Anthropic），约需 3-10 秒</p>
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
