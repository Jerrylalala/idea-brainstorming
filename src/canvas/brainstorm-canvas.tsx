import {
  ReactFlow,
  Background,
  BackgroundVariant,
  ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useCanvasStore } from './store/canvas-store'
import { TextNode } from './nodes/text-node'
import { ChatNode } from './nodes/chat-node'
import { DirectionNode } from './nodes/direction-node'
import { IdeaNode } from './nodes/idea-node'
import { ReferenceEdge } from './edges/reference-edge'
import { CanvasToolbar } from './canvas-toolbar'
import { CanvasZoomIndicator } from './canvas-zoom-indicator'
import { SearchBar } from './search-bar'
import { useCreateChatFromEdge } from './hooks/use-create-chat-from-edge'

const nodeTypes = {
  text: TextNode,
  chat: ChatNode,
  direction: DirectionNode,
  idea: IdeaNode,
}

const edgeTypes = {
  reference: ReferenceEdge,
}

function DeleteToast() {
  const lastDeleted = useCanvasStore((s) => s.lastDeleted)
  const undoDelete = useCanvasStore((s) => s.undoDelete)

  if (!lastDeleted) return null

  return (
    <div className="absolute bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5 shadow-lg">
      <span className="text-sm text-slate-600">已删除节点</span>
      <span className="text-slate-300">·</span>
      <button
        className="text-sm font-medium text-sky-500 hover:text-sky-700"
        onClick={undoDelete}
      >
        撤销
      </button>
    </div>
  )
}

function BrainstormCanvasInner() {
  const { nodes, edges, onNodesChange, onEdgesChange } = useCanvasStore()
  const { onConnectStart, onConnectEnd } = useCreateChatFromEdge()

  return (
    <div className="relative h-full w-full">
      <SearchBar />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        defaultEdgeOptions={{ type: 'reference' }}
        minZoom={0.1}
        maxZoom={2}
        panOnScroll
        zoomOnScroll={false}
        deleteKeyCode="Delete"
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e8f0" />
        <CanvasToolbar />
        <CanvasZoomIndicator />
      </ReactFlow>
      <DeleteToast />
    </div>
  )
}

export function BrainstormCanvas() {
  return (
    <ReactFlowProvider>
      <BrainstormCanvasInner />
    </ReactFlowProvider>
  )
}
