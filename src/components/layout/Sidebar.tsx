import React from 'react';
import {
  CalendarDays,
  Clock,
  Users,
  UserCheck,
  BookOpen,
  FolderArchive,
  FileText,
  MessageSquare,
  Settings,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
} from 'lucide-react';
import clsx from 'clsx';

export type ActiveTab =
  | 'week'
  | 'schedule'
  | 'students'
  | 'trials'
  | 'lessons'
  | 'library'
  | 'reports'
  | 'templates'
  | 'settings';

interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  pendingSyncCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  isCollapsed,
  onToggleCollapse,
  pendingSyncCount = 0,
}) => {
  const navItems = [
    {
      id: 'week' as ActiveTab,
      label: 'Cette Semaine',
      sublabel: 'This Week',
      icon: CalendarDays,
    },
    {
      id: 'schedule' as ActiveTab,
      label: 'Planning',
      sublabel: 'Schedule & Timezones',
      icon: Clock,
    },
    {
      id: 'students' as ActiveTab,
      label: 'Élèves',
      sublabel: 'Regular Students',
      icon: Users,
    },
    {
      id: 'trials' as ActiveTab,
      label: 'Cours d’essai',
      sublabel: 'Trial Students',
      icon: UserCheck,
    },
    {
      id: 'lessons' as ActiveTab,
      label: 'Préparation',
      sublabel: 'Lesson Planner',
      icon: BookOpen,
    },
    {
      id: 'library' as ActiveTab,
      label: 'Bibliothèque',
      sublabel: 'Exercises & Archives',
      icon: FolderArchive,
    },
    {
      id: 'reports' as ActiveTab,
      label: 'Rapports',
      sublabel: 'Monthly & Quarterly',
      icon: FileText,
    },
    {
      id: 'templates' as ActiveTab,
      label: 'Modèles',
      sublabel: 'Message Templates',
      icon: MessageSquare,
    },
    {
      id: 'settings' as ActiveTab,
      label: 'Paramètres',
      sublabel: 'Settings & Sync',
      icon: Settings,
    },
  ];

  return (
    <aside
      className={clsx(
        'h-screen sticky top-0 flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-200 z-30 select-none shadow-sm',
        isCollapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border shrink-0">
        <div
          className="flex items-center gap-3 cursor-pointer overflow-hidden"
          onClick={() => onTabChange('week')}
        >
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shrink-0 font-black shadow-md shadow-primary/20 glow-primary-sm">
            <GraduationCap size={22} className="text-primary-foreground" />
          </div>
          {!isCollapsed && (
            <div className="leading-tight truncate">
              <div className="flex items-center gap-1.5 font-bold text-base text-foreground">
                <span>ProfPlan</span>
                <span className="text-primary text-[10px] font-mono font-extrabold bg-primary/15 px-1.5 py-0.5 rounded border border-primary/30">
                  AI
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">Preply French Tutor</p>
            </div>
          )}
        </div>

        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors hidden md:flex items-center justify-center cursor-pointer"
          title={isCollapsed ? 'Agrandir le menu' : 'Réduire le menu'}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              title={isCollapsed ? `${item.label} (${item.sublabel})` : undefined}
              className={clsx(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group min-h-touch relative cursor-pointer',
                isActive
                  ? 'bg-primary/10 text-primary font-bold border border-primary/25 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent'
              )}
            >
              <Icon
                size={19}
                className={clsx(
                  'shrink-0 transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                )}
              />

              {!isCollapsed && (
                <div className="flex-1 truncate">
                  <div className="text-sm truncate leading-tight font-medium">{item.label}</div>
                  <div
                    className={clsx(
                      'text-[10px] truncate leading-none mt-0.5',
                      isActive ? 'text-primary/80 font-normal' : 'text-muted-foreground/75'
                    )}
                  >
                    {item.sublabel}
                  </div>
                </div>
              )}

              {item.id === 'settings' && pendingSyncCount > 0 && (
                <span
                  className={clsx(
                    'w-2 h-2 rounded-full bg-primary animate-pulse shrink-0',
                    isCollapsed ? 'absolute top-2 right-2' : ''
                  )}
                  title={`${pendingSyncCount} modifications en attente de synchronisation`}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Status */}
      <div className="p-3 border-t border-sidebar-border shrink-0">
        <div
          className={clsx(
            'flex items-center gap-2.5 px-3 py-2 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground',
            isCollapsed ? 'justify-center' : ''
          )}
        >
          <div className="w-2 h-2 rounded-full bg-chart-3 shrink-0" title="Stockage local actif (IndexedDB)" />
          {!isCollapsed && (
            <div className="truncate">
              <span className="font-semibold text-foreground text-xs">100% Hors-ligne</span>
              <p className="text-[10px] text-muted-foreground truncate">Données privées sur PC</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
