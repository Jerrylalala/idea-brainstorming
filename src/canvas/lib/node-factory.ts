import type {
  TextCanvasNode, ChatCanvasNode, DirectionCanvasNode, IdeaCanvasNode, CanvasEdge,
  SourceRef, EdgeRelation,
} from '../types'

let counter = 0
const uid = () => `node-${Date.now()}-${++counter}`

export function createTextNode(
  position: { x: number; y: number },
  content: string = '',
  overrides?: Partial<TextCanvasNode['data']>
): TextCanvasNode {
  return {
    id: uid(),
    type: 'text',
    position,
    data: {
      title: '',
      content,
      format: 'plain',
      ...overrides,
    },
  }
}

export function createChatNode(
  position: { x: number; y: number },
  sourceRefs: SourceRef[] = []
): ChatCanvasNode {
  return {
    id: uid(),
    type: 'chat',
    position,
    data: {
      title: '',
      draft: '',
      status: 'idle',
      sourceRefs,
      messages: [],
    },
  }
}

export function createEdge(
  source: string,
  target: string,
  relation: EdgeRelation,
  sourceRef?: SourceRef
): CanvasEdge {
  return {
    id: `edge-${source}-${target}-${Date.now()}`,
    source,
    target,
    type: 'reference',
    data: { relation, sourceRef },
  }
}

export function createDirectionNode(
  position: { x: number; y: number },
  title: string,
  summary: string,
  keywords: string[],
  depth: number,
  parentNodeId: string | null
): DirectionCanvasNode {
  return {
    id: uid(),
    type: 'direction',
    position,
    data: {
      title,
      summary,
      keywords,
      status: 'idle',
      depth,
      parentNodeId,
      opinionDraft: '',
      isExpanding: false,
    },
  }
}

export function createIdeaNode(
  position: { x: number; y: number },
  idea: string
): IdeaCanvasNode {
  return {
    id: uid(),
    type: 'idea',
    position,
    data: {
      idea,
      status: 'idle',
    },
  }
}
