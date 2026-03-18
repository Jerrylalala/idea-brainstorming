import OpenAI from 'openai'
import type { AIClient, ChatRequest, ChatChunk, DirectionRequest, Direction } from '../types'
import { buildDirectionPrompt, parseDirectionsJSON } from './prompt-builder'

/**
 * 通用 OpenAI 兼容客户端
 * 支持：DeepSeek、Kimi（月之暗面）、Claude 中转（CC Switch / One API / NewAPI）
 * 以及任何暴露 OpenAI 兼容接口的服务
 */
export class OpenAICompatibleClient implements AIClient {
  private client: OpenAI
  private model: string

  constructor(apiKey: string, baseURL: string, model: string) {
    this.model = model
    this.client = new OpenAI({
      apiKey,
      baseURL,
      // 已知取舍：此应用为本地个人工具，无后端代理，需直接从浏览器调用
      dangerouslyAllowBrowser: true,
    })
  }

  async *streamChat(input: ChatRequest): AsyncGenerator<ChatChunk> {
    // OpenAI 格式：system 消息直接放在 messages 数组里
    const messages = input.messages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.text,
    }))

    try {
      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages,
        stream: true,
      })

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content
        if (text) yield { type: 'delta', text }
      }

      yield { type: 'done' }
    } catch (err) {
      yield { type: 'error', error: err instanceof Error ? err.message : '未知错误' }
    }
  }

  async generateDirections(input: DirectionRequest): Promise<Direction[]> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: buildDirectionPrompt(input) }],
      stream: false,
    })

    const text = response.choices[0]?.message?.content ?? ''
    return parseDirectionsJSON(text)
  }
}
