import type { AIClient, ChatRequest, ChatChunk } from '../types'

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
}
