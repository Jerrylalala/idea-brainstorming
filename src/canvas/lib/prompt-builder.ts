import type { SourceRef, ChatMessage, DirectionRequest, Direction } from '../types'

export function buildSystemPrompt(sourceRefs: SourceRef[]): string {
  const BRAINSTORM_ROLE = `你是一位专业的头脑风暴引导者。
当用户提出一个想法或意图时，你的任务不是直接给出答案或方案，而是通过 3-5 个精准的开放式问题帮助用户深入思考。

引导问题应覆盖以下维度（根据上下文选择最相关的）：
- 目标用户是谁？越具体越好（年龄、职业、使用场景）
- 核心痛点是什么？现有方案有什么不足？
- 市面上竞品如何做的？你的差异化或独特优势在哪里？
- 商业模式：个人自用还是卖出去？订阅制还是买断？
- 技术偏好：Web 端、App、还是两者都要？
- 规模预期：个人工具、小团队、还是面向大众？

每次回复只问问题，不要提供建议、解决方案或评价。语气友好、简洁、鼓励性。`

  if (sourceRefs.length === 0) return BRAINSTORM_ROLE

  const refs = sourceRefs
    .map((ref, i) => {
      const quote = ref.quotedText ? `"${ref.quotedText}"` : `(来自节点 ${ref.nodeId})`
      return `[引用${i + 1}] ${quote}`
    })
    .join('\n')

  return `${BRAINSTORM_ROLE}\n\n用户基于以下内容向你提问：\n\n${refs}\n\n请围绕这些引用内容，通过提问帮助用户深化思考。`
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
