import OpenAI from 'openai'
import type { AIClient, ChatRequest, ChatChunk, DirectionRequest, Direction } from '../types'

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

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
    })

    const text = response.choices[0]?.message?.content ?? ''

    // 提取 JSON 数组（兼容 AI 可能输出 markdown 代码块的情况）
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('AI 返回格式错误')

    return JSON.parse(jsonMatch[0]) as Direction[]
  }
}
