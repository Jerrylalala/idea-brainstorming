// Hono 后端路由 — 代理 AI 请求，解决 CORS 限制
import { Hono } from 'hono'
import { streamText, generateText } from 'ai'
import { buildModel } from './provider'
import { buildDirectionPrompt, parseDirectionsJSON } from '../src/canvas/lib/prompt-builder'
import type { ChatChunk, DirectionRequest } from '../src/canvas/types'

// 公共请求体类型（P2-3: 去重）
type AIProxyBody = {
  format: 'openai' | 'anthropic'
  apiKey: string
  baseURL: string
  model: string
}

// SSRF 防御：校验 baseURL 只允许公网 HTTPS（P1-1）
function isAllowedBaseURL(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url)
    // 允许 HTTPS 公网地址
    if (protocol === 'https:') return true
    // 允许本地开发 HTTP
    if (protocol === 'http:' && (hostname === 'localhost' || hostname === '127.0.0.1')) return true
    return false
  } catch {
    return false
  }
}

const app = new Hono()

// 全局错误处理（P1-2: 畸形 JSON 等异常不泄露堆栈）
app.onError((err, c) => {
  console.error('[api]', err.message)
  return c.json({ error: '请求处理失败' }, 500)
})

// === POST /api/chat — 流式聊天，NDJSON 格式 ===
app.post('/api/chat', async (c) => {
  const body = await c.req.json<AIProxyBody & {
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[]
  }>()
  console.log('[api/chat] format=%s baseURL=%s model=%s', body.format, body.baseURL, body.model)

  if (!isAllowedBaseURL(body.baseURL)) {
    return c.json({ error: 'Base URL 不允许（仅支持 HTTPS 公网地址）' }, 400)
  }

  const languageModel = buildModel(body.format, body.apiKey, body.baseURL, body.model)

  // Anthropic 要求 system 单独传入
  const systemMsg = body.messages.find(m => m.role === 'system')
  const chatMessages = body.messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const send = (chunk: ChatChunk) => {
        controller.enqueue(encoder.encode(JSON.stringify(chunk) + '\n'))
      }
      try {
        const result = streamText({
          model: languageModel,
          system: systemMsg?.content,
          messages: chatMessages,
          abortSignal: c.req.raw.signal,
          maxRetries: 0,
        })
        let deltaCount = 0
        for await (const chunk of result.fullStream) {
          if (chunk.type === 'text-delta') {
            deltaCount++
            send({ type: 'delta', text: chunk.text })
          } else if (chunk.type === 'error') {
            // fullStream 会显式 emit error 事件，抛出让外层 catch 处理
            throw chunk.error
          }
        }
        if (deltaCount === 0) {
          console.warn('[api/chat] textStream 为空 format=%s model=%s', body.format, body.model)
        }
        send({ type: 'done' })
      } catch (err) {
        send({ type: 'error', error: err instanceof Error ? err.message : '未知错误' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' },
  })
})

// === POST /api/directions — 非流式方向生成 ===
app.post('/api/directions', async (c) => {
  const body = await c.req.json<AIProxyBody & { input: DirectionRequest }>()

  if (!isAllowedBaseURL(body.baseURL)) {
    return c.json({ error: 'Base URL 不允许（仅支持 HTTPS 公网地址）' }, 400)
  }

  const languageModel = buildModel(body.format, body.apiKey, body.baseURL, body.model)
  const result = await generateText({
    model: languageModel,
    messages: [{ role: 'user', content: buildDirectionPrompt(body.input) }],
    abortSignal: c.req.raw.signal,
    maxRetries: 0,
  })
  const directions = parseDirectionsJSON(result.text)
  return c.json(directions)
})

// === POST /api/sniff — 并行格式嗅探 ===
app.post('/api/sniff', async (c) => {
  const body = await c.req.json<{ apiKey: string; baseURL: string; model: string }>()

  if (!isAllowedBaseURL(body.baseURL)) {
    return c.json({ error: 'Base URL 不允许' }, 400)
  }

  const probeMessages = [{ role: 'user' as const, content: 'Reply with one word: ok' }]
  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), 10000)

  async function tryFormat(format: 'openai' | 'anthropic'): Promise<'openai' | 'anthropic'> {
    const model = buildModel(format, body.apiKey, body.baseURL, body.model)
    const result = await generateText({
      model,
      messages: probeMessages,
      maxOutputTokens: 10,
      abortSignal: abortController.signal,
      maxRetries: 0,
    })
    if (!result.text) throw new Error('empty response')
    return format
  }

  try {
    const format = await Promise.any([tryFormat('openai'), tryFormat('anthropic')])
    clearTimeout(timeout)
    abortController.abort()  // 取消另一个仍在运行的请求
    return c.json({ format })
  } catch (err) {
    clearTimeout(timeout)
    if (abortController.signal.aborted) {
      return c.json({ error: '连接超时（10s），请检查网络或 URL' }, 400)
    }
    // 从 AggregateError 提取两种格式各自的错误信息
    const errors = err instanceof AggregateError ? err.errors : [err]
    const details = errors.map((e: unknown) => e instanceof Error ? e.message : String(e)).join(' / ')
    return c.json({ error: `两种格式均失败：${details}` }, 400)
  }
})

export default app
