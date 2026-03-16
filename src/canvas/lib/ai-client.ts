import type { AIClient } from '../types'
import { MockAIClient } from './mock-ai'

// 统一入口：替换真实 AI 时只需改这里
export const aiClient: AIClient = new MockAIClient()
