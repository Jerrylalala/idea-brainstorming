import type { SourceRef, ChatMessage, DirectionRequest, Direction } from '../types'

export function buildSystemPrompt(sourceRefs: SourceRef[]): string {
  if (sourceRefs.length === 0) return '你是一个需求探索助手，帮助用户发散和收敛想法。'

  const refs = sourceRefs
    .map((ref, i) => {
      const quote = ref.quotedText ? `"${ref.quotedText}"` : `(来自节点 ${ref.nodeId})`
      return `[引用${i + 1}] ${quote}`
    })
    .join('\n')

  return `你是一个需求探索助手。用户基于以下内容向你提问：\n\n${refs}\n\n请围绕这些引用内容，帮助用户深入分析和发散思路。`
}

export function buildMessages(
  systemPrompt: string,
  chatMessages: ChatMessage[]
): ChatMessage[] {
  return [
    { id: 'system', role: 'system', text: systemPrompt, createdAt: 0 },
    ...chatMessages.filter((m) => m.role !== 'system'),
  ]
}

export function buildDirectionPrompt(input: DirectionRequest): string {
  const contextPart = input.parentContext
    ? `
父方向：${input.parentContext.parentTitle}
父摘要：${input.parentContext.parentSummary}
用户补充意见：${input.parentContext.userOpinion}
祖先链：${input.parentContext.ancestorTitles.join(' → ')}
`
    : ''

  return `你是一个创意探索助手。用户正在探索以下想法：

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
}

export function parseDirectionsJSON(text: string): Direction[] {
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('AI 返回格式错误')
  const raw = JSON.parse(jsonMatch[0]) as unknown[]
  if (!Array.isArray(raw)) throw new Error('AI 返回格式错误')
  return raw.map((item, i) => {
    const d = item as Record<string, unknown>
    if (typeof d.title !== 'string' || typeof d.summary !== 'string') {
      throw new Error(`第 ${i + 1} 条方向缺少必填字段`)
    }
    return {
      title: String(d.title).slice(0, 20),
      summary: String(d.summary).slice(0, 100),
      keywords: Array.isArray(d.keywords)
        ? (d.keywords as unknown[]).slice(0, 10).map(k => String(k).slice(0, 20))
        : [],
    } as Direction
  })
}
