import type { SourceRef, ChatMessage } from '../types'

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
