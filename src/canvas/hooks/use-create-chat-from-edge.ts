import { useCallback, useRef } from 'react'
import { useReactFlow, type OnConnectEnd } from '@xyflow/react'
import { useCanvasStore } from '../store/canvas-store'

export function useCreateChatFromEdge() {
  const reactFlow = useReactFlow()
  const addChatFromEdge = useCanvasStore((s) => s.addChatFromEdge)

  // 用 ref 记录拖线起始节点（避免闭包捕获问题）
  const connectingNodeId = useRef<string | null>(null)

  const onConnectStart = useCallback(
    (_: unknown, params: { nodeId: string | null }) => {
      connectingNodeId.current = params.nodeId ?? null
    },
    []
  )

  const onConnectEnd: OnConnectEnd = useCallback(
    (event) => {
      if (!connectingNodeId.current) return

      // 检查是否落在了已有节点上（如果是，由 onConnect 处理）
      const targetIsPane = (event.target as HTMLElement)?.classList?.contains(
        'react-flow__pane'
      )
      if (!targetIsPane) return

      const clientEvent = 'changedTouches' in event
        ? (event as TouchEvent).changedTouches[0]
        : (event as MouseEvent)

      const position = reactFlow.screenToFlowPosition({
        x: clientEvent.clientX,
        y: clientEvent.clientY,
      })

      addChatFromEdge(connectingNodeId.current, position)
      connectingNodeId.current = null
    },
    [reactFlow, addChatFromEdge]
  )

  return { onConnectStart, onConnectEnd }
}
