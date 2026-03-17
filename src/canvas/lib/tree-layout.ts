const HORIZONTAL_GAP = 80   // 父子节点水平间距（紧凑）
const VERTICAL_GAP = 60     // 兄弟节点垂直间距（单行节点高度约 50px）
const COLUMN_TOLERANCE = 100 // 判断"同一列"的 x 坐标容差
const DEFAULT_NODE_HEIGHT = 50

export function computeChildPositions(
  parentPosition: { x: number; y: number },
  parentNodeWidth: number,
  childCount: number,
  existingNodes?: Array<{ x: number; y: number; width?: number; height?: number }>
): Array<{ x: number; y: number }> {
  const startX = parentPosition.x + parentNodeWidth + HORIZONTAL_GAP

  // 基于父节点居中的默认起始 y
  const totalHeight = (childCount - 1) * VERTICAL_GAP
  const centeredStartY = parentPosition.y - totalHeight / 2

  let startY = centeredStartY

  // 如果有现有节点，检查目标列是否已被占据
  if (existingNodes && existingNodes.length > 0) {
    // 找到同一列（x 坐标在 ±COLUMN_TOLERANCE 范围内）的所有现有节点
    const sameColumnNodes = existingNodes.filter(
      n => Math.abs(n.x - startX) < COLUMN_TOLERANCE
    )

    if (sameColumnNodes.length > 0) {
      // 找到这些节点占据的最低 y 坐标（y + height）
      const lowestY = Math.max(
        ...sameColumnNodes.map(n => n.y + (n.height ?? DEFAULT_NODE_HEIGHT))
      )

      // 新子节点从最低点之后开始，但不低于居中位置
      startY = Math.max(centeredStartY, lowestY + VERTICAL_GAP)
    }
  }

  return Array.from({ length: childCount }, (_, i) => ({
    x: startX,
    y: startY + i * VERTICAL_GAP,
  }))
}
