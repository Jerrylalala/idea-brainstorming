import type { AIClient } from '../types'
import { MockAIClient } from './mock-ai'
import { AnthropicAIClient } from './real-ai-client'

const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined

// 有 API key 时使用真实 AI，否则降级到 Mock
export const aiClient: AIClient = apiKey
  ? new AnthropicAIClient(apiKey)
  : new MockAIClient()
