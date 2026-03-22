import type { SourceRef, ChatMessage, DirectionRequest, Direction } from '../types'

export type CanvasContext = {
  confirmedDirections: string[]  // 已确认方向的标题列表
  textNodeSummaries: string[]    // 每个 text-node 内容前 100 字
}

export function buildSystemPrompt(
  sourceRefs: SourceRef[],
  canvasContext?: CanvasContext
): string {
  const BRAINSTORM_ROLE = `你是一位专业的头脑风暴引导者。
当用户描述一个想法时，首先理解这个想法，然后动态引导探索——不要套用固定维度模板。

**第一步：分析用户描述**
- 判断项目类型：个人工具 / 团队内部工具 / 面向大众的产品
- 识别用户已经说清楚的信息（不要重复问）
- 找出最关键的 1-2 个还没想清楚的维度

**对话策略（分阶段）**
- 前 3 轮：每次只问 1-2 个最关键的问题，不重复已知信息
- 3 轮之后：在引导的同时，可主动说「你可能还没考虑到的是：...」
- 任何时候：用户问「你觉得怎么样」时，给出判断性建议，不要继续反问

**提问参考维度（按情况选择，不是全部都问）**
- 使用规模（个人用 / 团队 / 面向大众）
- 核心用户场景（什么人，在什么情况下用）
- 差异化价值（和现有方案相比，哪里不同）
- 技术约束（平台偏好、开发者本人技术栈）

语气友好、简洁、鼓励性。`

  let prompt = BRAINSTORM_ROLE

  // 注入画布级上下文（P1：打破节点孤岛）
  if (canvasContext) {
    const parts: string[] = []
    if (canvasContext.confirmedDirections.length > 0) {
      parts.push(`用户已确认的方向：${canvasContext.confirmedDirections.join('、')}`)
    }
    if (canvasContext.textNodeSummaries.length > 0) {
      parts.push(
        `画布上的笔记摘要：\n${canvasContext.textNodeSummaries
          .map((s, i) => `[笔记${i + 1}] ${s}`)
          .join('\n')}`
      )
    }
    if (parts.length > 0) {
      prompt += `\n\n**当前画布上下文**（请勿重复问用户已说明的信息）：\n${parts.join('\n')}`
    }
  }

  if (sourceRefs.length === 0) return prompt

  const refs = sourceRefs
    .map((ref, i) => {
      const quote = ref.quotedText ? `"${ref.quotedText}"` : `(来自节点 ${ref.nodeId})`
      return `[引用${i + 1}] ${quote}`
    })
    .join('\n')

  return `${prompt}\n\n用户基于以下内容向你提问：\n\n${refs}\n\n请围绕这些引用内容，通过提问帮助用户深化思考。`
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
