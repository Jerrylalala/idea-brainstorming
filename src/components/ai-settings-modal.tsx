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
