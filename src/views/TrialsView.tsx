import React, { useState } from 'react';
import {
  UserCheck,
  Plus,
  Send,
  ArrowRight,
  Sparkles,
  Clock,
  Calendar,
  CheckCircle2,
  Trash2,
  Edit,
  Smile,
  XCircle,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { db, queueMutation } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Trial, TrialStatus, Student } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface TrialsViewProps {
  onOpenLesson: (lessonId?: string, studentId?: string) => void;
  onOpenTemplate: (category?: string, studentId?: string) => void;
  onOpenStudent: (studentId: string) => void;
}

export const TrialsView: React.FC<TrialsViewProps> = ({
  onOpenLesson,
  onOpenTemplate,
  onOpenStudent,
}) => {
  const settings = useLiveQuery(() => db.settings.get('current'));
  const trials = useLiveQuery(() => db.trials.filter((t) => !t.deleted).toArray()) || [];

  const [selectedTrial, setSelectedTrial] = useState<Trial | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Partial<Trial>>({
    name: '',
    statedLevel: 'A1 - Faux débutant',
    goals: '',
    motivations: '',
    priorExposure: '',
    timezone: 'America/New_York',
    targetLength: 25,
    status: 'planned',
    postClassNotes: '',
    rate: 15,
  });

  const currencySymbol = settings?.currencySymbol || '€';

  const handleOpenCreateModal = () => {
    setIsEditMode(false);
    setFormData({
      name: '',
      statedLevel: 'A1 - Faux débutant',
      goals: '',
      motivations: '',
      priorExposure: '',
      timezone: 'America/New_York',
      targetLength: 25,
      status: 'planned',
      postClassNotes: '',
      rate: settings?.defaultRates.trial25 || 15,
    });
    setIsModalOpen(true);
  };

  const handleSaveTrial = async (e: React.FormEvent) => {
    e.preventDefault();
    const nowIso = new Date().toISOString();

    if (isEditMode && formData.id) {
      const existing = await db.trials.get(formData.id);
      if (!existing) return;

      const updated: Trial = {
        ...existing,
        ...formData,
        updatedAt: nowIso,
        revision: existing.revision + 1,
      } as Trial;

      await db.trials.put(updated);
      await queueMutation('trials', updated.id, 'update', existing.revision, updated.revision, updated);
      if (selectedTrial?.id === updated.id) setSelectedTrial(updated);
    } else {
      const newId = 'trial_' + Date.now();
      const newTrial: Trial = {
        id: newId,
        name: formData.name || 'Nouvel Élève Essai',
        statedLevel: formData.statedLevel || 'A1',
        goals: formData.goals || '',
        motivations: formData.motivations || '',
        priorExposure: formData.priorExposure || '',
        timezone: formData.timezone || 'America/New_York',
        targetLength: (formData.targetLength as 25 | 50) || 25,
        status: (formData.status as TrialStatus) || 'planned',
        trialDate: nowIso,
        postClassNotes: formData.postClassNotes || '',
        rate: Number(formData.rate) || 15,
        createdAt: nowIso,
        updatedAt: nowIso,
        revision: 1,
        deleted: false,
        editingDevice: settings?.deviceId || 'local',
      };

      await db.trials.add(newTrial);
      await queueMutation('trials', newTrial.id, 'create', 0, 1, newTrial);
      setSelectedTrial(newTrial);
    }

    setIsModalOpen(false);
  };

  const handleUpdateStatus = async (trial: Trial, newStatus: TrialStatus) => {
    const updated = {
      ...trial,
      status: newStatus,
      updatedAt: new Date().toISOString(),
      revision: trial.revision + 1,
    };
    await db.trials.put(updated);
    await queueMutation('trials', trial.id, 'update', trial.revision, updated.revision, updated);
    if (selectedTrial?.id === trial.id) setSelectedTrial(updated);
  };

  // Convert Trial to Regular Student (PRD Section 3.4)
  const handleConvertToStudent = async (trial: Trial) => {
    const studentId = 'stu_' + Date.now();
    const nowIso = new Date().toISOString();

    // Map stated level to closest CEFR
    let cefr: any = 'A1';
    if (trial.statedLevel.includes('A2')) cefr = 'A2';
    else if (trial.statedLevel.includes('B1')) cefr = 'B1';
    else if (trial.statedLevel.includes('B2')) cefr = 'B2';

    const newStudent: Student = {
      id: studentId,
      name: trial.name,
      cefrLevel: cefr,
      cefrHistory: [
        {
          level: cefr,
          date: nowIso.split('T')[0],
          notes: `Converti depuis le cours d'essai. Niveau initial déclaré : ${trial.statedLevel}`,
        },
      ],
      timezone: trial.timezone,
      goals: `${trial.goals} (Motivations: ${trial.motivations})`,
      defaultLength: trial.targetLength,
      communicationLanguage: 'fr',
      ratePerClass: settings?.defaultRates.standard50 || 40,
      privateNotes: `Antécédents : ${trial.priorExposure}\nBilan d'essai : ${trial.postClassNotes}`,
      shareableNotes: 'Bienvenue ! Très bon début lors de la séance d’essai.',
      isArchived: false,
      createdAt: nowIso,
      updatedAt: nowIso,
      revision: 1,
      deleted: false,
      editingDevice: settings?.deviceId || 'local',
    };

    // Update trial with converted student ID and status
    const updatedTrial: Trial = {
      ...trial,
      status: 'converted',
      convertedStudentId: studentId,
      updatedAt: nowIso,
      revision: trial.revision + 1,
    };

    await db.students.add(newStudent);
    await queueMutation('students', newStudent.id, 'create', 0, 1, newStudent);

    await db.trials.put(updatedTrial);
    await queueMutation('trials', trial.id, 'update', trial.revision, updatedTrial.revision, updatedTrial);

    setSelectedTrial(updatedTrial);
    onOpenStudent(studentId);
  };

  const getStatusBadge = (status: TrialStatus) => {
    switch (status) {
      case 'planned':
        return <Badge variant="neutral" size="sm">Planifié</Badge>;
      case 'held':
        return <Badge variant="yellow" size="sm">Cours tenu</Badge>;
      case 'followed_up':
        return <Badge variant="outline" size="sm" className="text-accent border-accent/40">Suivi envoyé</Badge>;
      case 'converted':
        return <Badge variant="success" size="sm">Converti en élève régulier</Badge>;
      case 'lost':
        return <Badge variant="danger" size="sm">Non converti</Badge>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            Cours d’Essai & Entonnoir
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Suivi des élèves en cours d’essai Preply, de la préparation au message de suivi et à la conversion.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          icon={<Plus size={16} />}
          onClick={handleOpenCreateModal}
        >
          Nouvel élève essai
        </Button>
      </div>

      {/* Main Grid: Pipeline cards or list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Trials List */}
        <div className="lg:col-span-1 space-y-3">
          {trials.length === 0 ? (
            <Card padding="lg" className="text-center py-8">
              <UserCheck size={32} className="mx-auto text-muted-foreground mb-2 opacity-50" />
              <p className="text-xs text-muted-foreground">Aucun cours d’essai enregistré.</p>
            </Card>
          ) : (
            trials.map((trial) => {
              const isSelected = selectedTrial?.id === trial.id;
              return (
                <div
                  key={trial.id}
                  onClick={() => setSelectedTrial(trial)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-card border-primary/60 shadow-sm'
                      : 'bg-card/70 border-border/80 hover:border-border hover:bg-card'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-foreground text-base leading-tight">
                        {trial.name}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {trial.statedLevel} • {trial.targetLength} min
                      </p>
                    </div>
                    <div>{getStatusBadge(trial.status)}</div>
                  </div>

                  <p className="text-xs text-muted-foreground mt-2.5 line-clamp-2">
                    {trial.goals || 'Objectifs non précisés'}
                  </p>

                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/60 text-[11px] text-muted-foreground">
                    <span>{trial.timezone.split('/')[1]?.replace('_', ' ')}</span>
                    <span className="font-mono">{format(new Date(trial.trialDate), 'd MMM yyyy')}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right: Selected Trial Detail */}
        <div className="lg:col-span-2">
          {selectedTrial ? (
            <div className="space-y-6">
              {/* Header Card */}
              <Card padding="lg" variant="accent-border">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-2xl font-bold text-text-primary">
                        {selectedTrial.name}
                      </h3>
                      {getStatusBadge(selectedTrial.status)}
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-xs text-text-secondary">
                      <span>Niveau déclaré : <strong className="text-text-primary">{selectedTrial.statedLevel}</strong></span>
                      <span>Durée : <strong className="text-text-primary">{selectedTrial.targetLength} min</strong></span>
                      <span>Tarif : <strong className="text-text-primary">{currencySymbol}{selectedTrial.rate}</strong></span>
                    </div>
                  </div>

                  {/* Conversion / Status quick buttons */}
                  <div className="flex items-center gap-2">
                    {selectedTrial.status !== 'converted' ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleConvertToStudent(selectedTrial)}
                        icon={<CheckCircle2 size={15} />}
                      >
                        Convertir en Élève
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => selectedTrial.convertedStudentId && onOpenStudent(selectedTrial.convertedStudentId)}
                        icon={<ArrowRight size={14} />}
                      >
                        Voir fiche élève
                      </Button>
                    )}
                  </div>
                </div>

                {/* Status stepper / selector */}
                <div className="mt-4 pt-4 border-t border-card-border">
                  <span className="text-xs font-semibold uppercase tracking-wider text-text-muted block mb-2">
                    Statut dans l’entonnoir
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {(['planned', 'held', 'followed_up', 'converted', 'lost'] as TrialStatus[]).map((st) => (
                      <button
                        key={st}
                        onClick={() => handleUpdateStatus(selectedTrial, st)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize ${
                          selectedTrial.status === st
                            ? 'bg-accent/20 border-accent text-accent font-bold'
                            : 'bg-surface border-surface-border text-text-muted hover:text-text-primary'
                        }`}
                      >
                        {st.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Pre-class dossier */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card padding="md">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">
                    Objectifs & Motivations
                  </h5>
                  <p className="text-xs text-text-primary leading-relaxed whitespace-pre-wrap">
                    {selectedTrial.goals || 'Non précisés.'}
                  </p>
                  {selectedTrial.motivations && (
                    <div className="mt-3 pt-2 border-t border-card-border text-xs text-text-secondary">
                      <strong>Motivations profondes :</strong> {selectedTrial.motivations}
                    </div>
                  )}
                </Card>

                <Card padding="md">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">
                    Expérience passée & Apprentissage antérieur
                  </h5>
                  <p className="text-xs text-text-primary leading-relaxed whitespace-pre-wrap">
                    {selectedTrial.priorExposure || 'Aucune mention renseignée.'}
                  </p>
                </Card>
              </div>

              {/* Post-class notes */}
              <Card padding="md">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                    Bilan post-séance d’essai & Impressions du tuteur
                  </h5>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onOpenTemplate('trial_followup')}
                    icon={<Send size={13} className="text-accent" />}
                    className="text-xs py-1 h-7"
                  >
                    Envoyer message Preply
                  </Button>
                </div>
                <p className="text-xs text-text-primary leading-relaxed min-h-[50px] whitespace-pre-wrap">
                  {selectedTrial.postClassNotes || 'Aucun bilan rédigé pour le moment.'}
                </p>
              </Card>
            </div>
          ) : (
            <Card padding="lg" className="text-center py-20">
              <UserCheck size={40} className="mx-auto text-text-muted mb-3 opacity-40" />
              <h3 className="text-base font-semibold text-text-primary">Sélectionnez un élève essai</h3>
              <p className="text-xs text-text-secondary max-w-xs mx-auto mt-1">
                Visualisez son profil avant le cours, enregistrez vos notes et convertissez-le en élève régulier en 1 clic.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Add Trial Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Ajouter un élève en cours d’essai"
        subtitle="Renseignez le diagnostic préalable pour maximiser la conversion"
      >
        <form onSubmit={handleSaveTrial} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              Nom complet
            </label>
            <input
              type="text"
              required
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Lucas Williams"
              className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Niveau déclaré
              </label>
              <input
                type="text"
                value={formData.statedLevel || ''}
                onChange={(e) => setFormData({ ...formData, statedLevel: e.target.value })}
                placeholder="Ex: A1 - Faux débutant"
                className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Durée prévue
              </label>
              <select
                value={formData.targetLength || 25}
                onChange={(e) => setFormData({ ...formData, targetLength: Number(e.target.value) as 25 | 50 })}
                className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
              >
                <option value={25}>25 minutes</option>
                <option value={50}>50 minutes</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              Objectifs déclarés
            </label>
            <textarea
              rows={2}
              value={formData.goals || ''}
              onChange={(e) => setFormData({ ...formData, goals: e.target.value })}
              placeholder="Ex: Voyage en France dans 6 mois, commander au restaurant..."
              className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              Motivations profondes & Contexte
            </label>
            <input
              type="text"
              value={formData.motivations || ''}
              onChange={(e) => setFormData({ ...formData, motivations: e.target.value })}
              placeholder="Ex: Belle-famille française, opportunité professionnelle..."
              className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              Expérience passée en français
            </label>
            <input
              type="text"
              value={formData.priorExposure || ''}
              onChange={(e) => setFormData({ ...formData, priorExposure: e.target.value })}
              placeholder="Ex: Cours au lycée il y a 5 ans + Duolingo régulier"
              className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-card-border">
            <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>
              Annuler
            </Button>
            <Button variant="primary" type="submit">
              Enregistrer l’essai
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

