// 服务端与客户端共享的 prompt 构建工具

import type { DirectionRequest } from './types'

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
