# Phase 3: 画布 UX 深度优化

## 目标

解决 5 个核心 UX 问题，提升方向树探索的流畅度和可用性。

---

## 问题清单与实现方案

### 1. 子节点拥挤重叠 → 引入自动布局

**现状**：手动展开多个子方向时，节点重叠在一起看不清。

**方案**：引入 `@reactflow/layout` 树形自动布局

**实现步骤**：
- [ ] `npm install @reactflow/layout`
- [ ] 在 store 中添加 `layoutNodes()` action
- [ ] 每次展开/折叠时调用布局计算
- [ ] 用 framer-motion 平滑过渡节点位置

**验收标准**：
- 同时展开 3+ 个子方向，节点自动排列不重叠
- 展开/折叠时有平滑动画

---

### 2. 搜索框 → 想法节点过渡太突兀

**现状**：搜索框消失，想法节点突然出现，体验割裂。

**方案**：用 framer-motion `layoutId` 实现共享元素过渡

**实现步骤**：
- [ ] SearchBar 添加 `layoutId="idea-input"`
- [ ] IdeaNode 添加相同的 `layoutId="idea-input"`
- [ ] 两者都用 `motion.div` 包裹
- [ ] 设置 `transition={{ type: "spring" }}`

**验收标准**：
- 提交搜索后，搜索框平滑变形/漂移到想法节点位置
- 文字从输入框位置过渡到节点中心

---

### 3. 决策面板同区排序

**现状**：面板项固定顺序，无法自定义排序。

**方案**：`@dnd-kit/sortable` 实现同区内上下拖拽排序

**实现步骤**：
- [ ] 添加 `SortableContext` 包裹面板项列表
- [ ] 用 `useSortable` 替代 `useDraggable`
- [ ] store 添加 `reorderConfirmedItems(ids: string[])` action
- [ ] store 添加 `reorderPendingItems(ids: string[])` action
- [ ] 保存排序到 localStorage（持久化）

**验收标准**：
- 已确认选型内可拖拽排序
- 待定项内可拖拽排序
- 排序后刷新页面保留

---

### 4. 去掉拖拽手柄，整行可拖拽

**现状**：有 GripVertical 手柄，占用空间，文字右移。

**方案**：去掉手柄，整行（除展开箭头外）可拖拽

**实现步骤**：
- [ ] 去掉 `GripVertical` 图标
- [ ] 将 `useSortable` 的 `listeners` 绑定到整行 div
- [ ] 展开箭头单独绑定 `onClick`
- [ ] 添加视觉反馈：hover 显示拖拽光标，拖拽时高亮

**验收标准**：
- 面板项更紧凑，没有多余图标
- 整行可拖拽（除展开箭头区域）
- 拖拽体验流畅

---

### 5. 连线距离缩短

**现状**：`HORIZONTAL_GAP = 80px`，节点之间太远。

**方案**：改为 **32px**

**实现步骤**：
- [ ] `tree-layout.ts` 修改 `HORIZONTAL_GAP = 32`

**验收标准**：
- 视觉上更紧凑
- 不与其他节点文字重叠

---

## 技术选型

| 库 | 用途 | 大小 |
|---|---|---|
| `@reactflow/layout` | 树形自动布局 | ~50KB |
| `@dnd-kit/sortable` | 面板内排序 | 已安装 |
| `framer-motion` | 过渡动画 | 已安装 |

---

## 执行顺序

1. **问题 5**（2分钟）：改数字，立即见效
2. **问题 2**（30分钟）：加 layoutId，体验提升明显
3. **问题 1**（2小时）：引入自动布局，最复杂
4. **问题 3 + 4**（1.5小时）：排序功能，一起实现

**预估总时间**：4 小时
