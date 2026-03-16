# CLI HANDOFF

## 你接手的是什么

这是一个 React + TypeScript + Tailwind + Zustand 项目。

当前旧文档里的 suggestion canvas 方向已经废弃。新的目标是：

**保留四周壳层，重做中间主区为 AI 头脑风暴无限画布。**

## 不要误解需求

用户原始目标不是只做一个画布。

用户真正想要的是：

- 当他想做网站、App 或小工具时
- 即使不知道专业术语
- 系统也能逐步提示他还需要考虑什么

所以产品未来一定会涉及：

- 技术选型建议
- 自动更新建议
- 手机支持建议
- 数据库与迁移建议
- 数据安全与备份建议
- 权限与安全建议

但这些能力当前不应先于画布基础设施开发。

## 当前最优开发顺序

### 先做

1. 正式画布
2. 文本卡片
3. 聊天卡片
4. 引用连线
5. 拖线建 Chat
6. mock streaming
7. 展开笔记
8. 局部引用

### 后做

1. AI 主动建议
2. 结构化需求检查项
3. 技术选型建议体系
4. 决策抽屉自动沉淀

## 强约束

- 不修改 TopBar
- 不修改 LeftNavPane
- 不修改 SessionListPane
- 不修改 DecisionDrawer
- 不保留 demo 切换栏
- 不继续用旧 suggestion canvas 做正式入口

## 技术建议

正式主方案：

- `@xyflow/react`
- `zustand`
- 轻量 markdown 渲染

不要把 `tldraw` 当成正式主方案。
