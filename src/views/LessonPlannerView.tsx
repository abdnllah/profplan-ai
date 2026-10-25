import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Trash2,
  Clock,
  Sparkles,
  Printer,
  CheckCircle,
  FileText,
  AlertTriangle,
  MoveUp,
  MoveDown,
  Layers,
  ListPlus,
  Wand2,
  Share2,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { db, queueMutation } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Lesson,
  LessonBlock,
  BlockType,
  VocabularyItem,
  LessonSnapshot,
  ReviewedVocabSnapshot,
  LeitnerBox,
  VocabOutcome,
} from '../types';
import { generateLessonHandoutPdf } from '../utils/pdfGenerator';

interface LessonPlannerViewProps {
  initialLessonId?: string;
  initialStudentId?: string;
  onOpenPromptHelper: (studentId?: string) => void;
  onOpenStudent: (studentId: string) => void;
}

export const LessonPlannerView: React.FC<LessonPlannerViewProps> = ({
  initialLessonId,
  initialStudentId,
  onOpenPromptHelper,
  onOpenStudent,
}) => {
  const settings = useLiveQuery(() => db.settings.get('current'));
  const students = useLiveQuery(() => db.students.filter((s) => !s.isArchived && !s.deleted).toArray()) || [];
  const vocabulary = useLiveQuery(() => db.vocabulary.filter((v) => !v.deleted).toArray()) || [];

  const [selectedStudentId, setSelectedStudentId] = useState<string>(initialStudentId || '');
  const [classLength, setClassLength] = useState<25 | 50>(50);
  const [lessonTitle, setLessonTitle] = useState<string>('Séance de conversation & acquisition lexicale');
  const [blocks, setBlocks] = useState<LessonBlock[]>([]);
  const [homeworkText, setHomeworkText] = useState<string>('');
  const [homeworkStatus, setHomeworkStatus] = useState<'not_assigned' | 'drafted' | 'sent'>('drafted');

  // Leitner Vocab Review State for this lesson
  const [reviewedWords, setReviewedWords] = useState<
    Array<{ word: VocabularyItem; outcome: VocabOutcome }>
  >([]);

  // Modals for smart paste helpers
  const [isLessonPasteOpen, setIsLessonPasteOpen] = useState(false);
  const [pastedLessonText, setPastedLessonText] = useState('');
  const [isVocabPasteOpen, setIsVocabPasteOpen] = useState(false);
  const [pastedVocabText, setPastedVocabText] = useState('');
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);

  // Sync with initial IDs
  useEffect(() => {
    if (initialStudentId) {
      setSelectedStudentId(initialStudentId);
    } else if (students.length > 0 && !selectedStudentId) {
      setSelectedStudentId(students[0].id);
    }
  }, [initialStudentId, students]);

  // Load starter blocks when duration changes or student changes
  const student = students.find((s) => s.id === selectedStudentId);

  useEffect(() => {
    if (student) {
      setClassLength(student.defaultLength);
      loadDefaultBlocks(student.defaultLength);
      loadDueVocabulary(student.id, student.defaultLength);
    }
  }, [selectedStudentId]);

  const loadDefaultBlocks = (length: 25 | 50) => {
    const s25 = settings?.starterBlockMinutes?.m25;
    const s50 = settings?.starterBlockMinutes?.m50;

    if (length === 25) {
      setBlocks([
        { id: 'b_1', type: 'warmup', title: 'Échauffement', minutes: s25?.warmup ?? 3, content: "Questions informelles sur la semaine, mise en confiance et réactivation du français." },
        { id: 'b_2', type: 'vocabulary', title: 'Vocabulaire ciblé', minutes: s25?.vocabulary ?? 5, content: "Introduction et répétition des mots clés du jour en contexte." },
        { id: 'b_3', type: 'reading', title: 'Compréhension courte', minutes: s25?.reading ?? 7, content: "Lecture d'un dialogue ou d'un court extrait avec repérage des expressions." },
        { id: 'b_4', type: 'speaking', title: 'Pratique orale active', minutes: s25?.speaking ?? 5, content: "Mise en situation guidée ou jeu de rôle rapide." },
        { id: 'b_5', type: 'review', title: 'Bilan & Devoirs', minutes: s25?.review ?? 5, content: "Feedback immédiat, assignation des devoirs et validation des points clés." },
      ]);
    } else {
      setBlocks([
        { id: 'b_1', type: 'warmup', title: 'Échauffement & Brise-glace', minutes: s50?.warmup ?? 5, content: "Échange libre sur les actualités ou le quotidien de l'élève." },
        { id: 'b_2', type: 'vocabulary', title: 'Acquisition Vocabulaire', minutes: s50?.vocabulary ?? 10, content: "Travail sur les expressions thématiques avec exemples personnalisés." },
        { id: 'b_3', type: 'reading', title: 'Lecture & Analyse', minutes: s50?.reading ?? 12, content: "Article court, dialogue authentique ou analyse d'un texte francophone." },
        { id: 'b_4', type: 'grammar', title: 'Focus Grammaire', minutes: s50?.grammar ?? 10, content: "Règle ciblée, structures contrastées et exercices oraux guidés." },
        { id: 'b_5', type: 'speaking', title: 'Débat / Jeu de rôle spontané', minutes: s50?.speaking ?? 8, content: "Production orale libre et argumentative pour consolider les notions." },
        { id: 'b_6', type: 'review', title: 'Bilan de fin de cours', minutes: s50?.review ?? 5, content: "Récapitulatif des erreurs corrigées, rappel du vocabulaire et devoirs." },
      ]);
    }
  };

  const loadDueVocabulary = (studentId: string, length: 25 | 50) => {
    const studentVocab = vocabulary.filter((v) => v.studentId === studentId);
    const today = new Date().toISOString().split('T')[0];

    // Priority to struggling words, then due words
    const due = studentVocab
      .filter((v) => v.nextReviewDate <= today || v.status === 'struggling')
      .sort((a, b) => (b.status === 'struggling' ? 1 : 0) - (a.status === 'struggling' ? 1 : 0));

    const maxWords = length === 25 ? 4 : 8; // Per PRD Section 3.4
    const selected = due.slice(0, maxWords);

    setReviewedWords(selected.map((w) => ({ word: w, outcome: 'got_it' })));
  };

  // Block management
  const totalMinutes = blocks.reduce((sum, b) => sum + (Number(b.minutes) || 0), 0);
  const isOverBudget = totalMinutes > classLength;

  const handleUpdateBlock = (index: number, field: keyof LessonBlock, value: any) => {
    const newBlocks = [...blocks];
    newBlocks[index] = { ...newBlocks[index], [field]: value };
    setBlocks(newBlocks);
  };

  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === blocks.length - 1)
    ) {
      return;
    }
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const newBlocks = [...blocks];
    const [moved] = newBlocks.splice(index, 1);
    newBlocks.splice(targetIndex, 0, moved);
    setBlocks(newBlocks);
  };

  const handleRemoveBlock = (index: number) => {
    setBlocks(blocks.filter((_, i) => i !== index));
  };

  const handleAddBlock = () => {
    const newBlock: LessonBlock = {
      id: 'b_' + Date.now(),
      type: 'custom',
      title: 'Nouveau bloc',
      minutes: 5,
      content: '',
    };
    setBlocks([...blocks, newBlock]);
  };

  // Smart Lesson Paste Splitter (PRD Section 3.4)
  const handleSplitPastedLesson = () => {
    if (!pastedLessonText.trim()) return;

    const lines = pastedLessonText.split('\n');
    const newBlocks: LessonBlock[] = [];
    let currentTitle = 'Introduction';
    let currentContent: string[] = [];
    let currentMinutes = 5;

    lines.forEach((line) => {
      const trimmed = line.trim();
      const isHeading =
        trimmed.startsWith('#') ||
        trimmed.startsWith('1.') ||
        trimmed.startsWith('2.') ||
        trimmed.startsWith('3.') ||
        trimmed.startsWith('4.') ||
        trimmed.startsWith('5.') ||
        trimmed.startsWith('6.') ||
        /^(Échauffement|Warm-up|Vocabulaire|Lecture|Grammaire|Speaking|Bilan|Devoirs)/i.test(trimmed);

      if (isHeading && (currentContent.length > 0 || newBlocks.length > 0)) {
        if (currentContent.length > 0) {
          newBlocks.push({
            id: 'b_' + Math.random().toString(36).substring(2, 7),
            type: 'custom',
            title: currentTitle.replace(/^#+\s*/, '').replace(/^\d+\.\s*/, '').trim(),
            minutes: currentMinutes,
            content: currentContent.join('\n').trim(),
          });
        }
        currentTitle = trimmed;
        currentContent = [];

        // Estimate minutes if specified in header, e.g. (10 min)
        const match = trimmed.match(/(\d+)\s*(?:min|minutes)/i);
        currentMinutes = match ? parseInt(match[1], 10) : 5;
      } else {
        currentContent.push(line);
      }
    });

    if (currentContent.length > 0) {
      newBlocks.push({
        id: 'b_' + Math.random().toString(36).substring(2, 7),
        type: 'custom',
        title: currentTitle.replace(/^#+\s*/, '').replace(/^\d+\.\s*/, '').trim(),
        minutes: currentMinutes,
        content: currentContent.join('\n').trim(),
      });
    }

    if (newBlocks.length > 0) {
      setBlocks(newBlocks);
      setIsLessonPasteOpen(false);
      setPastedLessonText('');
    }
  };

  // Smart Vocabulary Paste Parser (PRD Section 3.4: "word - translation - example")
  const handleParsePastedVocab = async () => {
    if (!pastedVocabText.trim() || !selectedStudentId) return;

    const lines = pastedVocabText.split('\n');
    const newItems: VocabularyItem[] = [];
    const today = new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();

    lines.forEach((line) => {
      const parts = line.split('-').map((p) => p.trim());
      if (parts.length >= 2) {
        const french = parts[0];
        const english = parts[1];
        const example = parts[2] || '';

        newItems.push({
          id: 'voc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          studentId: selectedStudentId,
          french,
          english,
          exampleSentence: example,
          box: 1,
          status: 'introduced',
          consecutiveMisses: 0,
          introducedAt: today,
          nextReviewDate: today,
          reviewCount: 0,
          createdAt: nowIso,
          updatedAt: nowIso,
          revision: 1,
          deleted: false,
          editingDevice: settings?.deviceId || 'local',
        });
      }
    });

    if (newItems.length > 0) {
      await db.vocabulary.bulkPut(newItems);
      for (const item of newItems) {
        await queueMutation('vocabulary', item.id, 'create', 0, 1, item);
      }
      setIsVocabPasteOpen(false);
      setPastedVocabText('');
      loadDueVocabulary(selectedStudentId, classLength);
    }
  };

  // Complete lesson & create immutable snapshot (PRD Section 3.4)
  const handleCompleteLesson = async () => {
    if (!selectedStudentId || !student) return;

    const nowIso = new Date().toISOString();
    const snapshotId = 'snap_' + Date.now();

    // 1. Process vocabulary updates on Leitner schedule
    const reviewedSnapshots: ReviewedVocabSnapshot[] = [];

    for (const item of reviewedWords) {
      const word = item.word;
      let newBox: LeitnerBox = word.box;
      let consecutiveMisses = word.consecutiveMisses;
      let status = word.status;

      if (item.outcome === 'got_it') {
        newBox = Math.min(5, word.box + 1) as LeitnerBox;
        consecutiveMisses = 0;
        status = newBox === 5 ? 'mastered' : 'reviewed';
      } else if (item.outcome === 'missed') {
        newBox = 1;
        consecutiveMisses += 1;
        status = consecutiveMisses >= 2 ? 'struggling' : 'reviewed';
      } else {
        // 'shaky' -> keeps in place
        consecutiveMisses = 0;
      }

      // Compute next review date locally (PRD Section 3.4: Leitner spacing)
      // Box 1: 1 day, Box 2: 3 days, Box 3: 7 days, Box 4: 14 days, Box 5: 30 days
      const intervals = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 };
      const daysToAdd = intervals[newBox] || 1;
      const nextDate = new Date(Date.now() + daysToAdd * 86400000).toISOString().split('T')[0];

      const updatedWord: VocabularyItem = {
        ...word,
        box: newBox,
        status,
        consecutiveMisses,
        lastReviewedAt: nowIso.split('T')[0],
        nextReviewDate: nextDate,
        reviewCount: word.reviewCount + 1,
        updatedAt: nowIso,
        revision: word.revision + 1,
      };

      await db.vocabulary.put(updatedWord);
      await queueMutation('vocabulary', word.id, 'update', word.revision, updatedWord.revision, updatedWord);

      reviewedSnapshots.push({
        wordId: word.id,
        french: word.french,
        english: word.english,
        outcome: item.outcome,
        previousBox: word.box,
        newBox,
      });
    }

    // 2. Build immutable Lesson Snapshot
    const snapshot: LessonSnapshot = {
      id: snapshotId,
      lessonId: initialLessonId || 'les_' + Date.now(),
      studentId: student.id,
      studentName: student.name,
      cefrLevel: student.cefrLevel,
      completedAt: nowIso,
      actualMinutes: classLength,
      earnedAmount: student.ratePerClass || (classLength === 25 ? 22 : 40),
      blocks,
      vocabularyReviewed: reviewedSnapshots,
      homeworkText,
      homeworkSent: homeworkStatus === 'sent',
      topicsCovered: [lessonTitle],
      grammarCovered: blocks.filter((b) => b.type === 'grammar').map((b) => b.title),
      createdAt: nowIso,
      revision: 1,
      editingDevice: settings?.deviceId || 'local',
    };

    await db.lessonSnapshots.add(snapshot);
    await queueMutation('lessonSnapshots', snapshot.id, 'create', 0, 1, snapshot);

    setIsCompletionModalOpen(false);
    alert('Félicitations ! Séance validée et enregistrée dans le dossier de l’élève.');
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            Préparation de Cours
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Éditeur par blocs avec budget temps, répétition espacée Leitner et export PDF hors-ligne.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenPromptHelper(selectedStudentId)}
            icon={<Sparkles size={14} className="text-accent" />}
          >
            Prompt Helper
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsLessonPasteOpen(true)}
            icon={<Wand2 size={14} />}
          >
            Coller un plan externe
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (student) {
                generateLessonHandoutPdf(
                  {
                    id: 'temp',
                    studentId: student.id,
                    title: lessonTitle,
                    classLength,
                    scheduledAt: new Date().toISOString(),
                    status: 'ready',
                    blocks,
                    homework: { text: homeworkText, status: homeworkStatus },
                    vocabularyIds: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    revision: 1,
                    deleted: false,
                    editingDevice: 'local',
                  },
                  student.name,
                  student.cefrLevel,
                  reviewedWords.map((r) => r.word),
                  settings
                );
              }
            }}
            icon={<Printer size={14} />}
          >
            Fiche PDF
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCompletionModalOpen(true)}
            icon={<CheckCircle size={15} />}
          >
            Marquer comme enseigné
          </Button>
        </div>
      </div>

      {/* Main Form Settings & Time Budget Bar */}
      <div className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Élève
            </label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            >
              <option value="">Sélectionner un élève...</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.cefrLevel} • {s.defaultLength} min)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Titre / Thème de la séance
            </label>
            <input
              type="text"
              value={lessonTitle}
              onChange={(e) => setLessonTitle(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Durée du cours
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setClassLength(25);
                  loadDefaultBlocks(25);
                  if (selectedStudentId) loadDueVocabulary(selectedStudentId, 25);
                }}
                className={`py-2 text-xs rounded-xl font-semibold border transition-all cursor-pointer ${
                  classLength === 25
                    ? 'bg-primary text-black border-primary'
                    : 'bg-background border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                25 minutes
              </button>
              <button
                type="button"
                onClick={() => {
                  setClassLength(50);
                  loadDefaultBlocks(50);
                  if (selectedStudentId) loadDueVocabulary(selectedStudentId, 50);
                }}
                className={`py-2 text-xs rounded-xl font-semibold border transition-all cursor-pointer ${
                  classLength === 50
                    ? 'bg-primary text-black border-primary'
                    : 'bg-background border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                50 minutes
              </button>
            </div>
          </div>
        </div>

        {/* Time Budget Indicator (PRD Section 3.4) */}
        <div className="pt-4 border-t border-border">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
              <Clock size={14} className={isOverBudget ? 'text-destructive' : 'text-primary'} />
              Budget Temps : <strong className="text-foreground font-mono">{totalMinutes} min</strong> prévues sur <strong className="text-foreground font-mono">{classLength} min</strong>
            </span>
            {isOverBudget && (
              <span className="text-destructive font-bold flex items-center gap-1 text-[11px]">
                <AlertTriangle size={13} /> Dépassement de {totalMinutes - classLength} minutes !
              </span>
            )}
          </div>

          {/* Visual progress bar */}
          <div className="w-full h-2 rounded-full bg-background overflow-hidden border border-border">
            <div
              className={`h-full transition-all duration-300 ${
                isOverBudget ? 'bg-destructive' : 'bg-primary'
              }`}
              style={{ width: `${Math.min(100, (totalMinutes / classLength) * 100)}%` }}
            />
          </div>
        </div>
      </div>


      {/* Leitner Spaced Repetition Vocabulary Integration (PRD Section 3.4) */}
      <Card padding="md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
              <Layers size={16} className="text-accent" />
              Vocabulaire dû pour cette séance (Système Leitner 5 Boîtes)
            </h3>
            <p className="text-[11px] text-text-secondary mt-0.5">
              Intégré automatiquement au budget temps ({classLength === 25 ? 'max 4 mots' : 'max 8 mots'}, mots difficiles en priorité).
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsVocabPasteOpen(true)}
            icon={<ListPlus size={14} />}
            className="text-xs py-1 h-7"
          >
            Importer du vocabulaire (coller)
          </Button>
        </div>

        <div className="space-y-2">
          {reviewedWords.length === 0 ? (
            <p className="text-xs text-text-muted py-2 italic text-center">
              Aucun mot de vocabulaire en attente de révision pour cet élève.
            </p>
          ) : (
            reviewedWords.map((item, idx) => (
              <div
                key={item.word.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 rounded-lg bg-surface border border-surface-border text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-text-primary text-sm">
                      {item.word.french}
                    </span>
                    <Badge variant="yellow" size="sm">
                      Boîte {item.word.box}/5
                    </Badge>
                    {item.word.status === 'struggling' && (
                      <Badge variant="danger" size="sm">
                        En difficulté
                      </Badge>
                    )}
                  </div>
                  <div className="text-text-secondary text-xs mt-0.5">
                    {item.word.english} {item.word.exampleSentence && `• "${item.word.exampleSentence}"`}
                  </div>
                </div>

                {/* 1-tap outcome selector (PRD 3.4) */}
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  {(['got_it', 'shaky', 'missed'] as VocabOutcome[]).map((outcome) => {
                    const isSelected = item.outcome === outcome;
                    const labels = { got_it: 'Acquis (+1)', shaky: 'Hésitant (=)', missed: 'Oublié (B1)' };
                    return (
                      <button
                        key={outcome}
                        type="button"
                        onClick={() => {
                          const updated = [...reviewedWords];
                          updated[idx].outcome = outcome;
                          setReviewedWords(updated);
                        }}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors border ${
                          isSelected
                            ? outcome === 'got_it'
                              ? 'bg-emerald-500/25 border-emerald-500 text-emerald-400 font-bold'
                              : outcome === 'shaky'
                              ? 'bg-amber-500/25 border-amber-500 text-amber-300 font-bold'
                              : 'bg-danger/25 border-danger text-danger font-bold'
                            : 'bg-card border-card-border text-text-muted hover:text-text-primary'
                        }`}
                      >
                        {labels[outcome]}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Lesson Blocks List (PRD Section 3.4) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
            <BookOpen size={18} className="text-accent" />
            Blocs Pédagogiques ({blocks.length})
          </h3>
          <Button variant="secondary" size="sm" onClick={handleAddBlock} icon={<Plus size={14} />}>
            Ajouter un bloc
          </Button>
        </div>

        <div className="space-y-3">
          {blocks.map((block, idx) => (
            <Card key={block.id} padding="md" className="space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <span className="text-xs font-mono font-bold text-accent bg-accent/15 px-2 py-0.5 rounded border border-accent/30">
                    #{idx + 1}
                  </span>
                  <input
                    type="text"
                    value={block.title}
                    onChange={(e) => handleUpdateBlock(idx, 'title', e.target.value)}
                    className="font-bold text-sm text-text-primary bg-transparent border-b border-transparent hover:border-surface-border focus:border-accent focus:outline-none flex-1 py-0.5"
                  />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1.5 bg-surface px-2.5 py-1 rounded-lg border border-surface-border text-xs">
                    <Clock size={13} className="text-text-muted" />
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={block.minutes}
                      onChange={(e) => handleUpdateBlock(idx, 'minutes', parseInt(e.target.value, 10) || 0)}
                      className="w-12 bg-transparent text-right font-mono font-bold text-text-primary focus:outline-none"
                    />
                    <span className="text-text-muted">min</span>
                  </div>

                  <button
                    onClick={() => handleMoveBlock(idx, 'up')}
                    disabled={idx === 0}
                    className="p-1.5 rounded text-text-muted hover:text-text-primary disabled:opacity-30"
                    title="Monter"
                  >
                    <MoveUp size={15} />
                  </button>
                  <button
                    onClick={() => handleMoveBlock(idx, 'down')}
                    disabled={idx === blocks.length - 1}
                    className="p-1.5 rounded text-text-muted hover:text-text-primary disabled:opacity-30"
                    title="Descendre"
                  >
                    <MoveDown size={15} />
                  </button>
                  <button
                    onClick={() => handleRemoveBlock(idx)}
                    className="p-1.5 rounded text-text-muted hover:text-danger"
                    title="Supprimer le bloc"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              <textarea
                rows={3}
                value={block.content}
                onChange={(e) => handleUpdateBlock(idx, 'content', e.target.value)}
                placeholder="Consignes pédagogiques, questions de relance, points grammaticaux ou dialogues..."
                className="w-full bg-surface border border-surface-border rounded-lg p-3 text-xs text-text-primary focus:outline-none focus:border-accent resize-y leading-relaxed"
              />
            </Card>
          ))}
        </div>
      </div>

      {/* Homework Section (PRD Section 3.4) */}
      <Card padding="md">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">
            Devoirs pour la séance suivante
          </h4>
          <div className="flex items-center gap-1.5 text-xs">
            {(['not_assigned', 'drafted', 'sent'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setHomeworkStatus(st)}
                className={`px-2 py-0.5 rounded text-[11px] capitalize border ${
                  homeworkStatus === st
                    ? 'bg-accent/20 border-accent text-accent font-bold'
                    : 'bg-surface border-surface-border text-text-muted'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <textarea
          rows={2}
          value={homeworkText}
          onChange={(e) => setHomeworkText(e.target.value)}
          placeholder="Ex: Écrire 5 phrases au subjonctif présent sur ses projets de vacances..."
          className="w-full bg-surface border border-surface-border rounded-lg p-2.5 text-xs text-text-primary focus:outline-none focus:border-accent resize-none"
        />
      </Card>

      {/* Smart Paste Lesson Modal */}
      <Modal
        isOpen={isLessonPasteOpen}
        onClose={() => setIsLessonPasteOpen(false)}
        title="Coller un plan généré en externe"
        subtitle="Découpage automatique en blocs pédagogiques selon les titres et sous-parties"
        maxWidth="2xl"
      >
        <div className="space-y-4">
          <p className="text-xs text-text-secondary leading-relaxed">
            Collez ici le texte complet généré par votre IA externe (ChatGPT, Claude, etc.). L'application découpe le texte aux titres et adapte les durées automatiquement.
          </p>

          <textarea
            rows={10}
            value={pastedLessonText}
            onChange={(e) => setPastedLessonText(e.target.value)}
            placeholder="Ex :&#10;1. Échauffement (5 min) : Poser des questions...&#10;2. Vocabulaire (10 min) : Travailler sur...&#10;3. Lecture (12 min) : Lire le texte..."
            className="w-full bg-background border border-card-border rounded-xl p-3 text-xs text-text-primary font-mono focus:outline-none focus:border-accent"
          />

          <div className="flex justify-end gap-3 pt-2 border-t border-card-border">
            <Button variant="ghost" onClick={() => setIsLessonPasteOpen(false)}>
              Annuler
            </Button>
            <Button variant="primary" onClick={handleSplitPastedLesson}>
              Découper et insérer les blocs
            </Button>
          </div>
        </div>
      </Modal>

      {/* Smart Paste Vocabulary Modal */}
      <Modal
        isOpen={isVocabPasteOpen}
        onClose={() => setIsVocabPasteOpen(false)}
        title="Importer une liste de vocabulaire"
        subtitle="Format attendu : un mot par ligne, 'mot - traduction - exemple'"
      >
        <div className="space-y-4">
          <textarea
            rows={7}
            value={pastedVocabText}
            onChange={(e) => setPastedVocabText(e.target.value)}
            placeholder="Ex :&#10;Le dépaysement - Disorientation / feeling out of place - Ce voyage lui a offert un vrai dépaysement.&#10;Incontournable - Must-see / essential - Ce musée est un arrêt incontournable."
            className="w-full bg-background border border-card-border rounded-xl p-3 text-xs text-text-primary font-mono focus:outline-none focus:border-accent"
          />

          <div className="flex justify-end gap-3 pt-2 border-t border-card-border">
            <Button variant="ghost" onClick={() => setIsVocabPasteOpen(false)}>
              Annuler
            </Button>
            <Button variant="primary" onClick={handleParsePastedVocab}>
              Ajouter à la boîte 1 de l'élève
            </Button>
          </div>
        </div>
      </Modal>

      {/* Completion Confirmation Modal */}
      <Modal
        isOpen={isCompletionModalOpen}
        onClose={() => setIsCompletionModalOpen(false)}
        title="Validation de la séance enseignée"
        subtitle="Création d’un instantané immuable pour vos bilans et l’historique"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-surface border border-surface-border text-xs space-y-1.5">
            <div>
              Élève : <strong className="text-text-primary">{student?.name}</strong> ({student?.cefrLevel})
            </div>
            <div>
              Durée réelle : <strong className="text-text-primary">{classLength} minutes</strong>
            </div>
            <div>
              Montant enregistré : <strong className="text-accent">{settings?.currencySymbol || '€'}{student?.ratePerClass || (classLength === 25 ? 22 : 40)}</strong>
            </div>
            <div>
              Mots révisés : <strong className="text-text-primary">{reviewedWords.length} mots</strong> (boîtes Leitner mises à jour)
            </div>
          </div>

          <p className="text-xs text-text-muted leading-relaxed">
            Une fois validée, cette séance devient un instantané immuable. Les rapports mensuels et trimestriels s'appuient sur cet enregistrement exact.
          </p>

          <div className="flex justify-end gap-3 pt-2 border-t border-card-border">
            <Button variant="ghost" onClick={() => setIsCompletionModalOpen(false)}>
              Annuler
            </Button>
            <Button variant="primary" onClick={handleCompleteLesson}>
              Confirmer et Clôturer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

