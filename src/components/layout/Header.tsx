import React, { useState, useEffect } from 'react';
import {
  Cloud,
  CloudOff,
  RefreshCw,
  AlertTriangle,
  Sparkles,
  Plus,
  Sun,
  Moon,
  Lock,
} from 'lucide-react';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';

interface HeaderProps {
  pageTitle: string;
  pageSubtitle?: string;
  pendingSyncCount?: number;
  oldestUnsyncedDays?: number;
  onSyncNow?: () => void;
  isSyncing?: boolean;
  onOpenPromptHelper?: () => void;
  onNewLesson?: () => void;
  onLockScreen?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  pageTitle,
  pageSubtitle,
  pendingSyncCount = 0,
  oldestUnsyncedDays = 0,
  onSyncNow,
  isSyncing = false,
  onOpenPromptHelper,
  onNewLesson,
  onLockScreen,
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return document.documentElement.classList.contains('dark');
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('profplan_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('profplan_theme', 'light');
    }
  };

  return (
    <header className="h-16 px-6 md:px-8 bg-card/80 backdrop-blur-md border-b border-border flex items-center justify-between sticky top-0 z-20">
      {/* Title & context */}
      <div className="flex flex-col justify-center min-w-0">
        <h1 className="text-lg md:text-xl font-extrabold text-foreground tracking-tight truncate flex items-center gap-2">
          {pageTitle}
        </h1>
        {pageSubtitle && (
          <p className="text-xs text-muted-foreground truncate hidden sm:block">
            {pageSubtitle}
          </p>
        )}
      </div>

      {/* Sync Status & Action Bar */}
      <div className="flex items-center gap-2.5">
        {/* Warning if unsynced changes older than 7 days */}
        {oldestUnsyncedDays > 7 && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-medium cursor-help"
            title={`Attention : vos modifications locales n'ont pas été sauvegardées sur Google Drive depuis ${oldestUnsyncedDays} jours.`}
          >
            <AlertTriangle size={14} className="shrink-0" />
            <span className="hidden lg:inline">{oldestUnsyncedDays}j non sync</span>
          </div>
        )}

        {/* Pending Sync Badge (only when changes exist) */}
        {pendingSyncCount > 0 && (
          <Badge variant="yellow" size="sm" className="hidden sm:inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
            <span>{pendingSyncCount} en attente</span>
          </Badge>
        )}

        {/* Online / Offline status badge */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-muted/60 border border-border"
          title={isOnline ? 'Connecté à Internet' : 'Mode Hors-ligne (IndexedDB actif)'}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isOnline ? 'bg-chart-3' : 'bg-amber-400 animate-pulse'
            }`}
          />
          <span className="text-muted-foreground font-medium text-[11px] hidden md:inline">
            {isOnline ? 'En ligne' : 'Hors-ligne'}
          </span>
        </div>

        {/* Screen Lock Button */}
        {onLockScreen && (
          <button
            onClick={onLockScreen}
            className="w-9 h-9 rounded-xl text-muted-foreground hover:text-primary hover:bg-muted border border-border transition-colors flex items-center justify-center cursor-pointer shadow-sm"
            title="Verrouiller l'écran (protection confidentialité)"
            aria-label="Verrouiller l'écran"
          >
            <Lock size={15} />
          </button>
        )}

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="w-9 h-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-colors flex items-center justify-center cursor-pointer shadow-sm"
          title={isDarkMode ? 'Passer en mode clair' : 'Passer en mode sombre'}
          aria-label="Basculer le thème"
        >
          {isDarkMode ? (
            <Sun size={16} className="text-primary" />
          ) : (
            <Moon size={16} className="text-foreground" />
          )}
        </button>

        {/* Copy Prompt Helper button */}
        {onOpenPromptHelper && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenPromptHelper}
            icon={<Sparkles size={14} className="text-primary" />}
            className="hidden sm:inline-flex h-9 text-xs"
          >
            Prompt Helper
          </Button>
        )}

        {/* New Lesson Quick Action */}
        {onNewLesson && (
          <Button
            variant="primary"
            size="sm"
            onClick={onNewLesson}
            icon={<Plus size={16} />}
            className="h-9 px-3.5 text-xs font-bold"
          >
            <span>Nouveau Cours</span>
          </Button>
        )}
      </div>
    </header>
  );
};
