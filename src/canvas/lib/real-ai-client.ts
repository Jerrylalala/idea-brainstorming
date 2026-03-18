import { createAnthropic } from '@ai-sdk/anthropic'
import { streamText, generateText, type LanguageModel } from 'ai'
import type { AIClient, ChatRequest, ChatChunk, DirectionRequest, Direction } from '../types'
import { buildDirectionPrompt, parseDirectionsJSON } from './prompt-builder'

// 浏览器直连 Anthropic 需要此 header（官方推荐方案，替代 dangerouslyAllowBrowser）
const BROWSER_HEADER = { 'anthropic-dangerous-direct-browser-access': 'true' }

export class AnthropicAIClient implements AIClient {
  private model: LanguageModel

  constructor(apiKey: string, modelId: string, baseURL?: string) {
    const provider = createAnthropic({
      apiKey,
      ...(baseURL ? { baseURL } : {}),
      headers: BROWSER_HEADER,
    })
    this.model = provider(modelId)
  }

  async *streamChat(input: ChatRequest): AsyncGenerator<ChatChunk> {
    const systemMsg = input.messages.find(m => m.role === 'system')
    const messages = input.messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.text }))

    try {
      const result = streamText({
        model: this.model,
        system: systemMsg?.text,
        messages,
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
    const result = await generateText({
      model: this.model,
      messages: [{ role: 'user', content: buildDirectionPrompt(input) }],
    })
    return parseDirectionsJSON(result.text)
  }
}
