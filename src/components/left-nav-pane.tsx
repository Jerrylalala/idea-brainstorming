import { motion } from 'framer-motion';
import { Plus, Folder, Pin, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store/ui-store';
import { useSessionStore } from '@/store/session-store';
import { mockNavGroups } from '@/data/mock-nav-groups';

// 左侧导航栏：New Session + All Sessions / Labels / Settings
export function LeftNavPane() {
  const leftCollapsed = useUIStore((s) => s.leftCollapsed);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const createSession = useSessionStore((s) => s.createSession);

  // 标题对应的图标
  const titleIcon: Record<string, React.ComponentType<{ className?: string }>> = {
    'All Sessions': Folder,
    Labels: Pin,
    Settings: Settings,
  };

  return (
    <motion.aside
      animate={{ width: leftCollapsed ? 0 : 220, opacity: leftCollapsed ? 0 : 1 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden border-r bg-[#f5f7f8]"
    >
      <div className="flex h-full flex-col">
        <div className="px-3 pb-3 pt-3">
          <Button
            className="h-9 w-full justify-start rounded-xl bg-white px-3 text-slate-800 shadow-sm hover:bg-white"
            variant="outline"
            onClick={createSession}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Session
          </Button>
        </div>

        <ScrollArea className="h-[calc(100vh-92px)] px-2">
          <div className="space-y-4 pb-6">
            {mockNavGroups.map((group) => {
              const TitleIcon = titleIcon[group.title];
              const isActive = group.title === 'All Sessions';
              const action = group.title === 'Settings' ? () => setSettingsOpen(true) : undefined;
              return (
                <div key={group.title}>
                  <button
                    className={cn(
                      'flex h-9 w-full items-center rounded-xl px-3 text-sm text-slate-700',
                      isActive && 'bg-slate-200/80',
                      action && 'hover:bg-slate-200/60 cursor-pointer'
                    )}
                    onClick={action}
                  >
                    {TitleIcon && <TitleIcon className="mr-2 h-4 w-4 text-slate-500" />}
                    <span>{group.title}</span>
                  </button>

                  {group.items.length > 0 && (
                    <div className="mt-1 space-y-1 pl-4">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.label}
                            className="flex h-8 w-full items-center gap-2 rounded-lg px-3 text-left text-sm text-slate-700 hover:bg-slate-200/60"
                          >
                            <Icon className={cn('h-3.5 w-3.5', item.color)} />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </motion.aside>
  );
}
