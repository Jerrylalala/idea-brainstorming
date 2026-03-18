import { createOpenAI } from '@ai-sdk/openai'
import { streamText, type LanguageModel } from 'ai'
import type { AIClient, ChatRequest, ChatChunk, DirectionRequest, Direction } from '../types'
import { generateDirectionsFromModel } from './ai-client-shared'

export class OpenAICompatibleClient implements AIClient {
  private model: LanguageModel

  constructor(apiKey: string, baseURL: string, modelId: string) {
    const provider = createOpenAI({ apiKey, baseURL })
    this.model = provider(modelId)
  }

  async *streamChat(input: ChatRequest, signal?: AbortSignal): AsyncGenerator<ChatChunk> {
    const messages = input.messages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.text,
    }))

    try {
      const result = streamText({ model: this.model, messages, abortSignal: signal })
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
