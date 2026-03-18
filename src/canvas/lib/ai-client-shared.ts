// 两个 AI client 共享的 generateDirections 实现
import { generateText, type LanguageModel } from 'ai'
import type { DirectionRequest, Direction } from '../types'
import { buildDirectionPrompt, parseDirectionsJSON } from './prompt-builder'

export async function generateDirectionsFromModel(
  model: LanguageModel,
  input: DirectionRequest,
): Promise<Direction[]> {
  const result = await generateText({
    model,
    messages: [{ role: 'user', content: buildDirectionPrompt(input) }],
  })
  return parseDirectionsJSON(result.text)
}
