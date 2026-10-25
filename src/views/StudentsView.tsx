import React, { useState } from 'react';
import {
  Users,
  Plus,
  Archive,
  BookOpen,
  Award,
  Globe,
  Clock,
  Lock,
  Share2,
  Trash2,
  Edit,
  History,
  CheckCircle,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { db, queueMutation } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Student, CEFRLevel } from '../types';

interface StudentsViewProps {
  onOpenLesson: (lessonId?: string, studentId?: string) => void;
  onOpenPromptHelper: (studentId?: string) => void;
}

export const StudentsView: React.FC<StudentsViewProps> = ({
  onOpenLesson,
  onOpenPromptHelper,
}) => {
  const settings = useLiveQuery(() => db.settings.get('current'));
  const students = useLiveQuery(() => db.students.filter((s) => !s.deleted).toArray()) || [];
  const vocabulary = useLiveQuery(() => db.vocabulary.filter((v) => !v.deleted).toArray()) || [];
  const snapshots = useLiveQuery(() => db.lessonSnapshots.toArray()) || [];

  const [activeTabFilter, setActiveTabFilter] = useState<'active' | 'archived'>('active');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Partial<Student>>({
    name: '',
    cefrLevel: 'B1',
    timezone: 'America/New_York',
    goals: '',
    defaultLength: 50,
    communicationLanguage: 'fr',
    ratePerClass: 40,
    privateNotes: '',
    shareableNotes: '',
  });

  const currencySymbol = settings?.currencySymbol || '€';

  const filteredStudents = students.filter((s) =>
    activeTabFilter === 'active' ? !s.isArchived : s.isArchived
  );

  const handleOpenCreateModal = () => {
    setIsEditMode(false);
    setFormData({
      name: '',
      cefrLevel: 'B1',
      timezone: 'America/New_York',
      goals: '',
      defaultLength: 50,
      communicationLanguage: 'fr',
      ratePerClass: settings?.defaultRates.standard50 || 40,
      privateNotes: '',
      shareableNotes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (student: Student) => {
    setIsEditMode(true);
    setFormData({ ...student });
    setIsModalOpen(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const nowIso = new Date().toISOString();

    if (isEditMode && formData.id) {
      const existing = await db.students.get(formData.id);
      if (!existing) return;

      const cefrChanged = existing.cefrLevel !== formData.cefrLevel;
      const newHistory = cefrChanged
        ? [
            ...existing.cefrHistory,
            {
              level: formData.cefrLevel as CEFRLevel,
              date: nowIso.split('T')[0],
              notes: 'Niveau mis à jour par le tuteur',
            },
          ]
        : existing.cefrHistory;

      const updated: Student = {
        ...existing,
        ...formData,
        cefrHistory: newHistory,
        updatedAt: nowIso,
        revision: existing.revision + 1,
      } as Student;

      await db.students.put(updated);
      await queueMutation('students', updated.id, 'update', existing.revision, updated.revision, updated);
      if (selectedStudent?.id === updated.id) setSelectedStudent(updated);
    } else {
      const newId = 'stu_' + Date.now();
      const newStudent: Student = {
        id: newId,
        name: formData.name || 'Nouvel Élève',
        cefrLevel: (formData.cefrLevel as CEFRLevel) || 'A1',
        cefrHistory: [
          {
            level: (formData.cefrLevel as CEFRLevel) || 'A1',
            date: nowIso.split('T')[0],
            notes: 'Évaluation initiale',
          },
        ],
        timezone: formData.timezone || 'America/New_York',
        goals: formData.goals || '',
        defaultLength: (formData.defaultLength as 25 | 50) || 50,
        communicationLanguage: (formData.communicationLanguage as any) || 'fr',
        ratePerClass: Number(formData.ratePerClass) || 40,
        privateNotes: formData.privateNotes || '',
        shareableNotes: formData.shareableNotes || '',
        isArchived: false,
        createdAt: nowIso,
        updatedAt: nowIso,
        revision: 1,
        deleted: false,
        editingDevice: settings?.deviceId || 'local',
      };

      await db.students.add(newStudent);
      await queueMutation('students', newStudent.id, 'create', 0, 1, newStudent);
      setSelectedStudent(newStudent);
    }

    setIsModalOpen(false);
  };

  const handleToggleArchive = async (student: Student) => {
    const updated = {
      ...student,
      isArchived: !student.isArchived,
      updatedAt: new Date().toISOString(),
      revision: student.revision + 1,
    };
    await db.students.put(updated);
    await queueMutation('students', student.id, 'update', student.revision, updated.revision, updated);
    if (selectedStudent?.id === student.id) setSelectedStudent(updated);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            Gestion des Élèves
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Dossiers complets avec historique CECRL, vocabulaire Leitner et distinction notes privées / partagées.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex rounded-lg bg-surface border border-surface-border p-0.5 text-xs">
            <button
              onClick={() => setActiveTabFilter('active')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                activeTabFilter === 'active'
                  ? 'bg-primary text-black'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Actifs ({students.filter((s) => !s.isArchived).length})
            </button>
            <button
              onClick={() => setActiveTabFilter('archived')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                activeTabFilter === 'archived'
                  ? 'bg-primary text-black'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Archivés ({students.filter((s) => s.isArchived).length})
            </button>
          </div>

          <Button
            variant="primary"
            size="md"
            icon={<Plus size={16} />}
            onClick={handleOpenCreateModal}
          >
            Nouvel élève
          </Button>
        </div>
      </div>

      {/* Main Grid: Student List & Detail Drawer/Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Students List */}
        <div className="lg:col-span-1 space-y-3">
          {filteredStudents.length === 0 ? (
            <Card padding="lg" className="text-center py-8">
              <Users size={32} className="mx-auto text-muted-foreground mb-2 opacity-50" />
              <p className="text-xs text-muted-foreground">Aucun élève dans cette catégorie.</p>
            </Card>
          ) : (
            filteredStudents.map((s) => {
              const isSelected = selectedStudent?.id === s.id;
              const studentVocab = vocabulary.filter((v) => v.studentId === s.id);
              const dueVocab = studentVocab.filter(
                (v) => v.nextReviewDate <= new Date().toISOString().split('T')[0]
              );

              return (
                <div
                  key={s.id}
                  onClick={() => setSelectedStudent(s)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-card border-primary/60 shadow-sm'
                      : 'bg-card/70 border-border/80 hover:border-border hover:bg-card'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-foreground text-base leading-tight">
                        {s.name}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge variant="yellow" size="sm">
                          {s.cefrLevel}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {s.defaultLength} min • {currencySymbol}{s.ratePerClass}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] text-text-dim block">
                        {s.timezone.split('/')[1]?.replace('_', ' ') || s.timezone}
                      </span>
                      {dueVocab.length > 0 && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] bg-accent/20 text-accent font-semibold border border-accent/30">
                          {dueVocab.length} mots dus
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-text-secondary mt-2.5 line-clamp-2">
                    {s.goals || 'Aucun objectif spécifié'}
                  </p>
                </div>
              );
            })
          )}
        </div>

        {/* Right: Selected Student Details & Tabs */}
        <div className="lg:col-span-2">
          {selectedStudent ? (
            <div className="space-y-6">
              {/* Profile Card Header */}
              <Card padding="lg" variant="accent-border">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-2xl font-bold text-text-primary">
                        {selectedStudent.name}
                      </h3>
                      <Badge variant="yellow" size="md">
                        {selectedStudent.cefrLevel}
                      </Badge>
                      {selectedStudent.isArchived && (
                        <Badge variant="neutral" size="sm">
                          Archivé
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-xs text-text-secondary">
                      <span className="flex items-center gap-1">
                        <Globe size={14} className="text-text-muted" />
                        {selectedStudent.timezone}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={14} className="text-text-muted" />
                        {selectedStudent.defaultLength} min par cours
                      </span>
                      <span className="text-text-muted">
                        Tarif privé : <strong className="text-text-primary">{currencySymbol}{selectedStudent.ratePerClass}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenPromptHelper(selectedStudent.id)}
                    >
                      Prompt Helper
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleOpenEditModal(selectedStudent)}
                      icon={<Edit size={14} />}
                    >
                      Modifier
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleArchive(selectedStudent)}
                      title={selectedStudent.isArchived ? 'Désarchiver l’élève' : 'Archiver l’élève'}
                      icon={<Archive size={14} />}
                    >
                      {selectedStudent.isArchived ? 'Restaurer' : 'Archiver'}
                    </Button>
                  </div>
                </div>

                {/* Goals */}
                <div className="mt-4 pt-4 border-t border-card-border">
                  <h5 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                    Objectifs d’apprentissage
                  </h5>
                  <p className="text-sm text-text-primary leading-relaxed">
                    {selectedStudent.goals || 'Aucun objectif renseigné.'}
                  </p>
                </div>
              </Card>

              {/* Notes Grid: Private Notes vs Shareable Notes (PRD Section 3.4) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Private Notes */}
                <Card padding="md">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                      <Lock size={13} className="text-amber-400" />
                      Notes Privées (Tuteur seul)
                    </span>
                    <span className="text-[10px] text-text-dim">Jamais dans les rapports</span>
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed min-h-[60px] whitespace-pre-wrap">
                    {selectedStudent.privateNotes || 'Aucune note privée.'}
                  </p>
                </Card>

                {/* Shareable Notes */}
                <Card padding="md">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                      <Share2 size={13} className="text-accent" />
                      Notes Partagées
                    </span>
                    <span className="text-[10px] text-accent/80 font-medium">Incluses dans le bilan</span>
                  </div>
                  <p className="text-xs text-text-primary leading-relaxed min-h-[60px] whitespace-pre-wrap">
                    {selectedStudent.shareableNotes || 'Aucune note partagée.'}
                  </p>
                </Card>
              </div>

              {/* CEFR Progression History Timeline */}
              <Card padding="md">
                <h4 className="text-sm font-bold text-text-primary flex items-center gap-2 mb-3">
                  <History size={16} className="text-accent" />
                  Historique de progression CECRL
                </h4>
                <div className="space-y-2">
                  {selectedStudent.cefrHistory?.map((h, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-surface border border-surface-border text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <Badge variant="yellow" size="sm">
                          {h.level}
                        </Badge>
                        <span className="text-text-primary font-medium">{h.notes}</span>
                      </div>
                      <span className="text-text-muted font-mono">{h.date}</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Actions: Start lesson */}
              <div className="flex justify-end">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => onOpenLesson(undefined, selectedStudent.id)}
                  icon={<BookOpen size={16} />}
                >
                  Préparer un cours pour {selectedStudent.name}
                </Button>
              </div>
            </div>
          ) : (
            <Card padding="lg" className="text-center py-20">
              <Users size={40} className="mx-auto text-text-muted mb-3 opacity-40" />
              <h3 className="text-base font-semibold text-text-primary">Sélectionnez un élève</h3>
              <p className="text-xs text-text-secondary max-w-xs mx-auto mt-1">
                Cliquez sur un élève dans la liste de gauche pour consulter son dossier pédagogique complet.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Add / Edit Student Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditMode ? 'Modifier la fiche élève' : 'Créer un nouvel élève'}
        subtitle="Enregistrement local-first dans votre navigateur"
      >
        <form onSubmit={handleSaveStudent} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              Nom complet
            </label>
            <input
              type="text"
              required
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Marie Dupont"
              className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Niveau CECRL
              </label>
              <select
                value={formData.cefrLevel || 'B1'}
                onChange={(e) => setFormData({ ...formData, cefrLevel: e.target.value as CEFRLevel })}
                className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
              >
                {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as CEFRLevel[]).map((lvl) => (
                  <option key={lvl} value={lvl}>
                    Niveau {lvl}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Fuseau horaire (IANA)
              </label>
              <input
                type="text"
                value={formData.timezone || 'America/New_York'}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                placeholder="Ex: Europe/Paris, America/New_York"
                className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Durée par défaut
              </label>
              <select
                value={formData.defaultLength || 50}
                onChange={(e) => setFormData({ ...formData, defaultLength: Number(e.target.value) as 25 | 50 })}
                className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
              >
                <option value={25}>25 minutes</option>
                <option value={50}>50 minutes</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Tarif privé par cours ({currencySymbol})
              </label>
              <input
                type="number"
                value={formData.ratePerClass || 40}
                onChange={(e) => setFormData({ ...formData, ratePerClass: Number(e.target.value) })}
                className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              Objectifs de l'élève
            </label>
            <textarea
              rows={2}
              value={formData.goals || ''}
              onChange={(e) => setFormData({ ...formData, goals: e.target.value })}
              placeholder="Ex: Préparation au DELF B2, fluidité conversationnelle..."
              className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              Notes Privées (pour vous seul, jamais exportées)
            </label>
            <textarea
              rows={2}
              value={formData.privateNotes || ''}
              onChange={(e) => setFormData({ ...formData, privateNotes: e.target.value })}
              placeholder="Ex: A du mal avec les accords du participe passé..."
              className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              Notes Partagées (incluses dans les rapports de fin de mois)
            </label>
            <textarea
              rows={2}
              value={formData.shareableNotes || ''}
              onChange={(e) => setFormData({ ...formData, shareableNotes: e.target.value })}
              placeholder="Ex: Très bon engagement, travail régulier sur le vocabulaire..."
              className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-card-border">
            <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>
              Annuler
            </Button>
            <Button variant="primary" type="submit">
              {isEditMode ? 'Enregistrer les modifications' : 'Créer la fiche'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

