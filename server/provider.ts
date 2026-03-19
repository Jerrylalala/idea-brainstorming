// 根据 format 构建 Vercel AI SDK LanguageModel（服务端，无需浏览器 header）
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'

export function buildModel(
  format: 'openai' | 'anthropic',
  apiKey: string,
  baseURL: string,
  model: string,
): LanguageModel {
  if (format === 'anthropic') {
    // Anthropic Messages 格式（/messages endpoint）
    return createAnthropic({ apiKey, baseURL })(model)
  }
  // OpenAI 兼容格式，强制 .chat() 走 /chat/completions
  return createOpenAI({ apiKey, baseURL }).chat(model)
}
