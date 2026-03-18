import Anthropic from '@anthropic-ai/sdk'
import type { AIClient, ChatRequest, ChatChunk, DirectionRequest, Direction } from '../types'
import { buildDirectionPrompt, parseDirectionsJSON } from './prompt-builder'

export class AnthropicAIClient implements AIClient {
  private client: Anthropic
  private model: string

  constructor(apiKey: string, model: string, baseURL?: string) {
    this.model = model
    this.client = new Anthropic({
      apiKey,
      ...(baseURL ? { baseURL } : {}),
      // 已知取舍：此应用为本地个人工具，无后端代理，需直接从浏览器调用
      dangerouslyAllowBrowser: true,
    })
  }

  async *streamChat(input: ChatRequest): AsyncGenerator<ChatChunk> {
    const systemMsg = input.messages.find(m => m.role === 'system')
    const userMessages = input.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.text,
      }))

    try {
      const stream = this.client.messages.stream({
        model: this.model,
        max_tokens: 2048,
        system: systemMsg?.text,
        messages: userMessages,
      })

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield { type: 'delta', text: event.delta.text }
        }
      }

      yield { type: 'done' }
    } catch (err) {
      yield { type: 'error', error: err instanceof Error ? err.message : '未知错误' }
    }
  }

  async generateDirections(input: DirectionRequest): Promise<Direction[]> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: buildDirectionPrompt(input) }],
    })

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    return parseDirectionsJSON(text)
  }
}
