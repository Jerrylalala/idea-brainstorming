const HORIZONTAL_GAP = 360  // 父子节点水平间距
const VERTICAL_GAP = 120    // 兄弟节点垂直间距

export function computeChildPositions(
  parentPosition: { x: number; y: number },
  parentNodeWidth: number,
  childCount: number
): Array<{ x: number; y: number }> {
  const startX = parentPosition.x + parentNodeWidth + HORIZONTAL_GAP
  const totalHeight = (childCount - 1) * VERTICAL_GAP
  const startY = parentPosition.y - totalHeight / 2

  return Array.from({ length: childCount }, (_, i) => ({
    x: startX,
    y: startY + i * VERTICAL_GAP,
  }))
}
