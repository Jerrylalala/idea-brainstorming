import Anthropic from '@anthropic-ai/sdk'
import type { AIClient, ChatRequest, ChatChunk, DirectionRequest, Direction } from '../types'

const MODEL = 'claude-sonnet-4-6'

export class AnthropicAIClient implements AIClient {
  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({
      apiKey,
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
        model: MODEL,
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
    const contextPart = input.parentContext
      ? `
父方向：${input.parentContext.parentTitle}
父摘要：${input.parentContext.parentSummary}
用户补充意见：${input.parentContext.userOpinion}
祖先链：${input.parentContext.ancestorTitles.join(' → ')}
`
      : ''

    const prompt = `你是一个创意探索助手。用户正在探索以下想法：

"${input.idea}"
${contextPart}
请生成 5-7 个不同的探索方向。

**严格按照以下 JSON 格式输出，不要有任何其他文字**：
[
  {
    "title": "方向标题（5字以内）",
    "summary": "一句话描述（20字以内）",
    "keywords": ["关键词1", "关键词2", "关键词3"]
  }
]`

    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    // 提取 JSON 数组（兼容 AI 可能输出 markdown 代码块的情况）
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('AI 返回格式错误')

    const directions = JSON.parse(jsonMatch[0]) as Direction[]
    return directions
  }
}
