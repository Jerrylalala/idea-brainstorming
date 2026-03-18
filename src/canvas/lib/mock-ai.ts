import type { AIClient, ChatRequest, ChatChunk, DirectionRequest, Direction } from '../types'

// 根据用户输入关键词匹配不同回复，模拟真实 AI 的多样性
const TOPIC_RESPONSES: { keywords: string[]; response: string }[] = [
  {
    keywords: ['功能', '需求', '想做', '实现'],
    response: '这是一个很好的功能想法。让我帮你拆解：\n\n1. **核心价值**：这个功能解决了什么用户痛点？先把"为什么做"想清楚。\n2. **最小可用版本**：如果只做 3 天，保留哪些部分？砍掉哪些？\n3. **已有方案**：市场上有没有类似产品可以参考？不一定要从零开始。\n\n建议先做用户访谈验证需求真伪，再投入开发。',
  },
  {
    keywords: ['技术', '架构', '选型', '框架', '库'],
    response: '技术选型需要考虑几个维度：\n\n- **团队熟悉度**：选团队最熟的，不选最新的。学习成本是隐性成本。\n- **社区活跃度**：GitHub Stars、最近更新时间、Issue 响应速度。\n- **场景匹配**：杀鸡不用牛刀，简单场景用简单方案。\n- **迁移成本**：万一选错了，换掉它要多大代价？\n\n我的建议：先做 Proof of Concept，用最小成本验证技术可行性。',
  },
  {
    keywords: ['bug', '问题', '报错', '修复', '不工作'],
    response: '排查问题的思路：\n\n1. **复现**：能稳定复现吗？什么条件下触发？\n2. **隔离**：是前端还是后端？是数据问题还是逻辑问题？\n3. **最小化**：能否构造一个最小的复现案例？\n4. **对比**：之前能正常工作吗？什么改动之后开始出问题？\n\n先确认这些信息，我们再一起定位根因。',
  },
  {
    keywords: ['设计', 'UI', '交互', '用户体验', '界面'],
    response: '好的设计遵循几个原则：\n\n- **别让用户思考**：操作路径要直觉化，主要操作 3 步内完成。\n- **即时反馈**：每个操作都要有视觉反馈，让用户知道"系统收到了"。\n- **容错性**：错误操作要能撤销，危险操作要二次确认。\n- **一致性**：相同的模式用相同的交互，减少认知负担。\n\n可以画个低保真原型先验证交互流程，再打磨视觉。',
  },
  {
    keywords: ['营销', '推广', '增长', '商业', '变现'],
    response: '关于推广和增长，几个思路：\n\n1. **找到核心用户**：谁最需要这个产品？去他们聚集的地方。\n2. **口碑传播**：产品本身好用是最好的营销。\n3. **内容营销**：写教程、案例分享、行业洞察，建立专业形象。\n4. **从小做起**：先服务 100 个深度用户，比覆盖 10000 个浅层用户更有价值。\n\n商业模式上，先验证有人愿意付费，再考虑规模化。',
  },
]

const DEFAULT_RESPONSES = [
  '这是一个值得探索的方向。让我从几个角度分析：\n\n1. **可行性**：技术上完全可以实现，建议先从最小闭环开始。\n2. **优先级**：核心功能优先，装饰性功能后置。\n3. **风险**：主要风险在于范围蔓延，建议严格控制 MVP 边界。',
  '我注意到你提到的这个点有几个值得深入探讨的方向：\n\n- **用户场景**：谁会用？在什么场景下用？频率如何？\n- **已有方案**：市场上有没有类似的解决方案可以参考？\n- **差异点**：我们的方案和现有方案的核心差异是什么？\n\n把这些想清楚，方向就明确了。',
  '有意思的想法。让我帮你理清思路：\n\n首先，核心价值在于帮助用户快速发散和收敛想法。\n\n其次，实现上可以分三步走：\n1. 先做基础的输入和展示（1-2天）\n2. 再做智能关联和建议（3-5天）\n3. 最后做结构化输出和沉淀（2-3天）\n\n每步都可以独立交付和验证。',
  '让我换个角度来看这个问题：\n\n**如果我是用户**，我最关心的是：\n- 这个东西能帮我省多少时间？\n- 上手成本高不高？\n- 和我现有的工作流能不能衔接？\n\n**如果我是开发者**，我最关心的是：\n- 技术复杂度可控吗？\n- 后续维护成本呢？\n- 有没有可以复用的组件？\n\n建议先解决用户最痛的那个点，其他的迭代再加。',
]

function pickResponse(userInput: string): string {
  const input = userInput.toLowerCase()
  for (const topic of TOPIC_RESPONSES) {
    if (topic.keywords.some((kw) => input.includes(kw))) {
      return topic.response
    }
  }
  return DEFAULT_RESPONSES[Math.floor(Math.random() * DEFAULT_RESPONSES.length)]
}

export class MockAIClient implements AIClient {
  async *streamChat(input: ChatRequest): AsyncGenerator<ChatChunk> {
    // 取最后一条用户消息来匹配回复
    const lastUserMsg = [...input.messages].reverse().find((m) => m.role === 'user')
    const response = pickResponse(lastUserMsg?.text ?? '')
    const chars = [...response]

    for (const char of chars) {
      await new Promise((r) => setTimeout(r, 15 + Math.random() * 25))
      yield { type: 'delta', text: char }
    }

    yield { type: 'done' }
  }

  async generateDirections(input: DirectionRequest): Promise<Direction[]> {
    // 模拟 800-1200ms 延迟
    await new Promise(r => setTimeout(r, 800 + Math.random() * 400))

    // 方向模板库
    const templates: Record<string, Direction[]> = {
      产品: [
        { title: '桌面软件方案', summary: '开发 Windows/Mac 原生应用，提供离线能力和系统集成', keywords: ['Electron', 'Tauri', '原生'] },
        { title: 'Web 应用方案', summary: '基于浏览器的 SaaS 服务，无需安装，跨平台访问', keywords: ['React', 'Vue', 'SaaS'] },
        { title: '移动端优先', summary: '从 iOS/Android App 切入，抓住移动办公场景', keywords: ['React Native', 'Flutter', '移动'] },
        { title: '浏览器插件', summary: '作为 Chrome/Edge 扩展，嵌入用户现有工作流', keywords: ['Extension', '插件', '浏览器'] },
        { title: 'CLI 工具', summary: '命令行工具，面向开发者和高级用户', keywords: ['CLI', '命令行', '自动化'] },
        { title: '混合方案', summary: 'Web 主体 + 桌面客户端增强，兼顾便捷性和性能', keywords: ['混合', 'Hybrid', 'PWA'] },
      ],
      技术: [
        { title: 'React 生态', summary: '使用 React + TypeScript + Vite，成熟稳定的前端技术栈', keywords: ['React', 'TypeScript', 'Vite'] },
        { title: 'Vue 生态', summary: '使用 Vue 3 + Composition API，渐进式框架', keywords: ['Vue', 'Composition', 'Pinia'] },
        { title: 'Svelte 方案', summary: '编译时框架，运行时体积小，性能优异', keywords: ['Svelte', 'SvelteKit', '编译'] },
        { title: 'Next.js 全栈', summary: 'React 全栈框架，SSR/SSG/API 一体化', keywords: ['Next.js', 'SSR', 'Vercel'] },
        { title: 'Remix 方案', summary: '现代全栈框架，注重 Web 标准和渐进增强', keywords: ['Remix', 'Web标准', '全栈'] },
        { title: 'Astro 静态站', summary: '内容优先的静态站点生成器，支持多框架', keywords: ['Astro', '静态', '内容'] },
      ],
      营销: [
        { title: '内容营销', summary: '通过博客、教程、案例分享建立专业形象', keywords: ['博客', '教程', 'SEO'] },
        { title: '社区运营', summary: '在 Reddit、Discord、论坛建立用户社区', keywords: ['社区', 'Discord', 'Reddit'] },
        { title: '产品猎人', summary: '在 Product Hunt、Hacker News 发布', keywords: ['Product Hunt', 'HN', '发布'] },
        { title: '联盟营销', summary: '与互补产品合作，互相推荐用户', keywords: ['联盟', '合作', '推荐'] },
        { title: '付费广告', summary: 'Google Ads、社交媒体广告精准投放', keywords: ['广告', 'Google', '投放'] },
        { title: '口碑传播', summary: '打磨产品体验，让用户自发推荐', keywords: ['口碑', '推荐', '体验'] },
      ],
      设计: [
        { title: '极简主义', summary: '去除一切非必要元素，聚焦核心功能', keywords: ['极简', '留白', '聚焦'] },
        { title: '卡片式布局', summary: '使用卡片组织信息，清晰的视觉层次', keywords: ['卡片', '层次', '组织'] },
        { title: '暗色模式', summary: '提供深色主题，减少眼睛疲劳', keywords: ['暗色', '护眼', '主题'] },
        { title: '动效设计', summary: '流畅的过渡动画，提升操作反馈', keywords: ['动效', '动画', '反馈'] },
        { title: '响应式设计', summary: '适配各种屏幕尺寸，移动端友好', keywords: ['响应式', '移动', '适配'] },
        { title: '无障碍设计', summary: '键盘导航、屏幕阅读器支持', keywords: ['无障碍', 'a11y', '键盘'] },
      ],
      数据: [
        { title: '本地存储', summary: '数据存储在用户设备，隐私优先', keywords: ['本地', 'IndexedDB', '隐私'] },
        { title: '云端同步', summary: '数据存储在云端，多设备同步', keywords: ['云端', '同步', '备份'] },
        { title: '混合存储', summary: '本地缓存 + 云端备份，兼顾性能和安全', keywords: ['混合', '缓存', '备份'] },
        { title: '实时协作', summary: '多人同时编辑，WebSocket 实时同步', keywords: ['协作', '实时', 'WebSocket'] },
        { title: '版本控制', summary: '类似 Git 的版本管理，支持回滚', keywords: ['版本', 'Git', '回滚'] },
        { title: '导入导出', summary: '支持多种格式导入导出，数据可迁移', keywords: ['导入', '导出', '迁移'] },
      ],
      商业: [
        { title: '免费增值', summary: '基础功能免费，高级功能付费', keywords: ['Freemium', '订阅', '付费'] },
        { title: '一次性买断', summary: '一次付费永久使用，无订阅负担', keywords: ['买断', '永久', '付费'] },
        { title: '企业授权', summary: '面向企业客户，提供定制和支持', keywords: ['企业', 'B2B', '授权'] },
        { title: '开源商业化', summary: '核心开源，提供托管服务和支持', keywords: ['开源', '托管', '服务'] },
        { title: '广告模式', summary: '免费使用，通过广告变现', keywords: ['广告', '免费', '变现'] },
        { title: '数据变现', summary: '匿名化数据分析和洞察服务', keywords: ['数据', '分析', '洞察'] },
      ],
    }

    const idea = input.idea.toLowerCase()

    // 根据关键词匹配模板
    let matched: Direction[] = []

    if (idea.includes('产品') || idea.includes('软件') || idea.includes('应用') || idea.includes('工具')) {
      matched = templates.产品
    } else if (idea.includes('技术') || idea.includes('框架') || idea.includes('架构') || idea.includes('选型')) {
      matched = templates.技术
    } else if (idea.includes('营销') || idea.includes('推广') || idea.includes('增长') || idea.includes('获客')) {
      matched = templates.营销
    } else if (idea.includes('设计') || idea.includes('UI') || idea.includes('界面') || idea.includes('交互')) {
      matched = templates.设计
    } else if (idea.includes('数据') || idea.includes('存储') || idea.includes('同步') || idea.includes('协作')) {
      matched = templates.数据
    } else if (idea.includes('商业') || idea.includes('变现') || idea.includes('盈利') || idea.includes('收费')) {
      matched = templates.商业
    } else {
      // 默认返回产品方向
      matched = templates.产品
    }

    // 如果有父上下文，生成更聚焦的子方向
    if (input.parentContext) {
      const { parentTitle, userOpinion } = input.parentContext

      // 根据父标题和用户意见生成子方向
      if (parentTitle.includes('桌面') || userOpinion.includes('Windows') || userOpinion.includes('Mac')) {
        return [
          { title: 'Electron 方案', summary: '使用 Electron 构建跨平台桌面应用，Web 技术栈', keywords: ['Electron', 'Chromium', 'Node.js'] },
          { title: 'Tauri 方案', summary: '使用 Tauri 构建轻量级桌面应用，Rust 后端', keywords: ['Tauri', 'Rust', '轻量'] },
          { title: '原生开发', summary: '使用 C#/Swift 开发原生应用，性能最优', keywords: ['原生', 'C#', 'Swift'] },
          { title: 'Flutter Desktop', summary: '使用 Flutter 构建桌面应用，跨平台 UI', keywords: ['Flutter', 'Dart', '跨平台'] },
          { title: 'Qt 方案', summary: '使用 Qt 框架，C++ 开发，成熟稳定', keywords: ['Qt', 'C++', '成熟'] },
        ]
      }

      if (parentTitle.includes('Web') || userOpinion.includes('浏览器') || userOpinion.includes('在线')) {
        return [
          { title: 'React SPA', summary: '单页应用，客户端渲染，交互流畅', keywords: ['React', 'SPA', 'CSR'] },
          { title: 'Next.js SSR', summary: '服务端渲染，SEO 友好，首屏快', keywords: ['Next.js', 'SSR', 'SEO'] },
          { title: 'PWA 方案', summary: '渐进式 Web 应用，可离线使用', keywords: ['PWA', '离线', 'Service Worker'] },
          { title: 'Remix 全栈', summary: 'Web 标准优先，嵌套路由，数据加载', keywords: ['Remix', 'Web标准', '全栈'] },
          { title: 'Astro 静态', summary: '静态生成，性能极致，按需加载', keywords: ['Astro', '静态', '性能'] },
        ]
      }

      // 默认子方向
      return [
        { title: '技术实现路径', summary: '选择合适的技术栈和架构方案', keywords: ['技术', '架构', '实现'] },
        { title: '用户体验设计', summary: '设计直观易用的交互流程', keywords: ['UX', '交互', '设计'] },
        { title: '数据存储方案', summary: '确定数据如何存储和同步', keywords: ['数据', '存储', '同步'] },
        { title: '商业化策略', summary: '探索可持续的商业模式', keywords: ['商业', '变现', '策略'] },
      ]
    }

    // 返回 5-8 个方向
    const count = 5 + Math.floor(Math.random() * 4)
    return matched.slice(0, count)
  }
}
