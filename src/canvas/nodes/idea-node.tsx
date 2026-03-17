import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Loader2, Lightbulb } from 'lucide-react'
import type { IdeaCanvasNode } from '../types'

export const IdeaNode = memo(({ data }: NodeProps<IdeaCanvasNode>) => {
  const { idea, status } = data

  return (
    <div className="w-[420px] rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        {status === 'generating' ? (
          <Loader2 className="w-4 h-4 animate-spin text-amber-500 flex-shrink-0" />
        ) : (
          <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0" />
        )}
        <p className="text-sm font-medium text-slate-800">{idea}</p>
      </div>

      <Handle type="source" position={Position.Right} className="!bg-amber-500" />
    </div>
  )
})

IdeaNode.displayName = 'IdeaNode'
