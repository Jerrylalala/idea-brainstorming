// 服务端与客户端共享的类型定义

export type ChatChunk = {
  type: 'delta' | 'done' | 'error'
  text?: string
  error?: string
}

export type DirectionRequest = {
  idea: string
  parentContext?: {
    parentTitle: string
    parentSummary: string
    userOpinion: string
    ancestorTitles: string[]
  }
}

export type SummaryRequest = {
  confirmedDirections: { title: string; summary: string }[]
  pendingDirections: { title: string; summary: string }[]
  textNodeContents: string[]
  chatHighlights: string[]   // 每个 chat-node 最后一条 assistant 消息（前 200 字）
}

export type SummarySection = {
  title: string
  items: string[]
}

export type SummaryResult = {
  confirmedDecisions: SummarySection
  openQuestions: SummarySection
  overlookedConsiderations: SummarySection
  suggestedNextSteps: SummarySection
}
