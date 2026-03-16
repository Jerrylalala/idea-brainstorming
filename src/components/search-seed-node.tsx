import { motion } from 'framer-motion';
import { Search, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

// 蓝色搜索式起始节点
export function SearchSeedNode() {
  return (
    <motion.div
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="w-[460px] rounded-[28px] border border-sky-200/70 bg-[linear-gradient(135deg,rgba(96,165,250,0.20),rgba(59,130,246,0.08),rgba(255,255,255,0.95))] p-2.5 shadow-[0_16px_50px_rgba(59,130,246,0.18)]"
    >
      <div className="flex items-center gap-3 rounded-[22px] bg-white/85 px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600">
          <Search className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-slate-800">我想完成一个创意探索工具</div>
          <div className="text-[11px] text-slate-500">
            先像搜索栏一样输入，再让系统向右生长出可选方案。
          </div>
        </div>
        <Button className="h-8 rounded-xl px-3 text-xs">
          <Send className="mr-1.5 h-3.5 w-3.5" />
          发散
        </Button>
      </div>
    </motion.div>
  );
}
