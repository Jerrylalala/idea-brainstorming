import type { SessionItem } from '@/types/session';

export const mockSessions: SessionItem[] = [
    {
        id: 's1',
        title: 'New chat',
        time: '7m',
        group: 'TODAY',
        isActive: true,
    },
    {
        id: 's2',
        title: '你好，你是当前是什么模型？',
        time: '13h',
        group: 'YESTERDAY',
    },
    {
        id: 's3',
        title: '你当前我想做一个设计营销方案',
        time: '13h',
        group: 'YESTERDAY',
    },
    {
        id: 's4',
        title: '你好，你是当前是什么模型？',
        time: '13h',
        group: 'YESTERDAY',
    },
    {
        id: 's5',
        title: 'AI 模型身份',
        time: '13h',
        group: 'YESTERDAY',
    },
];