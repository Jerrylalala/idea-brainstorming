// src/components/ai-settings-modal.tsx — 完整替换
import { useState } from 'react'
import { X, CheckCircle2, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react'
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
  const [showApiKey, setShowApiKey] = useState(false)

  if (!settingsOpen) return null

  const isCustom = provider === 'custom'

  function handleProviderChange(p: ProviderPreset) {
    setProvider(p)
    const existing = configs[p]
    setApiKey(existing?.apiKey ?? '')
    // 优先用已保存的 baseURL，否则用 preset 默认值
    setBaseURL(existing?.baseURL ?? PROVIDER_PRESETS[p].baseURL)
    setModel(existing?.model ?? PROVIDER_PRESETS[p].model)
    setTestStatus('idle')
    setTestMsg('')
    setShowApiKey(false)
  }

  function isSecureURL(url: string): boolean {
    if (!url) return true
    try {
      const { protocol, hostname } = new URL(url)
      if (protocol === 'https:') return true
      // 允许本地开发代理使用 HTTP
      return protocol === 'http:' && (hostname === 'localhost' || hostname === '127.0.0.1')
    } catch {
      return false
    }
  }

  async function handleTest() {
    if (!apiKey) return
    if (!isSecureURL(baseURL)) {
      setTestStatus('error')
      setTestMsg('Base URL 必须使用 HTTPS（本地地址除外）')
      return
    }
    setTestStatus('loading')
    setTestMsg('')

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const gen = buildClient({ provider, baseURL, apiKey, model }).streamChat(
      { messages: [{ id: 'test', role: 'user', text: 'Hi', createdAt: Date.now() }], sourceRefs: [] },
      controller.signal,
    )
    try {
      const first = await Promise.race([
        gen.next(),
        new Promise<never>((_, reject) =>
          controller.signal.addEventListener('abort', () =>
            reject(new Error('连接超时，请检查网络或 URL'))
          )
        ),
      ])
      if (first.value?.type === 'error') {
        throw new Error(first.value.error)
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

  function handleSave() {
    if (!isSecureURL(baseURL)) return  // HTTPS 校验（UI 层已有提示）
    const cfg: ProviderConfig = {
      apiKey,
      model,
      baseURL,  // 始终保存，toAIConfig 会优先使用此值
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

          {/* Base URL — 所有 provider 均可编辑 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Base URL</label>
            <input
              type="text"
              value={baseURL}
              onChange={(e) => setBaseURL(e.target.value)}
              placeholder="https://api.example.com/v1"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
            <p className="mt-1 text-xs text-slate-400">默认值来自预设，可修改为官网实际地址</p>
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
            <Button size="sm" onClick={handleSave} disabled={!apiKey || (!isCustom ? false : !baseURL) || !model || !isSecureURL(baseURL)} className="h-8 rounded-lg">
              保存
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
