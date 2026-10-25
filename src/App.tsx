import React, { useState, useEffect } from 'react';
import { Sidebar, ActiveTab } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { PromptHelperModal } from './components/common/PromptHelperModal';
import { ConflictModal } from './components/common/ConflictModal';
import { ScreenLockModal } from './components/common/ScreenLockModal';
import { LoginView } from './components/auth/LoginView';
import { WeekView } from './views/WeekView';
import { ScheduleView } from './views/ScheduleView';
import { StudentsView } from './views/StudentsView';
import { TrialsView } from './views/TrialsView';
import { LessonPlannerView } from './views/LessonPlannerView';
import { LibraryView } from './views/LibraryView';
import { ReportsView } from './views/ReportsView';
import { TemplatesView } from './views/TemplatesView';
import { SettingsView } from './views/SettingsView';
import { db, initializeDatabaseSeed } from './db';
import { useLiveQuery } from 'dexie-react-hooks';
import { RecordConflict } from './types';
import { performDriveSync, getDriveAccessToken } from './utils/driveSync';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('week');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('profplan_sidebar_collapsed') === 'true';
  });

  // Target navigation IDs
  const [targetStudentId, setTargetStudentId] = useState<string | undefined>(undefined);
  const [targetLessonId, setTargetLessonId] = useState<string | undefined>(undefined);
  const [targetTemplateCategory, setTargetTemplateCategory] = useState<string | undefined>(undefined);

  // Prompt Helper Modal state
  const [isPromptHelperOpen, setIsPromptHelperOpen] = useState(false);
  const [promptHelperStudentId, setPromptHelperStudentId] = useState<string | undefined>(undefined);

  // Live queries for header indicators
  const unsyncedMutations = useLiveQuery(() => db.mutations.filter((m) => !m.synced).toArray()) || [];
  const pendingSyncCount = unsyncedMutations.length;

  // Calculate oldest unsynced change in days (PRD Section 3.2: "Warn visibly when unsynced changes are older than 7 days")
  const oldestMutation = unsyncedMutations.length > 0 ? unsyncedMutations[0] : null;
  const oldestDays = oldestMutation
    ? Math.floor((Date.now() - new Date(oldestMutation.timestamp).getTime()) / (1000 * 3600 * 24))
    : 0;

  // Settings & Security
  const settings = useLiveQuery(() => db.settings.get('current'));
  const [isScreenLocked, setIsScreenLocked] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [activeConflict, setActiveConflict] = useState<RecordConflict | null>(null);

  // Master Password Authentication Gate
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('profplan_session_auth') === 'true';
  });

  const handleLogout = () => {
    sessionStorage.removeItem('profplan_session_auth');
    setIsAuthenticated(false);
  };

  // Initialize DB seed on start and set theme
  useEffect(() => {
    initializeDatabaseSeed();
    const savedTheme = localStorage.getItem('profplan_theme');
    if (savedTheme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('profplan_sidebar_collapsed', String(next));
      return next;
    });
  };

  const handleOpenPromptHelper = (studentId?: string) => {
    setPromptHelperStudentId(studentId);
    setIsPromptHelperOpen(true);
  };

  const handleOpenLesson = (lessonId?: string, studentId?: string) => {
    setTargetLessonId(lessonId);
    setTargetStudentId(studentId);
    setActiveTab('lessons');
  };

  const handleOpenStudent = (studentId: string) => {
    setTargetStudentId(studentId);
    setActiveTab('students');
  };

  const handleOpenTemplate = (category?: string, studentId?: string) => {
    setTargetTemplateCategory(category);
    setTargetStudentId(studentId);
    setActiveTab('templates');
  };

  const handleSyncNow = async () => {
    if (!navigator.onLine) {
      alert('Mode hors-ligne : les modifications sont conservées en toute sécurité dans le stockage local IndexedDB.');
      return;
    }
    if (!getDriveAccessToken()) {
      setActiveTab('settings');
      alert('Veuillez connecter votre compte Google Drive dans les Paramètres pour lancer la synchronisation.');
      return;
    }
    setIsSyncing(true);
    const result = await performDriveSync();
    setIsSyncing(false);
    if (result.success) {
      if (result.conflicts && result.conflicts.length > 0) {
        setActiveConflict(result.conflicts[0]);
      } else {
        alert(`Synchronisation terminée avec succès ! (${result.pushedCount || 0} envoyé(s), ${result.pulledCount || 0} reçu(s))`);
      }
    } else {
      alert(`Erreur de synchronisation : ${result.errorMessage || result.reason}`);
    }
  };

  // Header titles mapping
  const titles: Record<ActiveTab, { title: string; subtitle: string }> = {
    week: {
      title: 'Cette Semaine',
      subtitle: 'Tableau de bord hebdomadaire, heures locales et suivi des cours',
    },
    schedule: {
      title: 'Planning & Créneaux',
      subtitle: 'Calendrier avec double fuseau horaire tuteur / élève',
    },
    students: {
      title: 'Dossiers Élèves',
      subtitle: 'Gestion des niveaux CECRL, objectifs et notes privées / partagées',
    },
    trials: {
      title: 'Entonnoir Cours d’Essai',
      subtitle: 'Diagnostics préalables, notes post-séance et conversion en élève régulier',
    },
    lessons: {
      title: 'Préparateur de Cours',
      subtitle: 'Éditeur de plan par blocs, répétition espacée Leitner et export PDF',
    },
    library: {
      title: 'Bibliothèque Pédagogique',
      subtitle: 'Banque d’exercices et archives des leçons enseignées',
    },
    reports: {
      title: 'Bilans & Rapports',
      subtitle: 'Rapports mensuels et trimestriels calculés localement pour les parents',
    },
    templates: {
      title: 'Modèles de Messages',
      subtitle: 'Modèles de réponses rapides Preply en français et anglais',
    },
    settings: {
      title: 'Paramètres & Sauvegardes',
      subtitle: 'Marque du tuteur, tarifs par défaut et synchronisation Google Drive',
    },
  };

  if (!isAuthenticated) {
    return <LoginView onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="flex min-h-screen bg-background text-text-primary antialiased">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        pendingSyncCount={pendingSyncCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          pageTitle={titles[activeTab].title}
          pageSubtitle={titles[activeTab].subtitle}
          pendingSyncCount={pendingSyncCount}
          oldestUnsyncedDays={oldestDays}
          onSyncNow={handleSyncNow}
          isSyncing={isSyncing}
          onOpenPromptHelper={() => handleOpenPromptHelper()}
          onNewLesson={() => handleOpenLesson()}
          onLockScreen={handleLogout}
        />

        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'week' && (
            <WeekView
              onOpenLesson={handleOpenLesson}
              onOpenTrial={() => setActiveTab('trials')}
              onOpenStudent={handleOpenStudent}
              onOpenPromptHelper={handleOpenPromptHelper}
              onOpenTemplate={handleOpenTemplate}
            />
          )}

          {activeTab === 'schedule' && (
            <ScheduleView
              onOpenLesson={handleOpenLesson}
              onOpenStudent={handleOpenStudent}
            />
          )}

          {activeTab === 'students' && (
            <StudentsView
              onOpenLesson={handleOpenLesson}
              onOpenPromptHelper={handleOpenPromptHelper}
            />
          )}

          {activeTab === 'trials' && (
            <TrialsView
              onOpenLesson={handleOpenLesson}
              onOpenTemplate={handleOpenTemplate}
              onOpenStudent={handleOpenStudent}
            />
          )}

          {activeTab === 'lessons' && (
            <LessonPlannerView
              initialLessonId={targetLessonId}
              initialStudentId={targetStudentId}
              onOpenPromptHelper={handleOpenPromptHelper}
              onOpenStudent={handleOpenStudent}
            />
          )}

          {activeTab === 'library' && (
            <LibraryView />
          )}

          {activeTab === 'reports' && (
            <ReportsView />
          )}

          {activeTab === 'templates' && (
            <TemplatesView
              initialCategory={targetTemplateCategory}
              initialStudentId={targetStudentId}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView />
          )}
        </main>
      </div>

      {/* Global External Prompt Helper Modal */}
      <PromptHelperModal
        isOpen={isPromptHelperOpen}
        onClose={() => setIsPromptHelperOpen(false)}
        initialStudentId={promptHelperStudentId}
      />

      {/* Conflict Resolution Modal (PRD Section 3.3) */}
      <ConflictModal
        conflict={activeConflict}
        onResolved={() => setActiveConflict(null)}
      />

      {/* Screen Lock Overlay (PRD Section 3.1) */}
      {settings?.screenLockEnabled && settings?.screenLockPin && (
        <ScreenLockModal
          isLocked={isScreenLocked}
          expectedPin={settings.screenLockPin}
          onUnlock={() => setIsScreenLocked(false)}
        />
      )}
    </div>
  );
};

