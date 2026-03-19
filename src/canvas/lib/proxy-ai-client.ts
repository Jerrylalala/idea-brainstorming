// 前端代理 Client — 所有 AI 请求走 /api/* 同源路由，由后端转发
import type { AIClient, ChatRequest, ChatChunk, DirectionRequest, Direction } from '../types'
import type { Connection } from './ai-config-store'

export type ConnectionConfig = Pick<Connection, 'format' | 'baseURL' | 'apiKey' | 'model'>

export class ProxyAIClient implements AIClient {
  constructor(private config: ConnectionConfig) {}

  async *streamChat(input: ChatRequest, signal?: AbortSignal): AsyncGenerator<ChatChunk> {
    const messages = input.messages.map(m => ({
      role: m.role,
      content: m.text,
    }))

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...this.config, messages }),
      signal,
    })

    if (!res.ok) {
      // Fix 046: 截断并转义响应体，防止潜在 XSS
      const raw = await res.text()
      const safeBody = raw.slice(0, 200).replace(/[<>&"']/g, c => `&#${c.charCodeAt(0)};`)
      yield { type: 'error', error: `HTTP ${res.status}: ${safeBody}` }
      return
    }

    if (!res.body) {
      yield { type: 'error', error: '响应体为空' }
      return
    }

    // NDJSON 流读取：逐行解析 ChatChunk
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      // 最后一个元素可能是不完整的行，留到下一轮
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          yield JSON.parse(line) as ChatChunk
        } catch {
          console.warn('[proxy] NDJSON 解析失败，跳过:', line.slice(0, 100))
        }
      }
    }

    // 处理 buffer 中可能残留的最后一行
    if (buffer.trim()) {
      try {
        yield JSON.parse(buffer) as ChatChunk
      } catch {
        console.warn('[proxy] NDJSON 尾行解析失败，跳过:', buffer.slice(0, 100))
      }
    }
  }

  async generateDirections(input: DirectionRequest, signal?: AbortSignal): Promise<Direction[]> {
    const res = await fetch('/api/directions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...this.config, input }),
      signal,
    })

    if (!res.ok) {
      // Fix 046: 截断并转义响应体，防止潜在 XSS
      const raw = await res.text()
      const safeBody = raw.slice(0, 200).replace(/[<>&"']/g, c => `&#${c.charCodeAt(0)};`)
      throw new Error(`HTTP ${res.status}: ${safeBody}`)
    }

    return res.json()
  }
}
