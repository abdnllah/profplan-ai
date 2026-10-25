import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  DollarSign,
  UserCheck,
  Sparkles,
  Send,
  Plus,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  CalendarCheck2,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { ConversionInsightsModal } from '../components/common/ConversionInsightsModal';
import { RetentionModal } from '../components/common/RetentionModal';
import { db, queueMutation } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, startOfWeek, endOfWeek, addDays, isSameDay, isWithinInterval } from 'date-fns';
import { fr } from 'date-fns/locale';

interface WeekViewProps {
  onOpenLesson: (lessonId?: string, studentId?: string) => void;
  onOpenTrial: (trialId?: string) => void;
  onOpenStudent: (studentId: string) => void;
  onOpenPromptHelper: (studentId?: string) => void;
  onOpenTemplate: (category?: string, studentId?: string) => void;
}

export const WeekView: React.FC<WeekViewProps> = ({
  onOpenLesson,
  onOpenTrial,
  onOpenStudent,
  onOpenPromptHelper,
  onOpenTemplate,
}) => {
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  const settings = useLiveQuery(() => db.settings.get('current'));
  const students = useLiveQuery(() => db.students.filter((s) => !s.isArchived && !s.deleted).toArray()) || [];
  const trials = useLiveQuery(() => db.trials.filter((t) => !t.deleted).toArray()) || [];
  const bookings = useLiveQuery(() => db.bookings.filter((b) => !b.deleted).toArray()) || [];
  const lessons = useLiveQuery(() => db.lessons.filter((l) => !l.deleted).toArray()) || [];
  const snapshots = useLiveQuery(() => db.lessonSnapshots.toArray()) || [];
  const mutations = useLiveQuery(() => db.mutations.filter((m) => !m.synced).toArray()) || [];
  const templates = useLiveQuery(() => db.templates.filter((t) => !t.deleted).toArray()) || [];

  const [isConversionModalOpen, setIsConversionModalOpen] = useState(false);
  const [isRetentionModalOpen, setIsRetentionModalOpen] = useState(false);

  const tutorTimezone = settings?.tutorTimezone || 'Europe/Paris';
  const currencySymbol = settings?.currencySymbol || '€';

  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });

  // Bookings in this week
  const weekBookings = bookings.filter((b) => {
    const bookingDate = new Date(b.startUtc);
    return isWithinInterval(bookingDate, { start: currentWeekStart, end: weekEnd });
  });

  // Earnings
  const earnedThisWeek = snapshots
    .filter((s) => {
      const snapDate = new Date(s.completedAt);
      return isWithinInterval(snapDate, { start: currentWeekStart, end: weekEnd });
    })
    .reduce((sum, s) => sum + (s.earnedAmount || 0), 0);

  const expectedRemaining = weekBookings
    .filter((b) => b.status === 'scheduled')
    .reduce((sum, b) => {
      const student = students.find((s) => s.id === b.studentId);
      const defaultRate = b.durationMinutes === 25 ? (settings?.defaultRates.standard25 || 22) : (settings?.defaultRates.standard50 || 40);
      return sum + (student?.ratePerClass || defaultRate);
    }, 0);

  // Conversion
  const trialsHeld = trials.filter((t) => t.status !== 'planned');
  const trialsConverted = trials.filter((t) => t.status === 'converted');
  const conversionRate = trialsHeld.length > 0 ? Math.round((trialsConverted.length / trialsHeld.length) * 100) : 0;
  const pendingTrials = trials.filter((t) => t.status === 'held' || t.status === 'followed_up');

  // Attention Items
  const now = new Date();
  const next48h = new Date(now.getTime() + 48 * 3600 * 1000);

  const upcomingBookingsNoPlan = bookings.filter((b) => {
    const bookingDate = new Date(b.startUtc);
    if (bookingDate >= now && bookingDate <= next48h && b.status === 'scheduled') {
      const lesson = lessons.find((l) => l.id === b.lessonId);
      return !lesson || lesson.status === 'draft';
    }
    return false;
  });

  const trialsNeedingFollowup = trials.filter((t) => t.status === 'held');

  const handleToggleHomeworkSent = async (lessonId: string, currentStatus: string) => {
    const lesson = await db.lessons.get(lessonId);
    if (!lesson) return;
    const newStatus = currentStatus === 'sent' ? 'drafted' : 'sent';
    const updated = {
      ...lesson,
      homework: {
        ...lesson.homework,
        status: newStatus as any,
        sentAt: newStatus === 'sent' ? new Date().toISOString() : undefined,
      },
      updatedAt: new Date().toISOString(),
      revision: (lesson.revision || 1) + 1,
    };
    await db.lessons.put(updated);
    await queueMutation('lessons', lesson.id, 'update', lesson.revision, updated.revision, updated);
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  const formatTimezone = (date: Date, timeZone: string) => {
    try {
      return new Intl.DateTimeFormat('fr-FR', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return format(date, 'HH:mm');
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Top Banner: Welcome & Week Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">
              Tableau de bord Preply • {tutorTimezone}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground mt-1">
            Cette Semaine
          </h2>
        </div>

        {/* Week navigation pills */}
        <div className="flex items-center gap-1.5 bg-card border border-border p-1 rounded-xl shadow-sm">
          <button
            onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title="Semaine précédente"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="px-3 py-1 text-xs font-semibold text-foreground select-none">
            {format(currentWeekStart, 'd MMM', { locale: fr })} – {format(weekEnd, 'd MMM yyyy', { locale: fr })}
          </span>
          <button
            onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            className="px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
          >
            Aujourd'hui
          </button>
          <button
            onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title="Semaine suivante"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* 4 Metric Cards: Clean, High-Contrast, Sleek */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Revenue */}
        <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm relative overflow-hidden group hover:border-border transition-all">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Revenus de la semaine
            </span>
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-foreground tracking-tight font-mono">
              {currencySymbol}{earnedThisWeek}
            </span>
            <span className="text-xs text-muted-foreground font-medium">
              / {currencySymbol}{earnedThisWeek + expectedRemaining} prévu
            </span>
          </div>
          <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-chart-3" />
            <span>{weekBookings.length} cours au planning</span>
          </div>
        </div>

        {/* Card 2: Trial Conversion */}
        <div
          onClick={() => setIsConversionModalOpen(true)}
          className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm relative overflow-hidden group hover:border-primary/50 transition-all cursor-pointer"
          title="Cliquer pour afficher les détails de conversion (Section 3.6 PRD)"
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Taux de conversion
            </span>
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <UserCheck size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-foreground tracking-tight font-mono">
              {conversionRate}%
            </span>
            <span className="text-xs text-muted-foreground font-medium">
              ({trialsConverted.length} / {trialsHeld.length} convertis)
            </span>
          </div>
          <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between">
            {pendingTrials.length > 0 ? (
              <span className="text-primary font-medium">{pendingTrials.length} essai(s) à relancer</span>
            ) : (
              <span>Tous les essais sont traités</span>
            )}
            <span className="text-[10px] text-primary underline underline-offset-2">Détails →</span>
          </div>
        </div>

        {/* Card 3: Active Students */}
        <div
          onClick={() => setIsRetentionModalOpen(true)}
          className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm relative overflow-hidden group hover:border-primary/50 transition-all cursor-pointer"
          title="Cliquer pour afficher l'analyse de rétention (Section 3.6 PRD)"
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Élèves réguliers
            </span>
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-foreground tracking-tight font-mono">
              {students.length}
            </span>
            <span className="text-xs text-muted-foreground font-medium">actifs</span>
          </div>
          <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between">
            <span>Rétention & cours à venir</span>
            <span className="text-[10px] text-primary underline underline-offset-2">Suivi →</span>
          </div>
        </div>

        {/* Card 4: Action Items */}
        <div
          className={`p-5 rounded-2xl border shadow-sm transition-all ${
            upcomingBookingsNoPlan.length + trialsNeedingFollowup.length > 0
              ? 'bg-card border-primary/40 shadow-sm'
              : 'bg-card border-border/80'
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Actions requises
            </span>
            <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive">
              <AlertCircle size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-foreground tracking-tight font-mono">
              {upcomingBookingsNoPlan.length + trialsNeedingFollowup.length}
            </span>
            <span className="text-xs text-muted-foreground font-medium">priorités</span>
          </div>
          <div className="mt-2 text-xs text-muted-foreground truncate">
            {upcomingBookingsNoPlan.length > 0 ? (
              <span className="text-amber-400 font-medium">
                {upcomingBookingsNoPlan.length} cours sans plan (&lt;48h)
              </span>
            ) : (
              <span className="text-chart-3 font-medium">Tous les cours sont prêts</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Agenda Schedule */}
        <div className="lg:col-span-2 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <CalendarCheck2 size={18} className="text-primary" />
              Planning de la semaine
            </h3>
            <span className="text-xs text-muted-foreground font-medium">
              Double fuseau horaire automatique
            </span>
          </div>

          <div className="space-y-4">
            {weekDays.map((day) => {
              const dayBookings = weekBookings.filter((b) =>
                isSameDay(new Date(b.startUtc), day)
              );
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={day.toISOString()}
                  className={`rounded-2xl border transition-all ${
                    isToday
                      ? 'bg-card border-primary/40 shadow-sm'
                      : 'bg-card/70 border-border/80'
                  }`}
                >
                  {/* Day Header Bar */}
                  <div className="flex items-center justify-between px-5 py-3 border-b border-border/60">
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-sm font-bold capitalize ${
                          isToday ? 'text-primary' : 'text-foreground'
                        }`}
                      >
                        {format(day, 'EEEE d MMMM', { locale: fr })}
                      </span>
                      {isToday && (
                        <span className="px-2 py-0.5 text-[10px] font-extrabold bg-primary text-black rounded-md uppercase tracking-wider">
                          Aujourd'hui
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground font-medium">
                      {dayBookings.length === 0
                        ? 'Aucun cours'
                        : `${dayBookings.length} cours`}
                    </span>
                  </div>

                  {/* Bookings within Day */}
                  <div className="p-4 space-y-2.5">
                    {dayBookings.length === 0 ? (
                      <p className="text-xs text-muted-foreground/70 py-2 italic px-2">
                        Créneau libre pour préparation pédagogique ou repos.
                      </p>
                    ) : (
                      dayBookings.map((booking) => {
                        const student = students.find((s) => s.id === booking.studentId);
                        const trial = trials.find((t) => t.id === booking.trialId);
                        const personName = student?.name || trial?.name || booking.title;
                        const studentTimezone = student?.timezone || trial?.timezone || 'America/New_York';
                        const startDate = new Date(booking.startUtc);

                        const tutorTime = formatTimezone(startDate, tutorTimezone);
                        const studentTime = formatTimezone(startDate, studentTimezone);

                        const lesson = lessons.find((l) => l.id === booking.lessonId);
                        const isReady = lesson && lesson.status === 'ready';
                        const isDone = lesson && lesson.status === 'completed';

                        return (
                          <div
                            key={booking.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-background/50 hover:bg-muted/50 border border-border/60 transition-all"
                          >
                            <div className="flex items-center gap-3.5">
                              {/* Timing Pill */}
                              <div className="px-3 py-1.5 rounded-lg bg-card border border-border text-center shrink-0">
                                <div className="text-sm font-bold text-primary font-mono leading-none">
                                  {tutorTime}
                                </div>
                                <div className="text-[10px] text-muted-foreground font-mono mt-1">
                                  {studentTime}
                                </div>
                              </div>

                              {/* Student Info */}
                              <div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className="font-bold text-foreground text-sm hover:text-primary transition-colors cursor-pointer"
                                    onClick={() =>
                                      student ? onOpenStudent(student.id) : trial ? onOpenTrial(trial.id) : null
                                    }
                                  >
                                    {personName}
                                  </span>
                                  {student?.cefrLevel && (
                                    <Badge variant="yellow" size="sm">
                                      {student.cefrLevel}
                                    </Badge>
                                  )}
                                  {trial && (
                                    <Badge variant="neutral" size="sm">
                                      Essai
                                    </Badge>
                                  )}
                                  <span className="text-[11px] text-muted-foreground font-mono">
                                    {booking.durationMinutes} min
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground truncate max-w-sm mt-0.5">
                                  {booking.notes || 'Cours de français conversationnel'}
                                </p>
                              </div>
                            </div>

                            {/* Plan Status & CTA Button */}
                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                              {isDone ? (
                                <Badge variant="success" size="sm" className="flex items-center gap-1">
                                  <CheckCircle2 size={12} /> Réalisé
                                </Badge>
                              ) : isReady ? (
                                <Badge variant="yellow" size="sm">
                                  Plan prêt
                                </Badge>
                              ) : (
                                <span className="text-[11px] font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/25">
                                  À préparer
                                </span>
                              )}

                              <Button
                                variant={isReady ? 'outline' : 'primary'}
                                size="sm"
                                onClick={() => onOpenLesson(booking.lessonId, booking.studentId)}
                                className="text-xs h-8 px-3"
                              >
                                {isDone ? 'Bilan' : isReady ? 'Modifier' : 'Préparer'}
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 1 Col: Action widgets */}
        <div className="space-y-6">
          {/* Panel 1: Needs Attention */}
          <div className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-3.5">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <AlertCircle size={16} className="text-primary" />
              Priorités immédiates
            </h3>

            <div className="space-y-2.5">
              {upcomingBookingsNoPlan.map((b) => {
                const s = students.find((st) => st.id === b.studentId);
                return (
                  <div
                    key={b.id}
                    className="p-3 rounded-xl bg-background/60 border border-border text-xs flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-bold text-foreground">
                        {s?.name || b.title}
                      </div>
                      <div className="text-[11px] text-amber-400 font-medium mt-0.5">
                        Plan de cours à créer ({b.durationMinutes} min)
                      </div>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onOpenLesson(undefined, b.studentId)}
                      className="text-xs h-7 px-2.5"
                    >
                      Préparer
                    </Button>
                  </div>
                );
              })}

              {trialsNeedingFollowup.map((t) => (
                <div
                  key={t.id}
                  className="p-3 rounded-xl bg-background/60 border border-border text-xs flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="font-bold text-foreground">
                      {t.name}
                    </div>
                    <div className="text-[11px] text-primary font-medium mt-0.5">
                      Essai tenu • Envoyer le suivi
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenTemplate('trial_followup')}
                    className="text-xs h-7 px-2.5"
                  >
                    Message
                  </Button>
                </div>
              ))}

              {upcomingBookingsNoPlan.length === 0 && trialsNeedingFollowup.length === 0 && (
                <div className="p-4 rounded-xl bg-muted/30 border border-border/40 text-center text-xs text-muted-foreground">
                  <CheckCircle2 size={22} className="mx-auto text-chart-3 mb-1.5 opacity-80" />
                  Vous êtes parfaitement à jour pour vos cours !
                </div>
              )}
            </div>
          </div>

          {/* Panel 2: Homework Tracker */}
          <div className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Send size={15} className="text-primary" />
                Devoirs en cours
              </h3>
              <span className="text-[10px] text-muted-foreground font-medium">1-clic envoyé</span>
            </div>

            <div className="space-y-2">
              {lessons
                .filter((l) => l.homework && l.homework.text.trim().length > 0)
                .slice(0, 5)
                .map((lesson) => {
                  const student = students.find((s) => s.id === lesson.studentId);
                  const isSent = lesson.homework.status === 'sent';

                  return (
                    <div
                      key={lesson.id}
                      className="p-3 rounded-xl bg-background/60 border border-border text-xs flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-foreground block truncate">
                          {student?.name || 'Élève'}
                        </span>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {lesson.homework.text}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleHomeworkSent(lesson.id, lesson.homework.status)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
                          isSent
                            ? 'bg-chart-3/20 text-chart-3 border border-chart-3/30'
                            : 'bg-muted hover:bg-muted/80 border border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <CheckCircle2 size={13} />
                        <span>{isSent ? 'Envoyé' : 'À faire'}</span>
                      </button>
                    </div>
                  );
                })}

              {lessons.filter((l) => l.homework && l.homework.text.trim().length > 0).length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">
                  Aucun devoir enregistré récemment.
                </p>
              )}
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-2.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Raccourcis rapides
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenPromptHelper()}
                icon={<Sparkles size={14} className="text-primary" />}
                className="text-xs justify-start h-9"
              >
                Prompt Helper
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenTemplate()}
                icon={<Send size={14} className="text-primary" />}
                className="text-xs justify-start h-9"
              >
                Modèles Preply
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Conversion Insights Modal (PRD Section 3.6) */}
      <ConversionInsightsModal
        isOpen={isConversionModalOpen}
        onClose={() => setIsConversionModalOpen(false)}
        trials={trials}
        templates={templates}
        onOpenTemplate={onOpenTemplate}
      />

      {/* Retention Modal (PRD Section 3.6) */}
      <RetentionModal
        isOpen={isRetentionModalOpen}
        onClose={() => setIsRetentionModalOpen(false)}
        students={students}
        bookings={bookings}
        snapshots={snapshots}
        onOpenTemplate={onOpenTemplate}
      />
    </div>
  );
};
