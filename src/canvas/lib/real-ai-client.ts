import { createAnthropic } from '@ai-sdk/anthropic'
import { streamText, type LanguageModel } from 'ai'
import type { AIClient, ChatRequest, ChatChunk, DirectionRequest, Direction } from '../types'
import { generateDirectionsFromModel } from './ai-client-shared'

// 浏览器直连 Anthropic 需要此 header（官方推荐方案，替代 dangerouslyAllowBrowser）
const BROWSER_HEADER = { 'anthropic-dangerous-direct-browser-access': 'true' }

// 同时服务于 anthropic 和 deepseek-anthropic 两个 provider（均使用 Anthropic 消息格式）
export class AnthropicCompatibleClient implements AIClient {
  private model: LanguageModel

  constructor(apiKey: string, modelId: string, baseURL?: string) {
    const provider = createAnthropic({
      apiKey,
      ...(baseURL ? { baseURL } : {}),
      headers: BROWSER_HEADER,
    })
    this.model = provider(modelId)
  }

  async *streamChat(input: ChatRequest, signal?: AbortSignal): AsyncGenerator<ChatChunk> {
    // Anthropic 要求 system 消息单独传入，不能混在 messages 数组里
    const systemMsg = input.messages.find(m => m.role === 'system')
    const messages = input.messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.text }))

    try {
      const result = streamText({
        model: this.model,
        system: systemMsg?.text,
        messages,
        abortSignal: signal,
      })
      for await (const delta of result.textStream) {
        yield { type: 'delta', text: delta }
      }
      yield { type: 'done' }
    } catch (err) {
      yield { type: 'error', error: err instanceof Error ? err.message : '未知错误' }
    }
  }

  async generateDirections(input: DirectionRequest): Promise<Direction[]> {
    return generateDirectionsFromModel(this.model, input)
  }
}
