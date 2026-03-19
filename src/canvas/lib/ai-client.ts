import { useAIConnectionStore } from './ai-config-store'
import type { AIClient } from '../types'

// Proxy 透明转发：所有方法调用转给 store 中当前最新的 client 实例
// canvas-store.ts 中 import { aiClient } 的写法完全不需要改动
export const aiClient: AIClient = new Proxy({} as AIClient, {
  get(_target, prop: string) {
    const client = useAIConnectionStore.getState().client
    return (client as unknown as Record<string, unknown>)[prop]
  },
})
