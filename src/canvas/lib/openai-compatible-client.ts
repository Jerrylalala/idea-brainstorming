import { createOpenAI } from '@ai-sdk/openai'
import { streamText, generateText, type LanguageModel } from 'ai'
import type { AIClient, ChatRequest, ChatChunk, DirectionRequest, Direction } from '../types'
import { buildDirectionPrompt, parseDirectionsJSON } from './prompt-builder'

export class OpenAICompatibleClient implements AIClient {
  private model: LanguageModel

  constructor(apiKey: string, baseURL: string, modelId: string) {
    const provider = createOpenAI({ apiKey, baseURL })
    this.model = provider(modelId)
  }

  async *streamChat(input: ChatRequest): AsyncGenerator<ChatChunk> {
    const messages = input.messages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.text,
    }))

    try {
      const result = streamText({ model: this.model, messages })
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
