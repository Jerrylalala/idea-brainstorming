// 服务端与客户端共享的 prompt 构建工具

import type { DirectionRequest, SummaryRequest, SummaryResult, SummarySection } from './types'

export type Direction = {
  title: string
  summary: string
  keywords: string[]
}

// Fix 045: 限制用户输入长度，过滤控制字符，防止提示注入
function sanitizeInput(s: string, maxLen = 500): string {
  return s.slice(0, maxLen).replace(/[\x00-\x1f]/g, ' ')
}

export function buildDirectionPrompt(input: DirectionRequest): string {
  const idea = sanitizeInput(input.idea)
  const contextPart = input.parentContext
    ? `
父方向：${sanitizeInput(input.parentContext.parentTitle)}
父摘要：${sanitizeInput(input.parentContext.parentSummary)}
用户补充意见：${sanitizeInput(input.parentContext.userOpinion)}
祖先链：${sanitizeInput(input.parentContext.ancestorTitles.join(' → '))}
`
    : ''

  return `你是一个创意探索助手。用户正在探索以下想法：

"${idea}"
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

export function buildSummaryPrompt(input: SummaryRequest): string {
  const confirmed = input.confirmedDirections.length > 0
    ? `已确认方向：\n${input.confirmedDirections.map(d => `- ${d.title}：${d.summary}`).join('\n')}`
    : ''
  const pending = input.pendingDirections.length > 0
    ? `待定方向：\n${input.pendingDirections.map(d => `- ${d.title}：${d.summary}`).join('\n')}`
    : ''
  const texts = input.textNodeContents.length > 0
    ? `笔记内容：\n${input.textNodeContents.map((t, i) => `[${i + 1}] ${sanitizeInput(t, 200)}`).join('\n')}`
    : ''
  const chats = input.chatHighlights.length > 0
    ? `对话要点：\n${input.chatHighlights.map((c, i) => `[${i + 1}] ${sanitizeInput(c, 200)}`).join('\n')}`
    : ''

  const context = [confirmed, pending, texts, chats].filter(Boolean).join('\n\n')

  return `你是一位需求分析专家，正在帮助用户整理头脑风暴的成果。

用户已探索了以下内容：

${context || '（画布内容为空）'}

请综合分析以上内容，生成结构化总结。如果某项没有内容可填，items 返回空数组即可。

**严格按照以下 JSON 格式输出，不要有任何其他文字**：
{
  "confirmedDecisions": {
    "title": "已确认决策",
    "items": ["决策描述1", "决策描述2"]
  },
  "openQuestions": {
    "title": "待决策问题",
    "items": ["问题描述1", "问题描述2"]
  },
  "overlookedConsiderations": {
    "title": "可能遗漏的考量",
    "items": ["考量描述1", "考量描述2"]
  },
  "suggestedNextSteps": {
    "title": "建议下一步",
    "items": ["行动步骤1", "行动步骤2"]
  }
}`
}

export function parseSummaryJSON(text: string): SummaryResult {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('AI 综合分析返回格式错误')
  const raw = JSON.parse(jsonMatch[0]) as Record<string, unknown>

  const parseSection = (key: string): SummarySection => {
    const s = (raw[key] ?? {}) as Record<string, unknown>
    return {
      title: String(s.title ?? key),
      items: Array.isArray(s.items) ? (s.items as unknown[]).map(String) : [],
    }
  }

  return {
    confirmedDecisions: parseSection('confirmedDecisions'),
    openQuestions: parseSection('openQuestions'),
    overlookedConsiderations: parseSection('overlookedConsiderations'),
    suggestedNextSteps: parseSection('suggestedNextSteps'),
  }
}
