import type { AIClient, ChatRequest, ChatChunk } from '../types'

const MOCK_RESPONSES = [
  '这是一个很好的思路。让我从几个角度来分析：\n\n1. **可行性**：技术上完全可以实现，建议先从最小闭环开始。\n2. **优先级**：核心功能优先，装饰性功能后置。\n3. **风险**：主要风险在于范围蔓延，建议严格控制 MVP 边界。',
  '我注意到你提到的这个需求有几个值得深入探讨的方向：\n\n- **用户场景**：谁会用这个功能？在什么场景下用？\n- **已有方案**：市场上有没有类似的解决方案可以参考？\n- **差异点**：我们的方案和现有方案的核心差异是什么？',
  '这是一个有趣的想法。让我帮你理清思路：\n\n首先，这个功能的核心价值在于帮助用户快速发散和收敛想法。\n\n其次，实现上可以分三步走：\n1. 先做基础的输入和展示\n2. 再做智能关联和建议\n3. 最后做结构化输出和沉淀',
]

export class MockAIClient implements AIClient {
  async *streamChat(_input: ChatRequest): AsyncGenerator<ChatChunk> {
    const response = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)]
    const chars = [...response]

    for (const char of chars) {
      await new Promise((r) => setTimeout(r, 15 + Math.random() * 25))
      yield { type: 'delta', text: char }
    }

    yield { type: 'done' }
  }
}
