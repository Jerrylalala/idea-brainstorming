# TASKS

## 一、开发策略

推荐路线：

1. 先把画布基础设施做稳定
2. 再加“AI 主动建议”功能
3. 最后再加结构化输出和更强的决策沉淀

不要反过来。

## 二、为什么先做画布再加功能

因为你真正需要的是一个长期可扩展的需求探索工具。

如果现在就把：

- 技术选型建议
- 数据库迁移建议
- 自动更新建议
- 手机支持建议
- 安全建议

全做进去，但画布本身还不稳，那么这些能力没有可靠的承载结构，后续会反复推翻。

所以最优做法是：

- 先做承载层
- 再做建议层

## 三、Phase 1：必须先完成

### 1. 布局接入

- [ ] 删除 App 中 demo 切换逻辑
- [ ] 直接渲染正式布局
- [ ] 用正式画布替换 `MainPane`
- [ ] 保证四周壳层不被修改

### 2. 清理旧主区

- [ ] 删除 `src/components/main-pane.tsx`
- [ ] 删除 `src/components/search-seed-node.tsx`
- [ ] 删除 `src/components/curved-suggestion-canvas.tsx`
- [ ] 删除 `src/data/mock-suggestion-nodes.ts`
- [ ] 删除 `src/demos/reactflow-demo.tsx`
- [ ] 删除 `src/demos/tldraw-demo.tsx`

### 3. 建立画布模块

- [ ] 新建 `src/canvas/brainstorm-canvas.tsx`
- [ ] 新建 `src/canvas/types.ts`
- [ ] 新建 `src/canvas/store/canvas-store.ts`
- [ ] 新建 `src/canvas/nodes/text-node.tsx`
- [ ] 新建 `src/canvas/nodes/chat-node.tsx`
- [ ] 新建 `src/canvas/edges/reference-edge.tsx`
- [ ] 新建 `src/canvas/canvas-toolbar.tsx`
- [ ] 新建 `src/canvas/canvas-zoom-indicator.tsx`
- [ ] 新建 `src/canvas/lib/mock-ai.ts`

### 4. 基础画布能力

- [ ] 无限画布
- [ ] 点阵背景
- [ ] 缩放百分比显示
- [ ] 平移 / 缩放
- [ ] fit view

### 5. 节点能力

- [ ] 文本卡片可编辑
- [ ] 文本卡片可拖动
- [ ] 文本卡片可调大小
- [ ] 文本卡片最大宽度限制
- [ ] 支持上传 markdown
- [ ] markdown 渲染

### 6. 对话能力

- [ ] 拖线到空白区域自动创建 Chat 卡片
- [ ] Chat 自动记录引用来源
- [ ] Chat 内有独立输入框
- [ ] mock AI 流式回复
- [ ] Chat 状态管理：idle / streaming / error

### 7. 闭环能力

- [ ] “展开笔记”生成新文本卡片
- [ ] 自动创建派生连线
- [ ] 新文本卡片可继续发起分支
- [ ] 同一节点可分支出多个对话

### 8. 引用能力

- [ ] 支持至少一种局部引用交互
- [ ] 局部引用创建分支 Chat
- [ ] 边可点击
- [ ] 点击边跳回来源节点

### 9. 验证

- [ ] `npm run build` 通过
- [ ] 主要交互手测通过
- [ ] 不破坏现有壳层

## 四、Phase 2：在 Phase 1 完成后立刻跟进

这一阶段开始补你原本真正想要的“AI 主动建议”。

### 目标

当用户输入一个模糊需求后，系统不只是回答，还会主动补全需要考虑的问题。

### 具体功能

- [ ] 根据节点内容识别项目类型
- [ ] 区分网站 / App / 小工具 / 内部系统
- [ ] 自动生成“你还需要考虑”的问题清单
- [ ] 生成技术选型建议
- [ ] 生成平台支持建议
- [ ] 生成自动更新建议
- [ ] 生成数据库与迁移建议
- [ ] 生成权限与安全建议
- [ ] 生成部署与监控建议
- [ ] 将这些建议沉淀为新节点或右侧抽屉项

### 建议实现方式

不要先做复杂规则引擎。

先做：

- 一套 `suggestion categories`
- 一套 prompt 模板
- 一套可复用的“待确认问题”卡片生成逻辑

## 五、Phase 3：结构化输出

- [ ] 输出需求摘要
- [ ] 输出技术选型清单
- [ ] 输出风险与待确认项
- [ ] 输出实施计划

## 六、给 Claude Code 的直接执行清单

### 如果要直接 plan

Claude Code 应按以下顺序计划：

1. 替换入口与清理旧主区
2. 搭建画布基础模块
3. 实现 TextNode / ChatNode / ReferenceEdge
4. 实现拖线建 Chat
5. 实现 mock streaming
6. 实现“展开笔记”
7. 实现局部引用与跳转
8. build 验证
9. 再规划 Phase 2 的建议系统

### 如果要直接开发

Claude Code 不应一开始就实现：

- 真正的技术选型引擎
- 复杂规则系统
- 数据持久化
- 真实模型 API
- 多模型能力

Claude Code 应先把画布闭环做通。
