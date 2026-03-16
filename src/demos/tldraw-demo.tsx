// @ts-nocheck
import { useEffect, useRef } from 'react';
import 'tldraw/tldraw.css';
import { Tldraw, useEditor, createShapeId, toRichText } from 'tldraw';

// 辅助：创建 text shape props（tldraw v4 使用 richText）
function textProps(text: string, size = 's', color = 'black') {
  return { richText: toRichText(text), size, color, autoSize: true };
}

// 在画布内创建初始卡片
function CanvasContent() {
  const editor = useEditor();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const noteId1 = createShapeId('note-1');
    const chatId1 = createShapeId('chat-1');
    const noteId2 = createShapeId('note-2');
    const chatId2 = createShapeId('chat-2');

    // 笔记卡片 1
    editor.createShapes([
      {
        id: noteId1,
        type: 'geo',
        x: 200, y: 300,
        props: { w: 320, h: 220, color: 'light-green', fill: 'solid', dash: 'draw', size: 'm', geo: 'rectangle' },
      },
      {
        id: createShapeId('note-1-title'),
        type: 'text',
        x: 216, y: 312,
        props: textProps('📝 New Note', 's', 'grey'),
      },
      {
        id: createShapeId('note-1-content'),
        type: 'text',
        x: 216, y: 350,
        props: textProps('你去研究一下顶级CEO的方法论，\n如何做好CEO，顶级的管理模式。\n研究好以md模式文档结算'),
      },
    ]);

    // 对话卡片 1
    editor.createShapes([
      {
        id: chatId1,
        type: 'geo',
        x: 650, y: 220,
        props: { w: 340, h: 300, color: 'light-blue', fill: 'solid', dash: 'draw', size: 'm', geo: 'rectangle' },
      },
      {
        id: createShapeId('chat-1-title'),
        type: 'text',
        x: 666, y: 232,
        props: textProps('💬 引用自「New Note」', 's', 'grey'),
      },
      {
        id: createShapeId('chat-1-user'),
        type: 'text',
        x: 780, y: 280,
        props: textProps('阅读文档并开始任务'),
      },
      {
        id: createShapeId('chat-1-ai'),
        type: 'text',
        x: 666, y: 320,
        props: textProps('好的，我来研究顶级CEO的方法论...\n\n人才管理与激励：\n• 重视人才的招聘、培养和留用\n• 建立公平的绩效管理机制'),
      },
    ]);

    // 笔记卡片 2
    editor.createShapes([
      {
        id: noteId2,
        type: 'geo',
        x: 1120, y: 200,
        props: { w: 320, h: 260, color: 'light-green', fill: 'solid', dash: 'draw', size: 'm', geo: 'rectangle' },
      },
      {
        id: createShapeId('note-2-title'),
        type: 'text',
        x: 1136, y: 212,
        props: textProps('📝 CEO 方法论', 's', 'grey'),
      },
      {
        id: createShapeId('note-2-content'),
        type: 'text',
        x: 1136, y: 250,
        props: textProps('效率与成本控制：\n寻找并实施各种方法来提高运营效率。\n\n团队管理与文化建设：\n激励和管理运营部门的员工...'),
      },
    ]);

    // 分支对话卡片
    editor.createShapes([
      {
        id: chatId2,
        type: 'geo',
        x: 650, y: 580,
        props: { w: 340, h: 180, color: 'light-blue', fill: 'solid', dash: 'draw', size: 'm', geo: 'rectangle' },
      },
      {
        id: createShapeId('chat-2-title'),
        type: 'text',
        x: 666, y: 592,
        props: textProps('💬 分支对话 B', 's', 'grey'),
      },
      {
        id: createShapeId('chat-2-user'),
        type: 'text',
        x: 800, y: 640,
        props: textProps('今天星期几'),
      },
      {
        id: createShapeId('chat-2-ai'),
        type: 'text',
        x: 666, y: 680,
        props: textProps('今天是星期四。'),
      },
    ]);

    // 箭头连接
    const arrow1Id = createShapeId('arrow-1');
    const arrow2Id = createShapeId('arrow-2');
    const arrow3Id = createShapeId('arrow-3');

    editor.createShapes([
      { id: arrow1Id, type: 'arrow', props: { color: 'green', size: 'm', start: { x: 520, y: 410 }, end: { x: 650, y: 370 } } },
      { id: arrow2Id, type: 'arrow', props: { color: 'blue', size: 'm', start: { x: 990, y: 370 }, end: { x: 1120, y: 330 } } },
      { id: arrow3Id, type: 'arrow', props: { color: 'green', size: 'm', start: { x: 520, y: 450 }, end: { x: 650, y: 670 } } },
    ]);

    // 绑定箭头到卡片
    editor.createBindings([
      { type: 'arrow', fromId: arrow1Id, toId: noteId1, props: { terminal: 'start', normalizedAnchor: { x: 1, y: 0.5 }, isExact: false, isPrecise: false } },
      { type: 'arrow', fromId: arrow1Id, toId: chatId1, props: { terminal: 'end', normalizedAnchor: { x: 0, y: 0.5 }, isExact: false, isPrecise: false } },
      { type: 'arrow', fromId: arrow2Id, toId: chatId1, props: { terminal: 'start', normalizedAnchor: { x: 1, y: 0.5 }, isExact: false, isPrecise: false } },
      { type: 'arrow', fromId: arrow2Id, toId: noteId2, props: { terminal: 'end', normalizedAnchor: { x: 0, y: 0.5 }, isExact: false, isPrecise: false } },
      { type: 'arrow', fromId: arrow3Id, toId: noteId1, props: { terminal: 'start', normalizedAnchor: { x: 1, y: 0.8 }, isExact: false, isPrecise: false } },
      { type: 'arrow', fromId: arrow3Id, toId: chatId2, props: { terminal: 'end', normalizedAnchor: { x: 0, y: 0.3 }, isExact: false, isPrecise: false } },
    ]);

    setTimeout(() => editor.zoomToFit(), 300);
  }, [editor]);

  return null;
}

export function TldrawDemo() {
  return (
    <div className="h-full w-full">
      <Tldraw>
        <CanvasContent />
      </Tldraw>
    </div>
  );
}
