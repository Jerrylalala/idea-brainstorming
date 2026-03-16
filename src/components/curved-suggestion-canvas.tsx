import { useRef, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { SearchSeedNode } from '@/components/search-seed-node';
import { mockSuggestionNodes } from '@/data/mock-suggestion-nodes';

// 曲线连接的方案节点画布
export function CurvedSuggestionCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const seedRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);

  // 存储计算后的 SVG 路径
  const [paths, setPaths] = useState<{ id: string; d: string; color: string }[]>([]);

  const updatePaths = useCallback(() => {
    const container = containerRef.current;
    const seed = seedRef.current;
    if (!container || !seed) return;

    const containerRect = container.getBoundingClientRect();
    const seedRect = seed.getBoundingClientRect();

    // 曲线起点：搜索节点的右侧中心
    const startX = seedRect.right - containerRect.left;
    const startY = seedRect.top + seedRect.height / 2 - containerRect.top;

    const newPaths = mockSuggestionNodes.map((node, index) => {
      const nodeEl = nodeRefs.current[index];
      if (!nodeEl) return { id: node.id, d: '', color: node.color };

      const nodeRect = nodeEl.getBoundingClientRect();
      // 曲线终点：方案节点的左侧中心
      const endX = nodeRect.left - containerRect.left;
      const endY = nodeRect.top + nodeRect.height / 2 - containerRect.top;

      // 贝塞尔控制点：水平方向上 1/3 和 2/3 处
      const dx = endX - startX;
      const c1x = startX + dx * 0.35;
      const c1y = startY;
      const c2x = startX + dx * 0.65;
      const c2y = endY;

      return {
        id: node.id,
        d: `M ${startX} ${startY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${endX} ${endY}`,
        color: node.color,
      };
    });

    setPaths(newPaths);
  }, []);

  useEffect(() => {
    // 初次渲染后计算路径
    const timer = setTimeout(updatePaths, 100);

    // 窗口大小变化时重新计算
    window.addEventListener('resize', updatePaths);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePaths);
    };
  }, [updatePaths]);

  return (
    <div
      ref={containerRef}
      className="relative h-full overflow-hidden bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.10),transparent_28%),linear-gradient(180deg,#fbfdff,#f4f7fb)]"
    >
      {/* 搜索起始节点 - 垂直居中，水平偏左 */}
      <div ref={seedRef} className="absolute left-[6%] top-1/2 -translate-y-1/2">
        <SearchSeedNode />
      </div>

      {/* 曲线连接线 */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        {paths.map((p) =>
          p.d ? (
            <path
              key={p.id}
              d={p.d}
              fill="none"
              stroke={p.color}
              strokeOpacity="0.92"
              strokeWidth="3"
              strokeLinecap="round"
            />
          ) : null
        )}
      </svg>

      {/* 方案建议节点 - 右侧均匀分布 */}
      {mockSuggestionNodes.map((node, index) => (
        <motion.div
          key={node.id}
          ref={(el) => { nodeRefs.current[index] = el; }}
          whileHover={{ y: -3 }}
          className="absolute right-[4%]"
          style={{ top: `${node.top}%`, transform: `translateY(-50%)` }}
        >
          <div className="w-[250px] rounded-[24px] border bg-white/94 p-2.5 shadow-[0_14px_36px_rgba(15,23,42,0.08)]">
            <div className="rounded-[18px] border border-slate-100 bg-slate-50/70 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[13px] font-medium text-slate-800">{node.title}</div>
                  <div className="mt-1 text-[11px] leading-5 text-slate-500">{node.desc}</div>
                </div>
                <div className="mt-1 h-2.5 w-2.5 rounded-full" style={{ background: node.color }} />
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-2 px-1">
              <Badge variant="secondary" className="rounded-xl px-2 py-0.5 text-[10px]">继续聊</Badge>
              <Badge variant="secondary" className="rounded-xl px-2 py-0.5 text-[10px]">采纳</Badge>
              <Badge variant="secondary" className="rounded-xl px-2 py-0.5 text-[10px]">展开</Badge>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
