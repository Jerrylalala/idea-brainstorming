// src/canvas/lib/ai-config-store.ts
import { create } from 'zustand'
import { MockAIClient } from './mock-ai'
import { AnthropicCompatibleClient } from './real-ai-client'
import { OpenAICompatibleClient } from './openai-compatible-client'
import type { AIClient } from '../types'

export type ProviderPreset = 'deepseek' | 'deepseek-anthropic' | 'kimi' | 'qwen' | 'anthropic' | 'custom'

// Per-provider 配置（key 就是 provider，无需重复存）
export interface ProviderConfig {
  apiKey: string
  model: string
  baseURL?: string  // 用户自定义 baseURL，覆盖 preset 默认值（所有 provider 均支持）
}

// Legacy type，buildClient 函数使用
export interface AIConfig {
  provider: ProviderPreset
  baseURL: string
  apiKey: string
  model: string
}

export interface ModelOption {
  id: string
  label: string
}

export const PROVIDER_PRESETS: Record<ProviderPreset, { label: string; baseURL: string; model: string }> = {
  deepseek: { label: 'DeepSeek (OpenAI 兼容)', baseURL: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  'deepseek-anthropic': { label: 'DeepSeek (Anthropic 格式)', baseURL: 'https://api.deepseek.com/anthropic', model: 'DeepSeek-V3.2' },
  kimi: { label: 'Kimi（月之暗面）', baseURL: 'https://api.moonshot.cn/v1', model: 'kimi-latest' },
  qwen: { label: '阿里云百炼', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  anthropic: { label: 'Anthropic / CCSwitch 中转', baseURL: 'https://api.anthropic.com', model: 'claude-sonnet-4-6' },
  custom: { label: '自定义中转', baseURL: '', model: '' },
}

// 各供应商官方文档确认的可用模型
export const PROVIDER_MODELS: Record<ProviderPreset, ModelOption[]> = {
  deepseek: [
    { id: 'deepseek-chat', label: 'DeepSeek V3（推荐）' },
    { id: 'deepseek-reasoner', label: 'DeepSeek R1（推理）' },
  ],
  'deepseek-anthropic': [
    { id: 'DeepSeek-V3.2', label: 'DeepSeek V3.2（推荐）' },
  ],
  kimi: [
    { id: 'kimi-latest', label: 'Kimi 最新版（推荐）' },
    { id: 'moonshot-v1-128k', label: 'Moonshot 128K' },
    { id: 'moonshot-v1-32k', label: 'Moonshot 32K' },
    { id: 'moonshot-v1-8k', label: 'Moonshot 8K' },
  ],
  qwen: [
    { id: 'qwen-max', label: 'Qwen Max（最强）' },
    { id: 'qwen-plus', label: 'Qwen Plus（推荐）' },
    { id: 'qwen-turbo', label: 'Qwen Turbo（快速）' },
  ],
  anthropic: [
    { id: 'claude-opus-4-6', label: 'Claude Opus 4.6（最强）' },
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6（推荐）' },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5（快速）' },
  ],
  custom: [],
}

const ANTHROPIC_FORMAT_PROVIDERS: ProviderPreset[] = ['anthropic', 'deepseek-anthropic']

const STORAGE_KEY_CONFIGS = 'ai_configs'
const STORAGE_KEY_ACTIVE = 'ai_active_provider'
const LEGACY_KEY = 'ai_config'  // 旧格式，用于迁移

export function buildClient(config: AIConfig | null): AIClient {
  if (!config || !config.apiKey) return new MockAIClient()
  if (ANTHROPIC_FORMAT_PROVIDERS.includes(config.provider)) {
    return new AnthropicCompatibleClient(config.apiKey, config.model, config.baseURL || undefined)
  }
  return new OpenAICompatibleClient(config.apiKey, config.baseURL, config.model)
}

function toAIConfig(provider: ProviderPreset, cfg: ProviderConfig): AIConfig {
  return {
    provider,
    baseURL: cfg.baseURL ?? PROVIDER_PRESETS[provider].baseURL,
    apiKey: cfg.apiKey,
    model: cfg.model,
  }
}

type ConfigsMap = Partial<Record<ProviderPreset, ProviderConfig>>

function loadConfigs(): { configs: ConfigsMap; activeProvider: ProviderPreset } {
  try {
    // 迁移旧格式：检测到 ai_config 就迁移
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy) {
      const old = JSON.parse(legacy) as AIConfig
      const configs: ConfigsMap = {
        [old.provider]: { apiKey: old.apiKey, model: old.model, ...(old.provider === 'custom' ? { baseURL: old.baseURL } : {}) },
      }
      localStorage.setItem(STORAGE_KEY_CONFIGS, JSON.stringify(configs))
      localStorage.setItem(STORAGE_KEY_ACTIVE, old.provider)
      localStorage.removeItem(LEGACY_KEY)
      if (import.meta.env.DEV) console.info('[ai-config] 已自动迁移旧格式')
      return { configs, activeProvider: old.provider }
    }

    const rawConfigs = localStorage.getItem(STORAGE_KEY_CONFIGS)
    const rawActive = localStorage.getItem(STORAGE_KEY_ACTIVE)
    const configs = rawConfigs ? (JSON.parse(rawConfigs) as ConfigsMap) : {}
    const activeProvider = (rawActive as ProviderPreset | null) ?? 'deepseek'
    return { configs, activeProvider }
  } catch {
    return { configs: {}, activeProvider: 'deepseek' }
  }
}

function loadFromEnv(): { configs: ConfigsMap; activeProvider: ProviderPreset } | null {
  const aiKey = import.meta.env.VITE_AI_API_KEY as string | undefined
  const aiURL = import.meta.env.VITE_AI_BASE_URL as string | undefined
  const aiModel = (import.meta.env.VITE_AI_MODEL as string | undefined) ?? 'deepseek-chat'
  if (aiKey && aiURL) {
    return { configs: { custom: { apiKey: aiKey, model: aiModel, baseURL: aiURL } }, activeProvider: 'custom' }
  }
  const anthKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
  if (anthKey) {
    return { configs: { anthropic: { apiKey: anthKey, model: 'claude-sonnet-4-6' } }, activeProvider: 'anthropic' }
  }
  return null
}

interface AIConfigStore {
  configs: ConfigsMap
  activeProvider: ProviderPreset
  client: AIClient
  updateProviderConfig: (provider: ProviderPreset, config: ProviderConfig) => void
  setActiveProvider: (provider: ProviderPreset) => void
  clearProviderConfig: (provider: ProviderPreset) => void
}

const { configs: initConfigs, activeProvider: initActive } = loadConfigs()
const envFallback = Object.keys(initConfigs).length === 0 ? loadFromEnv() : null
const startConfigs = envFallback?.configs ?? initConfigs
const startActive = envFallback?.activeProvider ?? initActive

function buildActiveClient(configs: ConfigsMap, provider: ProviderPreset): AIClient {
  const cfg = configs[provider]
  if (!cfg) return new MockAIClient()
  return buildClient(toAIConfig(provider, cfg))
}

export const useAIConfigStore = create<AIConfigStore>((set, get) => ({
  configs: startConfigs,
  activeProvider: startActive,
  client: buildActiveClient(startConfigs, startActive),

  updateProviderConfig: (provider, config) => {
    const newConfigs = { ...get().configs, [provider]: config }
    localStorage.setItem(STORAGE_KEY_CONFIGS, JSON.stringify(newConfigs))
    localStorage.setItem(STORAGE_KEY_ACTIVE, provider)
    set({
      configs: newConfigs,
      activeProvider: provider,
      client: buildClient(toAIConfig(provider, config)),
    })
  },

  setActiveProvider: (provider) => {
    localStorage.setItem(STORAGE_KEY_ACTIVE, provider)
    const cfg = get().configs[provider]
    set({
      activeProvider: provider,
      client: cfg ? buildClient(toAIConfig(provider, cfg)) : new MockAIClient(),
    })
  },

  clearProviderConfig: (provider) => {
    const newConfigs = { ...get().configs }
    delete newConfigs[provider]
    localStorage.setItem(STORAGE_KEY_CONFIGS, JSON.stringify(newConfigs))
    // 清除后重置 activeProvider 到 deepseek（默认），避免 UI 显示已清除的 provider 为激活状态
    const fallback: ProviderPreset = 'deepseek'
    localStorage.setItem(STORAGE_KEY_ACTIVE, fallback)
    set({ configs: newConfigs, activeProvider: fallback, client: new MockAIClient() })
  },
}))
