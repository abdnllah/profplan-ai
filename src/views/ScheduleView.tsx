import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Globe,
  Trash2,
  CalendarCheck,
  Upload,
  AlertTriangle,
  UserPlus,
  FileCheck,
  Check,
  Sparkles,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { db, queueMutation } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Booking } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { parseIcsCalendar, detectOverlappingBookings } from '../utils/icsParser';

interface ScheduleViewProps {
  onOpenLesson: (lessonId?: string, studentId?: string) => void;
  onOpenStudent: (studentId: string) => void;
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  onOpenLesson,
  onOpenStudent,
}) => {
  const settings = useLiveQuery(() => db.settings.get('current'));
  const students = useLiveQuery(() => db.students.filter((s) => !s.isArchived && !s.deleted).toArray()) || [];
  const trials = useLiveQuery(() => db.trials.filter((t) => !t.deleted).toArray()) || [];
  const bookings = useLiveQuery(() => db.bookings.filter((b) => !b.deleted).toArray()) || [];

  const tutorTimezone = settings?.tutorTimezone || 'Europe/Paris';

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [bookingDate, setBookingDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [bookingTime, setBookingTime] = useState<string>('15:00');
  const [durationMinutes, setDurationMinutes] = useState<25 | 50>(50);
  const [notes, setNotes] = useState<string>('');
  const [importStatusMsg, setImportStatusMsg] = useState<string>('');

  // Overlap detection (PRD Section 3.4)
  const overlapMap = detectOverlappingBookings(bookings);
  const hasOverlaps = overlapMap.size > 0;

  // Unmatched calendar bookings (Needs a student)
  const unmatchedBookings = bookings.filter((b) => !b.studentId && !b.trialId);

  // Dual-timezone calculation helper
  const getTimes = (utcIso: string, studentTimezone: string) => {
    const d = new Date(utcIso);
    let tutorTime = '';
    let studentTime = '';
    try {
      tutorTime = new Intl.DateTimeFormat('fr-FR', {
        timeZone: tutorTimezone,
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
      studentTime = new Intl.DateTimeFormat('fr-FR', {
        timeZone: studentTimezone,
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    } catch {
      tutorTime = format(d, 'HH:mm');
      studentTime = format(d, 'HH:mm');
    }
    return { tutorTime, studentTime };
  };

  // Manual create booking
  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) return;

    const combinedStr = `${bookingDate}T${bookingTime}:00`;
    const localDate = new Date(combinedStr);
    const startUtc = localDate.toISOString();
    const endUtc = new Date(localDate.getTime() + durationMinutes * 60000).toISOString();

    const student = students.find((s) => s.id === selectedStudentId);

    const newBooking: Booking = {
      id: 'book_' + Date.now(),
      studentId: selectedStudentId,
      title: `${student?.name || 'Élève'} - Cours de français`,
      startUtc,
      endUtc,
      durationMinutes,
      source: 'manual',
      status: 'scheduled',
      notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      revision: 1,
      deleted: false,
      editingDevice: settings?.deviceId || 'local',
    };

    await db.bookings.add(newBooking);
    await queueMutation('bookings', newBooking.id, 'create', 0, 1, newBooking);

    setIsModalOpen(false);
    setNotes('');
  };

  // Delete booking
  const handleDeleteBooking = async (id: string) => {
    if (!confirm('Supprimer cette réservation ?')) return;
    const b = await db.bookings.get(id);
    if (!b) return;
    const updated = { ...b, deleted: true, updatedAt: new Date().toISOString(), revision: b.revision + 1 };
    await db.bookings.put(updated);
    await queueMutation('bookings', b.id, 'delete', b.revision, updated.revision, updated);
  };

  // Import .ICS file (PRD Section 3.4)
  const handleImportIcs = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsedEvents = parseIcsCalendar(content, students);

        let createdCount = 0;
        let updatedCount = 0;

        for (const evt of parsedEvents) {
          // Check if booking with this calendar UID already exists
          const existing = bookings.find((b) => b.calendarUid === evt.uid);

          if (existing) {
            // Update calendar fields, keep notes and student link (PRD Section 3.4)
            const updatedBooking: Booking = {
              ...existing,
              title: evt.summary,
              startUtc: evt.startUtc,
              endUtc: evt.endUtc,
              durationMinutes: evt.durationMinutes,
              status: evt.status,
              studentId: existing.studentId || evt.matchedStudentId,
              updatedAt: new Date().toISOString(),
              revision: existing.revision + 1,
            };
            await db.bookings.put(updatedBooking);
            await queueMutation('bookings', existing.id, 'update', existing.revision, updatedBooking.revision, updatedBooking);
            updatedCount++;
          } else {
            // Create new booking
            const newBooking: Booking = {
              id: 'book_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
              studentId: evt.matchedStudentId,
              title: evt.summary,
              startUtc: evt.startUtc,
              endUtc: evt.endUtc,
              durationMinutes: evt.durationMinutes,
              source: 'calendar',
              calendarUid: evt.uid,
              status: evt.status,
              notes: evt.description || undefined,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              revision: 1,
              deleted: false,
              editingDevice: settings?.deviceId || 'local',
            };
            await db.bookings.add(newBooking);
            await queueMutation('bookings', newBooking.id, 'create', 0, 1, newBooking);
            createdCount++;
          }
        }

        setImportStatusMsg(`Importation .ICS réussie : ${createdCount} créés, ${updatedCount} mis à jour.`);
        setTimeout(() => setImportStatusMsg(''), 5000);
      } catch (err: any) {
        alert('Erreur lors de la lecture du fichier .ICS : ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Assign student to unmatched booking
  const handleAssignStudent = async (bookingId: string, studentId: string) => {
    const booking = await db.bookings.get(bookingId);
    if (!booking) return;

    const student = students.find((s) => s.id === studentId);
    const updated: Booking = {
      ...booking,
      studentId,
      title: `${student?.name || 'Élève'} - Cours de français`,
      updatedAt: new Date().toISOString(),
      revision: booking.revision + 1,
    };

    await db.bookings.put(updated);
    await queueMutation('bookings', booking.id, 'update', booking.revision, updated.revision, updated);
  };

  const sortedBookings = [...bookings].sort(
    (a, b) => new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime()
  );

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            Planning & Réservations
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Gestion du calendrier avec import .ICS, détection de conflits et fuseau élève automatique.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* ICS Import Button */}
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".ics,.ical"
              onChange={handleImportIcs}
              className="hidden"
            />
            <Button
              variant="outline"
              size="md"
              type="button"
              icon={<Upload size={16} />}
              onClick={(e) => {
                (e.currentTarget.previousElementSibling as HTMLInputElement)?.click();
              }}
            >
              Importer fichier .ICS
            </Button>
          </label>

          <Button
            variant="primary"
            size="md"
            icon={<Plus size={16} />}
            onClick={() => setIsModalOpen(true)}
          >
            Ajouter un créneau
          </Button>
        </div>
      </div>

      {/* Success Notification */}
      {importStatusMsg && (
        <div className="p-3.5 rounded-xl bg-chart-3/15 border border-chart-3/30 text-chart-3 text-xs font-semibold flex items-center gap-2">
          <FileCheck size={16} />
          <span>{importStatusMsg}</span>
        </div>
      )}

      {/* Overlapping Bookings Warning Banner (PRD Section 3.4) */}
      {hasOverlaps && (
        <div className="p-4 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-xs font-semibold flex items-center gap-2.5">
          <AlertTriangle size={18} className="shrink-0" />
          <span>
            Attention : Des créneaux se chevauchent dans votre planning. Vérifiez les éléments signalés en rouge ci-dessous.
          </span>
        </div>
      )}

      {/* Unmatched Bookings Triage Drawer (Needs a student) */}
      {unmatchedBookings.length > 0 && (
        <div className="p-4 rounded-2xl bg-card border border-primary/40 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
              <UserPlus size={15} className="text-primary" />
              Événements importés sans élève associé ({unmatchedBookings.length})
            </h3>
            <span className="text-[10px] text-muted-foreground">
              Associez un profil pour synchroniser les devoirs et niveaux
            </span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {unmatchedBookings.map((b) => (
              <div
                key={b.id}
                className="p-2.5 rounded-xl bg-background border border-border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <span className="font-bold text-foreground">{b.title}</span>
                  <span className="text-muted-foreground text-[11px] ml-2">
                    {format(new Date(b.startUtc), 'd MMM HH:mm', { locale: fr })} ({b.durationMinutes} min)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) handleAssignStudent(b.id, e.target.value);
                    }}
                    className="bg-card border border-border rounded-lg px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Associer à un élève...</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.cefrLevel})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timezone Information Banner */}
      <div className="p-4 rounded-2xl bg-card border border-border shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-foreground font-medium">
          <Globe size={16} className="text-primary shrink-0" />
          <span>
            Fuseau tuteur actif : <strong className="text-primary font-mono">{tutorTimezone}</strong>
          </span>
        </div>
        <div className="text-muted-foreground text-[11px]">
          Tous les horaires sont stockés en UTC et recalculés automatiquement pour chaque élève.
        </div>
      </div>

      {/* Bookings List */}
      <div className="space-y-3">
        {sortedBookings.length === 0 ? (
          <div className="p-12 rounded-2xl bg-card border border-border text-center">
            <CalendarIcon size={36} className="mx-auto text-muted-foreground mb-3 opacity-60" />
            <h3 className="text-base font-bold text-foreground">Aucun créneau planifié</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
              Ajoutez vos cours manuellement ou importez votre calendrier au format .ICS pour préparer vos leçons.
            </p>
            <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)}>
              Ajouter un premier créneau
            </Button>
          </div>
        ) : (
          sortedBookings.map((booking) => {
            const student = students.find((s) => s.id === booking.studentId);
            const trial = trials.find((t) => t.id === booking.trialId);
            const studentTimezone = student?.timezone || trial?.timezone || 'UTC';
            const { tutorTime, studentTime } = getTimes(booking.startUtc, studentTimezone);
            const bookingDateFormatted = format(new Date(booking.startUtc), 'EEEE d MMMM yyyy', { locale: fr });
            const isOverlapping = overlapMap.has(booking.id);

            return (
              <div
                key={booking.id}
                className={`p-5 rounded-2xl bg-card border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                  isOverlapping ? 'border-destructive/60 bg-destructive/5' : 'border-border hover:border-primary/40'
                }`}
              >
                {/* Left info: Time and Person */}
                <div className="flex items-start md:items-center gap-4">
                  {/* Time block */}
                  <div className="p-3 rounded-xl bg-background border border-border text-center min-w-[105px] shrink-0">
                    <div className="text-base font-extrabold text-primary font-mono leading-none">
                      {tutorTime}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mt-1">
                      {tutorTimezone.split('/')[1] || 'Tuteur'}
                    </div>
                    <div className="mt-1 pt-1 border-t border-border/60 text-xs font-mono font-medium text-foreground">
                      {studentTime}
                    </div>
                    <div className="text-[9px] text-muted-foreground truncate max-w-[95px]">
                      {studentTimezone.split('/')[1]?.replace('_', ' ') || 'Élève'}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-base font-bold text-foreground hover:text-primary transition-colors cursor-pointer"
                        onClick={() => student ? onOpenStudent(student.id) : null}
                      >
                        {student?.name || trial?.name || booking.title}
                      </span>
                      {student?.cefrLevel && (
                        <Badge variant="yellow" size="sm">
                          {student.cefrLevel}
                        </Badge>
                      )}
                      {trial && <Badge variant="neutral" size="sm">Essai</Badge>}
                      <Badge variant="outline" size="sm">
                        {booking.durationMinutes} min
                      </Badge>
                      {booking.source === 'calendar' && (
                        <Badge variant="neutral" size="sm">
                          .ICS
                        </Badge>
                      )}
                      {isOverlapping && (
                        <Badge variant="danger" size="sm" className="flex items-center gap-1">
                          <AlertTriangle size={11} /> Conflit horaire
                        </Badge>
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground capitalize flex items-center gap-2">
                      <CalendarCheck size={13} className="text-primary" />
                      <span>{bookingDateFormatted}</span>
                    </div>

                    {booking.notes && (
                      <p className="text-xs text-muted-foreground italic mt-0.5">
                        "{booking.notes}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2.5 self-end md:self-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenLesson(booking.lessonId, booking.studentId)}
                    className="h-8 text-xs"
                  >
                    Ouvrir le plan
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteBooking(booking.id)}
                    className="text-destructive hover:bg-destructive/15 p-2 h-8 w-8"
                    title="Supprimer la réservation"
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Booking Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Ajouter un créneau de cours"
        subtitle="Enregistrez une réservation avec double fuseau horaire automatique"
      >
        <form onSubmit={handleCreateBooking} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Élève
            </label>
            <select
              value={selectedStudentId}
              onChange={(e) => {
                setSelectedStudentId(e.target.value);
                const s = students.find((st) => st.id === e.target.value);
                if (s) setDurationMinutes(s.defaultLength);
              }}
              required
              className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            >
              <option value="">Sélectionner un élève...</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.cefrLevel} • {s.timezone})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Date
              </label>
              <input
                type="date"
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                required
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Heure Tuteur ({tutorTimezone.split('/')[1] || 'Paris'})
              </label>
              <input
                type="time"
                value={bookingTime}
                onChange={(e) => setBookingTime(e.target.value)}
                required
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Durée du cours
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDurationMinutes(25)}
                className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  durationMinutes === 25
                    ? 'bg-primary text-black border-primary'
                    : 'bg-background border-border text-muted-foreground'
                }`}
              >
                25 minutes
              </button>
              <button
                type="button"
                onClick={() => setDurationMinutes(50)}
                className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  durationMinutes === 50
                    ? 'bg-primary text-black border-primary'
                    : 'bg-background border-border text-muted-foreground'
                }`}
              >
                50 minutes
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Notes pour la préparation (optionnel)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Travailler le subjonctif et la préparation DELF..."
              rows={2}
              className="w-full bg-background border border-border rounded-xl p-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsModalOpen(false)}>
              Annuler
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Enregistrer le créneau
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
