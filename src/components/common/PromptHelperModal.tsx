import React, { useState, useEffect } from 'react';
import { Copy, Check, Sparkles, Wand2 } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Student, CEFRLevel } from '../../types';
import { db } from '../../db';
import { useLiveQuery } from 'dexie-react-hooks';

interface PromptHelperModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStudentId?: string;
  initialTopic?: string;
}

export const PromptHelperModal: React.FC<PromptHelperModalProps> = ({
  isOpen,
  onClose,
  initialStudentId,
  initialTopic = '',
}) => {
  const students = useLiveQuery(() => db.students.filter((s) => !s.isArchived && !s.deleted).toArray()) || [];

  const [selectedStudentId, setSelectedStudentId] = useState<string>(initialStudentId || '');
  const [cefrLevel, setCefrLevel] = useState<CEFRLevel>('B1');
  const [classLength, setClassLength] = useState<25 | 50>(50);
  const [topic, setTopic] = useState<string>(initialTopic);
  const [grammarTarget, setGrammarTarget] = useState<string>('');
  const [promptStyle, setPromptStyle] = useState<string>('balanced');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (initialStudentId) {
      setSelectedStudentId(initialStudentId);
    } else if (students.length > 0 && !selectedStudentId) {
      setSelectedStudentId(students[0].id);
    }
  }, [initialStudentId, students]);

  useEffect(() => {
    const student = students.find((s) => s.id === selectedStudentId);
    if (student) {
      setCefrLevel(student.cefrLevel);
      setClassLength(student.defaultLength);
    }
  }, [selectedStudentId, students]);

  // Construct dynamic prompt for external AI
  const student = students.find((s) => s.id === selectedStudentId);
  const studentName = student?.name || 'mon élève';
  const studentGoals = student?.goals || 'perfectionnement général et conversation fluide';

  const generatePrompt = (): string => {
    const timeBreakdown =
      classLength === 25
        ? '1. Échauffement / Warm-up (3 min)\n2. Vocabulaire ciblé (5 min, 4 mots clés)\n3. Lecture / Support court (7 min)\n4. Pratique orale dirigée (5 min)\n5. Bilan & Devoirs (5 min)'
        : '1. Échauffement & Réactivation (5 min)\n2. Vocabulaire clé (10 min, 6-8 expressions)\n3. Compréhension écrite/dialogue (12 min)\n4. Point grammaire ciblé (10 min)\n5. Débat / Jeu de rôle spontané (8 min)\n6. Révision & Devoirs (5 min)';

    let objectiveNote = '';
    if (promptStyle === 'conversation') {
      objectiveNote = 'Priorité absolue à la production orale spontanée, aux questions de relance et aux jeux de rôle naturels.';
    } else if (promptStyle === 'grammar') {
      objectiveNote = `Mets l'accent sur la règle grammaticale ${grammarTarget ? `("${grammarTarget}")` : ''}, avec des exemples contrastés, des explications intuitives en français et 3 questions de mise en application orale.`;
    } else if (promptStyle === 'trial') {
      objectiveNote = 'Format spécial cours d’essai Preply : dynamique, valorisant, centré sur la mise en confiance, le diagnostic bienveillant et l’envie de continuer.';
    } else {
      objectiveNote = 'Format équilibré alliant compréhension, acquisition de vocabulaire contextuel et réutilisation orale immédiate.';
    }

    return `Tu es un tuteur expert de français langue étrangère (FLE) pour des cours particuliers individuels en ligne sur Preply.
Conçois un plan de cours prêt à l'emploi et structuré pour un cours de ${classLength} minutes.

PROFIL DE L'ÉLÈVE :
- Nom : ${studentName}
- Niveau CECRL : ${cefrLevel}
- Objectifs : ${studentGoals}
- Sujet du cours : ${topic || 'Conversation du quotidien et expression d’opinions'}
${grammarTarget ? `- Point de grammaire ciblé : ${grammarTarget}` : ''}
- Spécificité : ${objectiveNote}

STRUCTURE ATTENDUE DU PLAN (Respecte scrupuleusement le budget temps de ${classLength} minutes) :
${timeBreakdown}

POUR CHAQUE BLOC DU PLAN, FOURNIS :
- Le titre du bloc avec le timing en minutes
- Les consignes concrètes pour le tuteur
- Le contenu exact à afficher ou poser à l'élève (questions claires, dialogue, ou phrases d'exemple adaptées au niveau ${cefrLevel})
- Une liste de vocabulaire clé formatée exactement sous la forme : "mot_français - traduction_anglaise - phrase d'exemple"
- 2 devoirs courts et motivants pour la séance suivante

Rédige le contenu en français adapté au niveau ${cefrLevel}. Sois direct, pédagogique et immédiatement utilisable pendant le cours.`;
  };

  const fullPrompt = generatePrompt();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy prompt to clipboard', err);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assistant Prompt Externe (Copy Prompt)"
      subtitle="Générez un prompt optimisé pour ChatGPT / Claude / Gemini sans aucun appel API direct"
      maxWidth="3xl"
    >
      <div className="space-y-5">
        {/* Tutor info alert */}
        <div className="p-3.5 rounded-xl bg-accent/10 border border-accent/25 text-xs text-text-primary flex items-start gap-3">
          <Sparkles size={18} className="text-accent shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-semibold text-accent">100% Privé & Sans Coût d’API :</span>{' '}
            L’application ne communique avec aucune IA en arrière-plan. Cliquez sur le bouton pour copier le prompt personnalisé et collez-le dans l’IA de votre choix (ChatGPT, Claude, etc.), puis collez le résultat dans l’éditeur de cours !
          </div>
        </div>

        {/* Form Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
          {/* Student Selector */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              Élève
            </label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="">Sélectionner un élève...</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.cefrLevel})
                </option>
              ))}
            </select>
          </div>

          {/* CEFR Level */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              Niveau CECRL
            </label>
            <select
              value={cefrLevel}
              onChange={(e) => setCefrLevel(e.target.value as CEFRLevel)}
              className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as CEFRLevel[]).map((lvl) => (
                <option key={lvl} value={lvl}>
                  Niveau {lvl}
                </option>
              ))}
            </select>
          </div>

          {/* Class Length */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              Durée du cours
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setClassLength(25)}
                className={`py-2 text-sm rounded-lg font-medium transition-colors border ${
                  classLength === 25
                    ? 'bg-accent/20 border-accent text-accent font-bold'
                    : 'bg-surface border-surface-border text-text-secondary hover:text-text-primary'
                }`}
              >
                25 minutes
              </button>
              <button
                type="button"
                onClick={() => setClassLength(50)}
                className={`py-2 text-sm rounded-lg font-medium transition-colors border ${
                  classLength === 50
                    ? 'bg-accent/20 border-accent text-accent font-bold'
                    : 'bg-surface border-surface-border text-text-secondary hover:text-text-primary'
                }`}
              >
                50 minutes
              </button>
            </div>
          </div>
        </div>

        {/* Topic & Grammar Targets */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              Thème / Sujet du cours
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ex: Raconter des souvenirs d'enfance, Débat télétravail..."
              className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              Point de grammaire (optionnel)
            </label>
            <input
              type="text"
              value={grammarTarget}
              onChange={(e) => setGrammarTarget(e.target.value)}
              placeholder="Ex: Passé composé vs imparfait, Subjonctif..."
              className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Style Selection */}
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1.5">
            Orientation pédagogique
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'balanced', label: 'Équilibré standard' },
              { id: 'conversation', label: 'Conversation orale' },
              { id: 'grammar', label: 'Focus Grammaire' },
              { id: 'trial', label: 'Cours d’essai' },
            ].map((style) => (
              <button
                key={style.id}
                type="button"
                onClick={() => setPromptStyle(style.id)}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors border text-left truncate ${
                  promptStyle === style.id
                    ? 'bg-accent/20 border-accent text-accent font-semibold'
                    : 'bg-surface border-surface-border text-text-secondary hover:text-text-primary'
                }`}
              >
                {style.label}
              </button>
            ))}
          </div>
        </div>

        {/* Live Prompt Preview */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
              <Wand2 size={13} className="text-accent" /> Aperçu du prompt généré
            </span>
            <span className="text-[11px] text-text-dim font-mono">
              {fullPrompt.length} caractères
            </span>
          </div>

          <div className="relative">
            <textarea
              readOnly
              rows={7}
              value={fullPrompt}
              className="w-full bg-background border border-card-border rounded-xl p-3.5 text-xs text-text-primary font-mono leading-relaxed resize-none focus:outline-none focus:border-accent/50"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-card-border">
          <Button variant="ghost" onClick={onClose}>
            Fermer
          </Button>

          <Button
            variant="primary"
            size="md"
            icon={copied ? <Check size={16} /> : <Copy size={16} />}
            onClick={handleCopy}
            className="min-w-[190px]"
          >
            {copied ? 'Copié dans le presse-papier !' : 'Copier le Prompt'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

