import React, { useState } from 'react';
import {
  FolderArchive,
  Search,
  Plus,
  BookOpen,
  Tag,
  Copy,
  Calendar,
  Layers,
  Trash2,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { db, queueMutation } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Exercise, CEFRLevel, LessonSnapshot } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface LibraryViewProps {
  onOpenLessonWithContent?: (title: string, content: string) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  onOpenLessonWithContent,
}) => {
  const exercises = useLiveQuery(() => db.exercises.filter((e) => !e.deleted).toArray()) || [];
  const snapshots = useLiveQuery(() => db.lessonSnapshots.toArray()) || [];

  const [activeTab, setActiveTab] = useState<'exercises' | 'archive'>('exercises');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New exercise form
  const [formData, setFormData] = useState<Partial<Exercise>>({
    title: '',
    level: 'B1',
    category: 'grammar',
    topic: '',
    content: '',
    tags: [],
  });
  const [tagsInput, setTagsInput] = useState('');

  const handleCreateExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    const nowIso = new Date().toISOString();
    const newExercise: Exercise = {
      id: 'ex_' + Date.now(),
      title: formData.title || 'Nouvel Exercice',
      level: (formData.level as CEFRLevel) || 'B1',
      category: (formData.category as any) || 'grammar',
      topic: formData.topic || 'Général',
      content: formData.content || '',
      tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
      createdAt: nowIso,
      updatedAt: nowIso,
      revision: 1,
      deleted: false,
      editingDevice: 'local',
    };

    await db.exercises.add(newExercise);
    await queueMutation('exercises', newExercise.id, 'create', 0, 1, newExercise);

    setIsModalOpen(false);
    setFormData({ title: '', level: 'B1', category: 'grammar', topic: '', content: '' });
    setTagsInput('');
  };

  const filteredExercises = exercises.filter((ex) => {
    const matchesSearch =
      ex.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ex.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ex.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = selectedLevel === 'all' || ex.level === selectedLevel;
    return matchesSearch && matchesLevel;
  });

  const filteredSnapshots = snapshots.filter((sn) => {
    const matchesSearch =
      sn.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sn.topicsCovered.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesLevel = selectedLevel === 'all' || sn.cefrLevel === selectedLevel;
    return matchesSearch && matchesLevel;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            Bibliothèque Pédagogique
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Banque d’exercices réutilisables et archive consultable de toutes les leçons enseignées.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex rounded-lg bg-surface border border-surface-border p-0.5 text-xs">
            <button
              onClick={() => setActiveTab('exercises')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeTab === 'exercises'
                  ? 'bg-accent/20 text-accent font-bold'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Exercices ({exercises.length})
            </button>
            <button
              onClick={() => setActiveTab('archive')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeTab === 'archive'
                  ? 'bg-accent/20 text-accent font-bold'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Historique des cours ({snapshots.length})
            </button>
          </div>

          {activeTab === 'exercises' && (
            <Button
              variant="primary"
              size="md"
              icon={<Plus size={16} />}
              onClick={() => setIsModalOpen(true)}
            >
              Ajouter un exercice
            </Button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par titre, thème, élève ou mot-clé..."
            className="w-full bg-card border border-card-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {['all', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setSelectedLevel(lvl)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors shrink-0 ${
                selectedLevel === lvl
                  ? 'bg-accent text-black font-bold border-accent'
                  : 'bg-surface border-surface-border text-text-secondary hover:text-text-primary'
              }`}
            >
              {lvl === 'all' ? 'Tous niveaux' : lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Exercises Tab Content */}
      {activeTab === 'exercises' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredExercises.length === 0 ? (
            <div className="col-span-2 text-center py-12 text-xs text-text-muted">
              Aucun exercice ne correspond à votre recherche.
            </div>
          ) : (
            filteredExercises.map((ex) => (
              <Card key={ex.id} padding="md" className="space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-text-primary text-base">{ex.title}</h4>
                    <Badge variant="yellow" size="sm">
                      {ex.level}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 mt-1 text-xs text-text-secondary">
                    <span className="capitalize">{ex.category}</span>
                    <span>•</span>
                    <span>{ex.topic}</span>
                  </div>

                  <p className="text-xs text-text-primary mt-3 whitespace-pre-wrap line-clamp-4 leading-relaxed font-mono bg-surface p-2.5 rounded-lg border border-surface-border">
                    {ex.content}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-card-border">
                  <div className="flex items-center gap-1 flex-wrap">
                    {ex.tags?.map((t, idx) => (
                      <span key={idx} className="text-[10px] text-text-dim bg-surface px-1.5 py-0.5 rounded">
                        #{t}
                      </span>
                    ))}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(ex.content);
                      alert('Contenu de l’exercice copié dans le presse-papier !');
                    }}
                    icon={<Copy size={13} />}
                    className="text-xs py-1 h-7"
                  >
                    Copier
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Snapshots Archive Tab Content (PRD Section 3.4) */}
      {activeTab === 'archive' && (
        <div className="space-y-3">
          {filteredSnapshots.length === 0 ? (
            <div className="text-center py-12 text-xs text-text-muted">
              Aucune leçon complétée archivée pour le moment.
            </div>
          ) : (
            filteredSnapshots.map((sn) => (
              <Card key={sn.id} padding="md" className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-text-primary text-base">
                      {sn.studentName}
                    </span>
                    <Badge variant="yellow" size="sm">
                      {sn.cefrLevel}
                    </Badge>
                    <span className="text-xs text-text-muted">
                      {sn.actualMinutes} min • {format(new Date(sn.completedAt), 'd MMMM yyyy', { locale: fr })}
                    </span>
                  </div>

                  <div className="text-xs font-mono font-semibold text-accent">
                    +{sn.earnedAmount}€
                  </div>
                </div>

                <div className="text-xs text-text-secondary">
                  <strong>Thèmes abordés :</strong> {sn.topicsCovered.join(', ')}
                </div>

                {sn.vocabularyReviewed?.length > 0 && (
                  <div className="text-xs text-text-dim">
                    <strong>Vocabulaire révisé ({sn.vocabularyReviewed.length}) :</strong>{' '}
                    {sn.vocabularyReviewed.map((v) => v.french).join(', ')}
                  </div>
                )}

                {sn.homeworkText && (
                  <div className="p-2 rounded bg-surface border border-surface-border text-xs text-text-primary">
                    <strong>Devoirs donnés :</strong> {sn.homeworkText}
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      )}

      {/* Add Exercise Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Ajouter un exercice à la bibliothèque"
        subtitle="Enregistré pour être réutilisé par copie dans vos futurs plans"
      >
        <form onSubmit={handleCreateExercise} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              Titre de l'exercice
            </label>
            <input
              type="text"
              required
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ex: Raconter ses vacances au passé composé"
              className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Niveau CECRL
              </label>
              <select
                value={formData.level || 'B1'}
                onChange={(e) => setFormData({ ...formData, level: e.target.value as CEFRLevel })}
                className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
              >
                {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as CEFRLevel[]).map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Catégorie
              </label>
              <select
                value={formData.category || 'grammar'}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
              >
                <option value="grammar">Grammaire</option>
                <option value="reading">Lecture</option>
                <option value="vocabulary">Vocabulaire</option>
                <option value="speaking">Expression orale</option>
                <option value="warmup">Échauffement</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Thématique
              </label>
              <input
                type="text"
                value={formData.topic || ''}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                placeholder="Ex: Vacances, Débat..."
                className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              Contenu de l'exercice / Questions
            </label>
            <textarea
              rows={5}
              required
              value={formData.content || ''}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Rédigez ou collez le texte d'exercice, phrases à trous, jeu de rôle..."
              className="w-full bg-surface border border-surface-border rounded-lg p-3 text-xs text-text-primary focus:outline-none focus:border-accent font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              Mots-clés (séparés par des virgules)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="Ex: subjonctif, passé composé, voyage"
              className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-card-border">
            <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>
              Annuler
            </Button>
            <Button variant="primary" type="submit">
              Enregistrer l'exercice
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

