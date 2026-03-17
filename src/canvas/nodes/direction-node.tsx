import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Plus, Check, Circle, ArrowRight } from 'lucide-react'
import { useCanvasStore } from '../store/canvas-store'
import type { DirectionCanvasNode } from '../types'

export const DirectionNode = memo(({ id, data }: NodeProps<DirectionCanvasNode>) => {
  const { status, title, summary, keywords, isExpanding, opinionDraft } = data
  const startExpanding = useCanvasStore(s => s.startExpanding)
  const updateOpinionDraft = useCanvasStore(s => s.updateOpinionDraft)
  const submitOpinion = useCanvasStore(s => s.submitOpinion)
  const confirmDirection = useCanvasStore(s => s.confirmDirection)
  const pendingDirection = useCanvasStore(s => s.pendingDirection)

  // 状态样式
  const borderColor =
    status === 'confirmed' ? 'border-emerald-500' :
    status === 'pending' ? 'border-amber-500' :
    status === 'loading' ? 'border-blue-500' :
    'border-slate-200'

  const bgColor =
    status === 'confirmed' ? 'bg-emerald-50' :
    status === 'pending' ? 'bg-amber-50' :
    'bg-white'

  return (
    <div className={`w-[260px] rounded-lg border-2 ${borderColor} ${bgColor} shadow-sm`}>
      <Handle type="target" position={Position.Left} className="!bg-slate-400" />

      {/* 顶部状态徽章 */}
      {status === 'confirmed' && (
        <div className="absolute -top-2 -right-2">
          <Badge className="bg-emerald-500">已确认</Badge>
        </div>
      )}
      {status === 'pending' && (
        <div className="absolute -top-2 -right-2">
          <Badge className="bg-amber-500">待定</Badge>
        </div>
      )}

      <div className="p-3 space-y-2">
        {/* 标题 */}
        <h3 className="font-semibold text-sm text-slate-900">{title}</h3>

        {/* 摘要 */}
        <p className="text-xs text-slate-600 leading-relaxed">{summary}</p>

        {/* 关键词标签 */}
        <div className="flex flex-wrap gap-1">
          {keywords.map((kw, i) => (
            <Badge key={i} variant="secondary" className="text-xs">
              {kw}
            </Badge>
          ))}
        </div>

        {/* 操作按钮 */}
        {!isExpanding && status === 'idle' && (
          <div className="flex gap-1 pt-1">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-7 text-xs"
              onClick={() => startExpanding(id)}
            >
              <Plus className="w-3 h-3 mr-1" />
              展开
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0"
              onClick={() => confirmDirection(id)}
            >
              <Check className="w-3 h-3 text-emerald-600" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0"
              onClick={() => pendingDirection(id)}
            >
              <Circle className="w-3 h-3 text-amber-600" />
            </Button>
          </div>
        )}

        {/* 展开输入框 */}
        {isExpanding && (
          <div className="pt-1 space-y-2">
            <Input
              placeholder="补充你的想法..."
              value={opinionDraft}
              onChange={(e) => updateOpinionDraft(id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && opinionDraft.trim()) {
                  submitOpinion(id)
                }
              }}
              className="nodrag nokey h-8 text-xs"
              autoFocus
            />
            <Button
              size="sm"
              className="w-full h-7 text-xs"
              onClick={() => submitOpinion(id)}
              disabled={!opinionDraft.trim()}
            >
              <ArrowRight className="w-3 h-3 mr-1" />
              提交
            </Button>
          </div>
        )}

        {/* 加载状态 */}
        {status === 'loading' && (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            <span className="ml-2 text-xs text-slate-600">生成中...</span>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="!bg-slate-400" />
    </div>
  )
})

DirectionNode.displayName = 'DirectionNode'
