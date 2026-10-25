import React, { useState } from 'react';
import {
  MessageSquare,
  Copy,
  Check,
  Plus,
  Send,
  Edit,
  Globe,
  Sparkles,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { db, queueMutation } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { MessageTemplate, TemplateCategory } from '../types';

interface TemplatesViewProps {
  initialCategory?: string;
  initialStudentId?: string;
}

export const TemplatesView: React.FC<TemplatesViewProps> = ({
  initialCategory,
  initialStudentId,
}) => {
  const templates = useLiveQuery(() => db.templates.filter((t) => !t.deleted).toArray()) || [];
  const students = useLiveQuery(() => db.students.filter((s) => !s.isArchived && !s.deleted).toArray()) || [];
  const bookings = useLiveQuery(() => db.bookings.filter((b) => !b.deleted).toArray()) || [];
  const lessons = useLiveQuery(() => db.lessons.filter((l) => !l.deleted).toArray()) || [];

  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory || 'all');
  const [selectedLanguage, setSelectedLanguage] = useState<'all' | 'fr' | 'en'>('all');
  const [selectedStudentId, setSelectedStudentId] = useState<string>(initialStudentId || '');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter templates
  const filteredTemplates = templates.filter((tpl) => {
    const matchesCat = selectedCategory === 'all' || tpl.category === selectedCategory;
    const matchesLang = selectedLanguage === 'all' || tpl.language === selectedLanguage;
    return matchesCat && matchesLang;
  });

  const student = students.find((s) => s.id === selectedStudentId);

  // Compute dynamic placeholder replacements
  const getFilledBody = (rawBody: string): { filled: string; unfilledKeys: string[] } => {
    const studentBooking = bookings.find((b) => b.studentId === selectedStudentId);
    const studentLesson = lessons.find((l) => l.studentId === selectedStudentId);

    const replacements: Record<string, string> = {
      '{student_name}': student?.name || '',
      '{next_class_local_time}': studentBooking ? 'demain à 15h00' : '',
      '{tutor_time}': studentBooking ? '15h00' : '',
      '{homework}': studentLesson?.homework.text || 'les exercices de grammaire sur le passé composé',
      '{last_topic}': studentLesson?.title || 'la conversation du quotidien',
      '{month}': 'ce mois-ci',
    };

    let filled = rawBody;
    const unfilledKeys: string[] = [];

    Object.entries(replacements).forEach(([placeholder, val]) => {
      if (rawBody.includes(placeholder)) {
        if (!val) {
          unfilledKeys.push(placeholder);
        } else {
          filled = filled.split(placeholder).join(val);
        }
      }
    });

    return { filled, unfilledKeys };
  };

  const handleCopy = async (tpl: MessageTemplate, filledText: string) => {
    try {
      await navigator.clipboard.writeText(filledText);
      setCopiedId(tpl.id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const categories: Array<{ id: string; label: string }> = [
    { id: 'all', label: 'Toutes les catégories' },
    { id: 'trial_followup', label: 'Suivi cours d’essai' },
    { id: 'booking_confirmation', label: 'Confirmation créneau' },
    { id: 'homework_reminder', label: 'Rappel devoirs' },
    { id: 'lesson_recap', label: 'Bilan de cours' },
    { id: 'renewal_package', label: 'Renouvellement forfait' },
    { id: 'cancellation_noshow', label: 'Annulation / Absence' },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            Modèles de Messages Preply
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Remplissage automatique des variables élèves • Copie en 1 clic pour le chat Preply.
          </p>
        </div>
      </div>

      {/* Target Student Selector for Dynamic Replacement */}
      <Card padding="md" variant="accent-border">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              Remplir automatiquement pour un élève :
            </label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full sm:w-80 bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="">Sélectionner un élève pour pré-remplir les variables...</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.cefrLevel})
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs text-text-dim flex items-center gap-2">
            <Sparkles size={16} className="text-accent" />
            <span>Remplace {`{student_name}`}, {`{next_class_local_time}`}, {`{homework}`}</span>
          </div>
        </div>
      </Card>

      {/* Filters: Category & Language */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all shrink-0 cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-primary text-black border-primary'
                  : 'bg-card border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Language selector */}
        <div className="flex rounded-xl bg-card border border-border p-1 text-xs shrink-0 self-end sm:self-center">
          <button
            onClick={() => setSelectedLanguage('all')}
            className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
              selectedLanguage === 'all' ? 'bg-primary text-black' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Tous
          </button>
          <button
            onClick={() => setSelectedLanguage('fr')}
            className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
              selectedLanguage === 'fr' ? 'bg-primary text-black' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Français
          </button>
          <button
            onClick={() => setSelectedLanguage('en')}
            className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
              selectedLanguage === 'en' ? 'bg-primary text-black' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            English
          </button>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTemplates.map((tpl) => {
          const { filled, unfilledKeys } = getFilledBody(tpl.body);
          const isCopied = copiedId === tpl.id;

          return (
            <Card key={tpl.id} className="space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-bold text-foreground text-base">{tpl.title}</h4>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="yellow" size="sm" className="uppercase">
                      {tpl.language}
                    </Badge>
                  </div>
                </div>

                {/* Highlight missing placeholders if any */}
                {unfilledKeys.length > 0 && (
                  <div className="mt-2 p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-300">
                    Variables non renseignées : {unfilledKeys.join(', ')}
                  </div>
                )}

                <div className="mt-3 p-3.5 rounded-xl bg-background border border-border text-xs text-foreground leading-relaxed whitespace-pre-wrap font-sans">
                  {filled}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-[10px] text-muted-foreground">
                  Prêt à coller dans le chat Preply
                </span>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleCopy(tpl, filled)}
                  icon={isCopied ? <Check size={14} /> : <Copy size={14} />}
                  className="text-xs"
                >
                  {isCopied ? 'Copié !' : 'Copier le message'}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

