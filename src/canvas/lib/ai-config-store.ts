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
  status: 'connected' | 'idle' | 'error'  // 运行时状态，不持久化
}

export type ProviderPreset = 'deepseek' | 'kimi' | 'kimi-coding' | 'qwen' | 'anthropic' | 'custom'

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

const STORAGE_KEY_CONNECTIONS = 'ai_connections'
const STORAGE_KEY_ACTIVE_ID = 'ai_active_connection_id'

// 旧格式 key，仅用于迁移读取
const STORAGE_KEY_CONFIGS = 'ai_configs'
const STORAGE_KEY_ACTIVE = 'ai_active_provider'
const LEGACY_KEY = 'ai_config'

// Fix 038: crypto.randomUUID 兼容性 fallback
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

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

// Fix 034: 类型守卫，过滤加载时的无效条目
function isValidConnection(obj: unknown): obj is Omit<Connection, 'status'> {
  if (!obj || typeof obj !== 'object') return false
  const c = obj as Record<string, unknown>
  return (
    typeof c.id === 'string' &&
    typeof c.name === 'string' &&
    typeof c.baseURL === 'string' &&
    typeof c.apiKey === 'string' &&
    typeof c.model === 'string' &&
    (c.format === 'openai' || c.format === 'anthropic')
  )
}

// Fix 033: saveConnections 带 try/catch，返回 boolean
// Fix 029: 序列化前剥离 status 字段
function saveConnections(connections: Connection[]): boolean {
  try {
    const toStore = connections.map(({ status: _status, ...rest }) => rest)
    localStorage.setItem(STORAGE_KEY_CONNECTIONS, JSON.stringify(toStore))
    return true
  } catch (e) {
    console.error('[ai-config] saveConnections 失败:', e)
    return false
  }
}

// Fix 025: migrateFromLegacy 只返回数据，不删 key；删除由 loadConnections 在写入成功后执行
// Fix 036: 返回 { connections, activeId? } 以保留旧的 active provider 信息
function migrateFromLegacy(): { connections: Connection[]; activeId?: string } {
  const rawConfigs = localStorage.getItem(STORAGE_KEY_CONFIGS)
  const rawActive = localStorage.getItem(STORAGE_KEY_ACTIVE)
  if (!rawConfigs) return { connections: [] }

  type LegacyProviderConfig = { apiKey: string; model: string; baseURL?: string }
  const configs = JSON.parse(rawConfigs) as Partial<Record<ProviderPreset, LegacyProviderConfig>>
  const connections: Connection[] = []
  let activeId: string | undefined

  for (const [provider, cfg] of Object.entries(configs)) {
    if (!cfg) continue
    const preset = PROVIDER_PRESETS[provider as ProviderPreset]
    const baseURL = cfg.baseURL ?? preset?.baseURL ?? ''
    const conn: Connection = {
      id: generateId(),
      name: preset?.label ?? extractName(baseURL),
      baseURL,
      apiKey: cfg.apiKey,
      model: cfg.model,
      format: (provider === 'anthropic' || provider === 'kimi-coding') ? 'anthropic' : 'openai',
      status: 'idle',
    }
    connections.push(conn)
    // Fix 036: 用旧 activeProvider 匹配对应连接
    if (rawActive && provider === rawActive) {
      activeId = conn.id
    }
  }

  if (import.meta.env.DEV) console.info('[ai-config] 已迁移旧 provider 格式到 Connection[]')
  return { connections, activeId }
}

function loadConnections(): { connections: Connection[]; activeId: string } {
  try {
    // 检测旧格式并迁移
    const hasLegacy = localStorage.getItem(STORAGE_KEY_CONFIGS) || localStorage.getItem(LEGACY_KEY)
    if (hasLegacy) {
      const { connections, activeId: migratedActiveId } = migrateFromLegacy()
      if (connections.length > 0) {
        // Fix 025: 先写后删
        const saved = saveConnections(connections)
        const resolvedActiveId = migratedActiveId ?? connections[0].id
        if (saved) {
          localStorage.setItem(STORAGE_KEY_ACTIVE_ID, resolvedActiveId)
          // 写入成功后才清理旧 key
          localStorage.removeItem(STORAGE_KEY_CONFIGS)
          localStorage.removeItem(STORAGE_KEY_ACTIVE)
          localStorage.removeItem(LEGACY_KEY)
        }
        return { connections, activeId: resolvedActiveId }
      }
    }

    const raw = localStorage.getItem(STORAGE_KEY_CONNECTIONS)
    const rawId = localStorage.getItem(STORAGE_KEY_ACTIVE_ID)

    // Fix 029: 加载时重置 status 为 'idle'
    // Fix 034: 过滤无效条目
    const connections: Connection[] = raw
      ? (JSON.parse(raw) as unknown[])
          .filter(isValidConnection)
          .map(c => ({ ...c, status: 'idle' as const }))
      : []

    // Fix 036: 优先使用存储的 activeId，找不到则 fallback 到第一个
    const activeId = rawId && connections.some(c => c.id === rawId)
      ? rawId
      : (connections[0]?.id ?? '')
    return { connections, activeId }
  } catch {
    return { connections: [], activeId: '' }
  }
}

function buildClientFromConnection(conn: Connection | undefined): AIClient {
  if (!conn || !conn.apiKey) return new MockAIClient()
  return new ProxyAIClient({ format: conn.format, baseURL: conn.baseURL, apiKey: conn.apiKey, model: conn.model })
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

const { connections: initConnections, activeId: initActiveId } = (() => {
  const loaded = loadConnections()
  // 如果没有任何连接，尝试从环境变量创建初始连接
  if (loaded.connections.length === 0) {
    const aiKey = import.meta.env.VITE_AI_API_KEY as string | undefined
    const aiURL = import.meta.env.VITE_AI_BASE_URL as string | undefined
    const aiModel = (import.meta.env.VITE_AI_MODEL as string | undefined) ?? 'deepseek-chat'
    if (aiKey && aiURL) {
      const conn: Connection = {
        id: generateId(),
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
        id: generateId(),
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
    saveConnections(newConnections)
    localStorage.setItem(STORAGE_KEY_ACTIVE_ID, conn.id)
    set({
      connections: newConnections,
      activeId: conn.id,
      client: buildClientFromConnection(conn),
    })
  },

  removeConnection: (id) => {
    const newConnections = get().connections.filter(c => c.id !== id)
    saveConnections(newConnections)
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
