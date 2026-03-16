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
import { ReferenceEdge } from './edges/reference-edge'
import { CanvasToolbar } from './canvas-toolbar'
import { CanvasZoomIndicator } from './canvas-zoom-indicator'
import { useCreateChatFromEdge } from './hooks/use-create-chat-from-edge'

const nodeTypes = {
  text: TextNode,
  chat: ChatNode,
}

const edgeTypes = {
  reference: ReferenceEdge,
}

function BrainstormCanvasInner() {
  const { nodes, edges, onNodesChange, onEdgesChange } = useCanvasStore()
  const { onConnectStart, onConnectEnd } = useCreateChatFromEdge()

  return (
    <div className="relative h-full w-full">
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
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e8f0" />
        <CanvasToolbar />
        <CanvasZoomIndicator />
      </ReactFlow>
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
