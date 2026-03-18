import { create } from 'zustand'
import { MockAIClient } from './mock-ai'
import { AnthropicAIClient } from './real-ai-client'
import { OpenAICompatibleClient } from './openai-compatible-client'
import type { AIClient } from '../types'

export type ProviderPreset = 'deepseek' | 'deepseek-anthropic' | 'kimi' | 'qwen' | 'anthropic' | 'custom'

export interface AIConfig {
  provider: ProviderPreset
  baseURL: string
  apiKey: string
  model: string
}

export const PROVIDER_PRESETS: Record<ProviderPreset, { label: string; baseURL: string; model: string }> = {
  deepseek: { label: 'DeepSeek (OpenAI 兼容)', baseURL: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  // DeepSeek 同时支持 Anthropic Messages 格式，CCSwitch 等工具使用此格式
  'deepseek-anthropic': { label: 'DeepSeek (Anthropic 格式)', baseURL: 'https://api.deepseek.com/anthropic', model: 'DeepSeek-V3.2' },
  kimi: { label: 'Kimi（月之暗面）', baseURL: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  qwen: { label: '阿里云百炼', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  anthropic: { label: 'Anthropic / CCSwitch 中转', baseURL: 'https://api.anthropic.com', model: 'claude-sonnet-4-6' },
  custom: { label: '自定义中转', baseURL: '', model: '' },
}

// 使用 Anthropic SDK（Messages 格式）的 provider 列表
const ANTHROPIC_FORMAT_PROVIDERS: ProviderPreset[] = ['anthropic', 'deepseek-anthropic']

const STORAGE_KEY = 'ai_config'

// 已知取舍：apiKey 明文存储在 localStorage，此应用定位为本地个人工具
// 如需公网部署，改为只持久化非敏感字段（provider/baseURL/model），apiKey 仅保留在内存
export function buildClient(config: AIConfig | null): AIClient {
  if (!config || !config.apiKey) return new MockAIClient()
  if (ANTHROPIC_FORMAT_PROVIDERS.includes(config.provider)) {
    return new AnthropicAIClient(config.apiKey, config.model, config.baseURL || undefined)
  }
  return new OpenAICompatibleClient(config.apiKey, config.baseURL, config.model)
}

function loadFromStorage(): AIConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AIConfig) : null
  } catch {
    if (import.meta.env.DEV) console.warn('[ai-config] localStorage 解析失败，使用环境变量兜底')
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
