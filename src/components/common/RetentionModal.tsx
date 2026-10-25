import React from 'react';
import { Modal } from './Modal';
import { Badge } from './Badge';
import { Button } from './Button';
import { Student, Booking, LessonSnapshot } from '../../types';
import { Users, AlertCircle, Calendar, Send, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface RetentionModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  bookings: Booking[];
  snapshots: LessonSnapshot[];
  onOpenTemplate: (category?: string, studentId?: string) => void;
}

export const RetentionModal: React.FC<RetentionModalProps> = ({
  isOpen,
  onClose,
  students,
  bookings,
  snapshots,
  onOpenTemplate,
}) => {
  if (!isOpen) return null;

  const nowMs = Date.now();
  const thirtyDaysMs = 30 * 24 * 3600 * 1000;
  const fourteenDaysMs = 14 * 24 * 3600 * 1000;

  // Active students: had a completed lesson snapshot in last 30 days
  const activeStudents = students.filter((s) => {
    const studentSnaps = snapshots.filter((sn) => sn.studentId === s.id);
    if (studentSnaps.length === 0) return true; // Newly added students count as active
    return studentSnaps.some((sn) => nowMs - new Date(sn.completedAt).getTime() <= thirtyDaysMs);
  });

  // Students with no booking in the next 14 days (PRD Section 3.6)
  const studentsWithoutUpcomingBooking = students.filter((s) => {
    const studentBookings = bookings.filter((b) => b.studentId === s.id && b.status === 'scheduled');
    if (studentBookings.length === 0) return true;
    const hasBookingWithin14d = studentBookings.some((b) => {
      const bTime = new Date(b.startUtc).getTime();
      return bTime >= nowMs && bTime - nowMs <= fourteenDaysMs;
    });
    return !hasBookingWithin14d;
  });

  // Average lessons per student per month
  const totalClasses = snapshots.length;
  const avgLessonsPerMonth = students.length > 0 ? (totalClasses / students.length).toFixed(1) : '0';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Rétention des Élèves & Suivi des Réservations"
      subtitle="Élèves actifs, alertes sans créneau sous 14 jours et assiduité moyenne (Section 3.6 PRD)"
      maxWidth="3xl"
    >
      <div className="space-y-6">
        {/* Top 3 KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="p-4 rounded-xl bg-background border border-border text-center">
            <div className="text-3xl font-black text-primary font-mono">{activeStudents.length}</div>
            <div className="text-xs text-muted-foreground font-medium mt-1">
              Élèves actifs (cours &lt; 30j)
            </div>
          </div>
          <div className="p-4 rounded-xl bg-background border border-border text-center">
            <div className="text-3xl font-black text-amber-400 font-mono">
              {studentsWithoutUpcomingBooking.length}
            </div>
            <div className="text-xs text-muted-foreground font-medium mt-1">
              Sans réservation (&gt; 14 jours)
            </div>
          </div>
          <div className="p-4 rounded-xl bg-background border border-border text-center">
            <div className="text-3xl font-black text-chart-3 font-mono">{avgLessonsPerMonth}</div>
            <div className="text-xs text-muted-foreground font-medium mt-1">
              Cours / élève / mois (moyenne)
            </div>
          </div>
        </div>

        {/* At-risk students list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <AlertCircle size={14} className="text-amber-400" />
              Élèves sans cours planifié dans les 14 jours
            </h4>
            <span className="text-[10px] text-muted-foreground">
              Relancez-les pour conserver leur créneau
            </span>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto">
            {studentsWithoutUpcomingBooking.length === 0 ? (
              <div className="p-4 rounded-xl bg-background border border-border text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <CheckCircle2 size={16} className="text-chart-3" />
                <span>Tous vos élèves ont au moins une séance planifiée dans les 14 jours !</span>
              </div>
            ) : (
              studentsWithoutUpcomingBooking.map((stu) => {
                const lastSnap = snapshots
                  .filter((sn) => sn.studentId === stu.id)
                  .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0];

                return (
                  <div
                    key={stu.id}
                    className="p-3.5 rounded-xl bg-background border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">{stu.name}</span>
                        <Badge variant="yellow" size="sm">
                          {stu.cefrLevel}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Dernier cours :{' '}
                        {lastSnap
                          ? format(new Date(lastSnap.completedAt), 'd MMMM yyyy', { locale: fr })
                          : 'Aucun cours enregistré'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          onClose();
                          onOpenTemplate('renewal_package', stu.id);
                        }}
                        icon={<Send size={13} />}
                        className="text-xs h-7 px-2.5"
                      >
                        Message de relance
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="primary" size="sm" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </Modal>
  );
};

