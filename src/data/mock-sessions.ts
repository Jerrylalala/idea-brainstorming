import type { SessionItem } from '@/types/session';

const now = new Date()
const yesterday = new Date(now)
yesterday.setDate(now.getDate() - 1)
yesterday.setHours(10, 0, 0, 0)

export const mockSessions: SessionItem[] = [
    {
        id: 's1',
        title: 'New chat',
        createdAt: new Date(now.getTime() - 7 * 60 * 1000).toISOString(), // 7 分钟前
        time: '7m',
        status: 'todo',
    },
    {
        id: 's2',
        title: '你好，你是当前是什么模型？',
        createdAt: new Date(yesterday.getTime()).toISOString(),
        time: '13h',
        status: 'done',
    },
    {
        id: 's3',
        title: '你当前我想做一个设计营销方案',
        createdAt: new Date(yesterday.getTime() - 30 * 60 * 1000).toISOString(),
        time: '13h',
        status: 'needs-review',
    },
    {
        id: 's4',
        title: '你好，你是当前是什么模型？',
        createdAt: new Date(yesterday.getTime() - 60 * 60 * 1000).toISOString(),
        time: '13h',
        status: 'backlog',
    },
    {
        id: 's5',
        title: 'AI 模型身份',
        createdAt: new Date(yesterday.getTime() - 90 * 60 * 1000).toISOString(),
        time: '13h',
        status: 'archived',
    },
];
