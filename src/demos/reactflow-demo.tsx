import { useState, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Connection,
  type NodeProps,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// 文本笔记卡片节点
function NoteNode({ data }: NodeProps) {
  const d = data as { label: string; content: string };
  return (
    <div className="w-[320px] rounded-xl border border-slate-200 bg-white shadow-md">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-xs font-medium text-slate-500">{d.label}</span>
        </div>
        <span className="text-[10px] text-slate-400">📝</span>
      </div>
      <div className="p-4 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
        {d.content}
      </div>
      <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-2">
        <button className="rounded-lg bg-slate-100 px-3 py-1 text-[11px] text-slate-600 hover:bg-slate-200">
          展开笔记
        </button>
        <button className="rounded-lg bg-slate-100 px-3 py-1 text-[11px] text-slate-600 hover:bg-slate-200">
          新建对话
        </button>
      </div>
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-2 !border-white !bg-slate-400" />
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-2 !border-white !bg-emerald-500" />
    </div>
  );
}

// 对话卡片节点
function ChatNode({ data }: NodeProps) {
  const d = data as { label: string; messages: { role: string; text: string }[] };

  return (
    <div className="w-[340px] rounded-xl border border-slate-200 bg-white shadow-md">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-blue-400" />
          <span className="text-xs font-medium text-slate-500">{d.label}</span>
        </div>
        <span className="text-[10px] text-slate-400">💬</span>
      </div>

      <div className="max-h-[280px] overflow-y-auto p-3">
        {d.messages.map((msg: { role: string; text: string }, i: number) => (
          <div key={i} className={`mb-2 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
            <div
              className={`inline-block max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-5 whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="flex-1 text-xs text-slate-400">输入消息...</span>
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px]">
            ➤
          </div>
        </div>
      </div>

      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-2 !border-white !bg-slate-400" />
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-2 !border-white !bg-blue-500" />
    </div>
  );
}

const nodeTypes = { note: NoteNode, chat: ChatNode };

const initialNodes = [
  {
    id: 'note-1',
    type: 'note' as const,
    position: { x: 100, y: 200 },
    data: {
      label: 'New Note',
      content: '你去研究一下顶级CEO的方法论，如何做好CEO，顶级的管理模式。研究好以md模式文档结算',
    },
  },
  {
    id: 'chat-1',
    type: 'chat' as const,
    position: { x: 550, y: 80 },
    data: {
      label: '引用自「New Note」',
      messages: [
        { role: 'user', text: '阅读文档并开始任务' },
        { role: 'ai', text: '好的，我来研究顶级CEO的方法论...\n\n人才管理与激励：\n• 重视人才的招聘、培养和留用\n• 建立公平的绩效管理机制\n\n创新与变革管理：\n• 鼓励创新思维...' },
      ],
    },
  },
  {
    id: 'note-2',
    type: 'note' as const,
    position: { x: 1020, y: 60 },
    data: {
      label: 'CEO 方法论',
      content: '效率与成本控制：\n寻找并实施各种方法来提高运营效率。\n\n团队管理与文化建设：\n激励和管理运营部门的员工...',
    },
  },
  {
    id: 'chat-2',
    type: 'chat' as const,
    position: { x: 550, y: 420 },
    data: {
      label: '分支对话 B',
      messages: [
        { role: 'user', text: '今天星期几' },
        { role: 'ai', text: '今天是星期四。' },
      ],
    },
  },
  {
    id: 'chat-3',
    type: 'chat' as const,
    position: { x: 1020, y: 380 },
    data: {
      label: '引用「风险管理」',
      messages: [
        { role: 'user', text: '选中部分：「风险管理」\n请解释这个概念' },
        { role: 'ai', text: '风险管理是识别、评估和控制潜在风险的系统化过程...' },
      ],
    },
  },
];

const initialEdges = [
  { id: 'e1', source: 'note-1', target: 'chat-1', animated: true, style: { stroke: '#10b981', strokeWidth: 2 } },
  { id: 'e2', source: 'chat-1', target: 'note-2', animated: true, style: { stroke: '#3b82f6', strokeWidth: 2 } },
  { id: 'e3', source: 'note-1', target: 'chat-2', animated: true, style: { stroke: '#10b981', strokeWidth: 2 } },
  { id: 'e4', source: 'note-2', target: 'chat-3', animated: true, style: { stroke: '#10b981', strokeWidth: 2 } },
];

export function ReactFlowDemo() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#10b981', strokeWidth: 2 } }, eds)),
    [setEdges]
  );

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        className="bg-slate-50"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d1d5db" />
        <Controls className="!rounded-xl !border-slate-200 !shadow-md" />
        <MiniMap className="!rounded-xl !border-slate-200 !shadow-md" />
      </ReactFlow>
    </div>
  );
}
