// src/canvas/lib/ai-config-store.ts
import { create } from 'zustand'
import { MockAIClient } from './mock-ai'
import { ProxyAIClient } from './proxy-ai-client'
import type { AIClient } from '../types'

// Connection 模型：按连接 ID 管理 AI 配置
export interface Connection {
  id: string                        // uuid
  name: string                      // 自动从域名提取，用户可改
  baseURL: string                   // 含 /v1
  apiKey: string
  model: string                     // 用户指定的实际使用模型
  format: 'openai' | 'anthropic'   // 自动嗅探结果
  status: 'connected' | 'idle' | 'error'  // 运行时状态，加载时重置为 'idle'
}

export type ProviderPreset = 'deepseek' | 'kimi' | 'kimi-coding' | 'qwen' | 'anthropic' | 'custom'

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
  deepseek: { label: 'DeepSeek', baseURL: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  kimi: { label: 'Kimi（月之暗面）', baseURL: 'https://api.moonshot.cn/v1', model: 'kimi-latest' },
  'kimi-coding': { label: 'Kimi for Coding（Anthropic 格式）', baseURL: 'https://api.kimi.com/coding/v1', model: 'kimi-k2-5' },
  qwen: { label: '阿里云百炼', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  anthropic: { label: 'Anthropic / CCSwitch 中转', baseURL: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-6' },
  custom: { label: '自定义中转', baseURL: '', model: 'claude-sonnet-4-6' },
}

// 各供应商官方文档确认的可用模型
export const PROVIDER_MODELS: Record<ProviderPreset, ModelOption[]> = {
  deepseek: [
    { id: 'deepseek-chat', label: 'DeepSeek V3（推荐）' },
    { id: 'deepseek-reasoner', label: 'DeepSeek R1（推理）' },
  ],
  kimi: [
    { id: 'kimi-latest', label: 'Kimi 最新版（推荐）' },
    { id: 'moonshot-v1-128k', label: 'Moonshot 128K' },
    { id: 'moonshot-v1-32k', label: 'Moonshot 32K' },
    { id: 'moonshot-v1-8k', label: 'Moonshot 8K' },
  ],
  'kimi-coding': [
    { id: 'kimi-k2-5', label: 'Kimi K2.5（推荐）' },
    { id: 'kimi-for-coding', label: 'Kimi for Coding' },
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
  custom: [
    // Claude 系列
    { id: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
    // GPT / OpenAI 系列
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { id: 'o3', label: 'o3' },
    { id: 'o4-mini', label: 'o4-mini' },
    // Gemini 系列
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    // DeepSeek 系列
    { id: 'deepseek-chat', label: 'DeepSeek V3' },
    { id: 'deepseek-reasoner', label: 'DeepSeek R1' },
    // Kimi / Moonshot 系列
    { id: 'kimi-latest', label: 'Kimi 最新版' },
    { id: 'moonshot-v1-128k', label: 'Moonshot 128K' },
    // 通义千问系列
    { id: 'qwen-max', label: 'Qwen Max' },
    { id: 'qwen-plus', label: 'Qwen Plus' },
    // GLM 系列
    { id: 'glm-4-plus', label: 'GLM-4 Plus' },
    { id: 'glm-4-flash', label: 'GLM-4 Flash' },
    // MiniMax 系列
    { id: 'MiniMax-Text-01', label: 'MiniMax Text 01' },
    { id: 'abab6.5s-chat', label: 'MiniMax abab6.5s' },
  ],
}

const STORAGE_KEY_CONNECTIONS = 'ai_connections'
const STORAGE_KEY_ACTIVE_ID = 'ai_active_connection_id'

const STORAGE_KEY_CONFIGS = 'ai_configs'
const STORAGE_KEY_ACTIVE = 'ai_active_provider'
const LEGACY_KEY = 'ai_config'  // 旧格式，用于迁移

export function extractName(baseURL: string): string {
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

export function buildClient(config: AIConfig | null): AIClient {
  if (!config || !config.apiKey) return new MockAIClient()
  const format: 'openai' | 'anthropic' =
    (config.provider === 'anthropic' || config.provider === 'kimi-coding') ? 'anthropic' : 'openai'
  return new ProxyAIClient({ format, baseURL: config.baseURL, apiKey: config.apiKey, model: config.model })
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
    // 校验 activeProvider 是否仍在有效列表，防止旧值（如已删除的 provider）导致崩溃
    const validProviders = Object.keys(PROVIDER_PRESETS) as ProviderPreset[]
    const activeProvider = validProviders.includes(rawActive as ProviderPreset)
      ? (rawActive as ProviderPreset)
      : 'deepseek'
    if (rawActive && !validProviders.includes(rawActive as ProviderPreset)) {
      localStorage.setItem(STORAGE_KEY_ACTIVE, 'deepseek')
      if (import.meta.env.DEV) console.info('[ai-config] 已重置无效的 activeProvider:', rawActive)
    }
    return { configs, activeProvider }
  } catch {
    return { configs: {}, activeProvider: 'deepseek' }
  }
}

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

interface AIConnectionStore {
  connections: Connection[]
  activeId: string
  client: AIClient
  addConnection: (conn: Connection) => void
  removeConnection: (id: string) => void
  setActiveId: (id: string) => void
  updateConnectionStatus: (id: string, status: Connection['status']) => void
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

function buildClientFromConnection(conn: Connection | undefined): AIClient {
  if (!conn || !conn.apiKey) return new MockAIClient()
  return new ProxyAIClient({ format: conn.format, baseURL: conn.baseURL, apiKey: conn.apiKey, model: conn.model })
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

const { connections: initConnections, activeId: initActiveId } = (() => {
  const loaded = loadConnections()
  // 如果没有任何连接，尝试从环境变量创建初始连接
  if (loaded.connections.length === 0) {
    const aiKey = import.meta.env.VITE_AI_API_KEY as string | undefined
    const aiURL = import.meta.env.VITE_AI_BASE_URL as string | undefined
    const aiModel = (import.meta.env.VITE_AI_MODEL as string | undefined) ?? 'deepseek-chat'
    if (aiKey && aiURL) {
      const conn: Connection = {
        id: crypto.randomUUID(),
        name: extractName(aiURL),
        baseURL: aiURL,
        apiKey: aiKey,
        model: aiModel,
        format: 'openai',
        status: 'idle',
      }
      return { connections: [conn], activeId: conn.id }
    }
    const anthKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
    if (anthKey) {
      const conn: Connection = {
        id: crypto.randomUUID(),
        name: 'Anthropic',
        baseURL: 'https://api.anthropic.com/v1',
        apiKey: anthKey,
        model: 'claude-sonnet-4-6',
        format: 'anthropic',
        status: 'idle',
      }
      return { connections: [conn], activeId: conn.id }
    }
  }
  return loaded
})()

export const useAIConnectionStore = create<AIConnectionStore>((set, get) => ({
  connections: initConnections,
  activeId: initActiveId,
  client: buildClientFromConnection(initConnections.find(c => c.id === initActiveId)),

  addConnection: (conn) => {
    const newConnections = [...get().connections, conn]
    localStorage.setItem(STORAGE_KEY_CONNECTIONS, JSON.stringify(newConnections))
    localStorage.setItem(STORAGE_KEY_ACTIVE_ID, conn.id)
    set({
      connections: newConnections,
      activeId: conn.id,
      client: buildClientFromConnection(conn),
    })
  },

  removeConnection: (id) => {
    const newConnections = get().connections.filter(c => c.id !== id)
    localStorage.setItem(STORAGE_KEY_CONNECTIONS, JSON.stringify(newConnections))
    const newActiveId = get().activeId === id ? (newConnections[0]?.id ?? '') : get().activeId
    if (newActiveId !== get().activeId) {
      localStorage.setItem(STORAGE_KEY_ACTIVE_ID, newActiveId)
    }
    set({
      connections: newConnections,
      activeId: newActiveId,
      client: buildClientFromConnection(newConnections.find(c => c.id === newActiveId)),
    })
  },

  setActiveId: (id) => {
    localStorage.setItem(STORAGE_KEY_ACTIVE_ID, id)
    const conn = get().connections.find(c => c.id === id)
    set({ activeId: id, client: buildClientFromConnection(conn) })
  },

  updateConnectionStatus: (id, status) => {
    set({
      connections: get().connections.map(c => c.id === id ? { ...c, status } : c),
    })
  },
}))
