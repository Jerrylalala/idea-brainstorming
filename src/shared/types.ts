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
