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
