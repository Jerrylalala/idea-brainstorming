import type { DecisionItem } from '@/types/decision';

export const mockDecisions: DecisionItem[] = [
    {
        id: 'd1',
        category: 'confirmed',
        content: '默认关闭首页入口，启动后直接进入 Workspace / Sessions。',
    },
    {
        id: 'd2',
        category: 'confirmed',
        content: '顶部保留 Craft 风格全局栏，不把 toggle 放进左侧。',
    },
    {
        id: 'd3',
        category: 'confirmed',
        content: '主区采用“搜索起步 → 向右生长方案节点”的交互。',
    },
    {
        id: 'd4',
        category: 'pending',
        content: 'All Sessions 的分组是否要支持折叠。',
    },
    {
        id: 'd5',
        category: 'pending',
        content: '首次输入后是否自动创建新 Session。',
    },
    {
        id: 'd6',
        category: 'preference',
        content: '左栏只保留 All Sessions / Labels / Settings。',
    },
    {
        id: 'd7',
        category: 'preference',
        content: 'New Session 放在左栏顶部。',
    },
    {
        id: 'd8',
        category: 'preference',
        content: '整体尺寸偏紧凑，接近 Craft。',
    },
    {
        id: 'd9',
        category: 'risk',
        content: '过度复刻 Craft 会削弱自己的产品辨识度。',
    },
    {
        id: 'd10',
        category: 'risk',
        content: '节点过多时主区会变乱，需要后续加聚焦模式。',
    },
    {
        id: 'd11',
        category: 'next',
        content: '先把这份原型接进真实 React 项目。',
    },
    {
        id: 'd12',
        category: 'next',
        content: '再替换假数据为 Zustand / API 状态。',
    },
    {
        id: 'd13',
        category: 'next',
        content: '最后接入真正的节点交互和导出能力。',
    },
];