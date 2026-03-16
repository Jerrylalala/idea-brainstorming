export interface SuggestionNode {
    id: string;
    title: string;
    desc: string;
    top: number;
    color: string;
}

export const mockSuggestionNodes: SuggestionNode[] = [
    {
        id: 'n1',
        title: '通常完成这个功能的方法',
        desc: '先拆常规路线和最小 MVP。',
        top: 22,
        color: '#60a5fa',
    },
    {
        id: 'n2',
        title: '你想使用 Web 还是 App？',
        desc: '先确定首版形态，再谈后续封装。',
        top: 39,
        color: '#8b5cf6',
    },
    {
        id: 'n3',
        title: '具体是什么样式的？',
        desc: '确定展示方式、布局和交互重心。',
        top: 58,
        color: '#22c55e',
    },
    {
        id: 'n4',
        title: '对什么有没有要求？',
        desc: '收集偏好、约束、技术边界。',
        top: 77,
        color: '#f59e0b',
    },
];