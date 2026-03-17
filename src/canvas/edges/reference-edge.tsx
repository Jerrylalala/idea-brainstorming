import { useCallback } from 'react'
import {
  BaseEdge, getBezierPath, EdgeLabelRenderer,
  type EdgeProps,
  useReactFlow,
} from '@xyflow/react'
import type { ReferenceEdgeData } from '../types'
import { cn } from '@/lib/utils'

const RELATION_STYLES = {
  quote: { stroke: '#8b5cf6', label: '引用', dash: '' },
  branch: { stroke: '#06b6d4', label: '分支', dash: '5,5' },
  derived: { stroke: '#10b981', label: '', dash: '' },
}

export function ReferenceEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data, selected,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
  })

  const { fitView } = useReactFlow()
  const relation = (data as ReferenceEdgeData)?.relation ?? 'quote'
  const style = RELATION_STYLES[relation]

  // 点击 edge → 跳转到来源节点
  const handleClick = useCallback(() => {
    const sourceRef = (data as ReferenceEdgeData)?.sourceRef
    if (sourceRef?.nodeId) {
      fitView({ nodes: [{ id: sourceRef.nodeId }], duration: 600, padding: 0.5 })
    }
  }, [data, fitView])

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: style.stroke,
          strokeWidth: selected ? 3 : 2,
          strokeDasharray: style.dash || undefined,
          cursor: 'pointer',
        }}
        interactionWidth={20}
      />
      <EdgeLabelRenderer>
        <div
          className={cn(
            'absolute cursor-pointer rounded-full border px-2 py-0.5 text-[10px] font-medium',
            'bg-white shadow-sm transition-all hover:shadow-md hover:scale-110',
          )}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            borderColor: style.stroke,
            color: style.stroke,
            pointerEvents: 'all',
          }}
          onClick={handleClick}
        >
          {style.label}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
