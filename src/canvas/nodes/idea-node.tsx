import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Loader2 } from 'lucide-react'
import type { IdeaCanvasNode } from '../types'

export const IdeaNode = memo(({ data }: NodeProps<IdeaCanvasNode>) => {
  const { idea, status } = data

  return (
    <div className="w-[240px] rounded-lg border-2 border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* 顶部装饰条 */}
      <div className={`h-1 bg-gradient-to-r from-amber-400 to-orange-500 ${
        status === 'generating' ? 'animate-pulse' : ''
      }`} />

      <div className="p-4">
        <div className="flex items-start gap-2">
          {status === 'generating' && (
            <Loader2 className="w-4 h-4 mt-0.5 animate-spin text-amber-500 flex-shrink-0" />
          )}
          <p className="text-sm text-slate-700 leading-relaxed">{idea}</p>
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="!bg-amber-500" />
    </div>
  )
})

IdeaNode.displayName = 'IdeaNode'
