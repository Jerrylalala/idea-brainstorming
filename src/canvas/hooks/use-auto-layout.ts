import { useEffect, useRef, useCallback } from 'react'
import { useNodesInitialized, useReactFlow } from '@xyflow/react'
import { useCanvasStore } from '../store/canvas-store'
import type { CanvasNode, CanvasEdge } from '../types'

// 记录每次布局新增的节点 ID，用于聚焦
let pendingFocusNodeIds: string[] = []
export function setPendingFocusNodes(parentId: string, childIds: string[]) {
  pendingFocusNodeIds = [parentId, ...childIds]
}

const HORIZONTAL_GAP = 150  // 父→子水平间距
const VERTICAL_GAP = 16     // 兄弟节点垂直间距
const DEFAULT_WIDTH = 300
const DEFAULT_HEIGHT = 80

/**
 * 手动树形布局：用 ReactFlow 实测尺寸计算位置
 * 必须在 ReactFlowProvider 内部调用
 */
function getLayoutedElements(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  measuredNodes: Map<string, { width: number; height: number }>
): CanvasNode[] {
  // 1. 找到根节点（IdeaNode）
  const ideaNode = nodes.find(n => n.type === 'idea')
  if (!ideaNode) return nodes

  // 2. 构建父→子映射
  const childrenMap = new Map<string, string[]>()
  edges.forEach(edge => {
    const children = childrenMap.get(edge.source) || []
    children.push(edge.target)
    childrenMap.set(edge.source, children)
  })

  // 3. 节点快速查找
  const nodesMap = new Map(nodes.map(n => [n.id, n]))

  // 4. 递归布局
  const layoutedPositions = new Map<string, { x: number; y: number }>()

  function getSize(nodeId: string) {
    const measured = measuredNodes.get(nodeId)
    return {
      width: measured?.width ?? DEFAULT_WIDTH,
      height: measured?.height ?? DEFAULT_HEIGHT,
    }
  }

  function layoutSubtree(nodeId: string, x: number, y: number): number {
    const node = nodesMap.get(nodeId)
    if (!node) return y

    const { width, height } = getSize(nodeId)
    const children = childrenMap.get(nodeId) || []

    if (children.length === 0) {
      // 叶子节点：直接放置
      layoutedPositions.set(nodeId, { x, y })
      return y + height + VERTICAL_GAP
    }

    // 有子节点：先布局所有子节点
    const childX = x + width + HORIZONTAL_GAP
    let childY = y

    children.forEach(childId => {
      childY = layoutSubtree(childId, childX, childY)
    })

    // 子树总区域: [y, childY - VERTICAL_GAP]
    const subtreeTop = y
    const subtreeBottom = childY - VERTICAL_GAP
    // 父节点垂直居中对齐子树
    const parentY = (subtreeTop + subtreeBottom) / 2 - height / 2

    layoutedPositions.set(nodeId, { x, y: parentY })

    return childY
  }

  // 5. 从根节点开始布局
  layoutSubtree(ideaNode.id, 100, 100)

  // 6. 应用位置
  return nodes.map(n => {
    const pos = layoutedPositions.get(n.id)
    if (!pos) return n
    return {
      ...n,
      position: pos,
      style: { ...n.style, transition: 'all 0.3s ease' },
    }
  })
}

/**
 * 自动布局 Hook - 在 ReactFlowProvider 内部使用
 * 监听 layoutVersion 变化，等节点测量完成后执行布局
 */
export function useAutoLayout() {
  const nodesInitialized = useNodesInitialized()
  const { getNodes, fitView } = useReactFlow()
  const layoutVersion = useCanvasStore(s => s.layoutVersion)
  const storeNodes = useCanvasStore(s => s.nodes)
  const lastLayoutedVersion = useRef(-1)

  const runLayout = useCallback(() => {
    // 获取 ReactFlow 内部的节点（包含 measured 尺寸）
    const rfNodes = getNodes()

    // 构建实测尺寸映射
    const measuredNodes = new Map<string, { width: number; height: number }>()
    rfNodes.forEach(node => {
      const measured = (node as any).measured
      if (measured?.width && measured?.height) {
        measuredNodes.set(node.id, { width: measured.width, height: measured.height })
      }
    })

    // 筛选可布局的节点和边
    const storeNodes = useCanvasStore.getState().nodes
    const storeEdges = useCanvasStore.getState().edges
    const layoutableNodes = storeNodes.filter(n => n.type === 'direction' || n.type === 'idea')
    const layoutableEdges = storeEdges.filter(e => {
      const src = storeNodes.find(n => n.id === e.source)
      const tgt = storeNodes.find(n => n.id === e.target)
      return (src?.type === 'direction' || src?.type === 'idea') &&
             (tgt?.type === 'direction' || tgt?.type === 'idea')
    })

    if (layoutableNodes.length === 0) return

    // 检查所有可布局节点是否都已被测量
    const allMeasured = layoutableNodes.every(n => measuredNodes.has(n.id))
    if (!allMeasured) {
      // 还有节点未测量，延迟重试
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          runLayout()
        })
      })
      return
    }

    const layoutedNodes = getLayoutedElements(layoutableNodes, layoutableEdges, measuredNodes)

    // 更新 store 中的节点位置
    const layoutedMap = new Map(layoutedNodes.map(n => [n.id, n]))
    useCanvasStore.setState((s) => ({
      nodes: s.nodes.map(n => {
        const layouted = layoutedMap.get(n.id)
        return layouted || n
      }) as CanvasNode[],
    }))

    // 布局完成后，聚焦到新增的父+子节点区域
    if (pendingFocusNodeIds.length > 0) {
      const focusIds = [...pendingFocusNodeIds]
      pendingFocusNodeIds = []
      // 等一帧让位置生效后再 fitView
      requestAnimationFrame(() => {
        fitView({
          nodes: focusIds.map(id => ({ id })),
          padding: 0.3,
          duration: 600,
        })
      })
    }
  }, [getNodes, fitView])

  // 当 layoutVersion 变化时，触发布局
  useEffect(() => {
    if (layoutVersion <= 0) return
    if (lastLayoutedVersion.current === layoutVersion) return

    lastLayoutedVersion.current = layoutVersion

    // 延迟执行，等待 React 渲染 + ReactFlow 测量
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        runLayout()
      })
    })
  }, [layoutVersion, runLayout])

  // 当 store nodes 变化时（新节点加入），也尝试执行布局
  // 这确保即使 layoutVersion 没变，新节点也能被布局
  useEffect(() => {
    if (layoutVersion > 0 && nodesInitialized) {
      // 延迟一点，确保 ReactFlow 完成测量
      const timer = setTimeout(() => {
        runLayout()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [storeNodes.length, nodesInitialized, layoutVersion, runLayout])
}
