import Dexie, { Table } from 'dexie';
import {
  Student,
  Trial,
  Lesson,
  LessonSnapshot,
  VocabularyItem,
  Booking,
  Exercise,
  MessageTemplate,
  TutorSettings,
  MutationRecord,
} from '../types';

export class ProfPlanDatabase extends Dexie {
  students!: Table<Student, string>;
  trials!: Table<Trial, string>;
  lessons!: Table<Lesson, string>;
  lessonSnapshots!: Table<LessonSnapshot, string>;
  vocabulary!: Table<VocabularyItem, string>;
  bookings!: Table<Booking, string>;
  exercises!: Table<Exercise, string>;
  templates!: Table<MessageTemplate, string>;
  settings!: Table<TutorSettings, string>;
  mutations!: Table<MutationRecord, string>;

  constructor() {
    super('ProfPlanAI_DB');

    this.version(1).stores({
      students: 'id, name, cefrLevel, timezone, isArchived, deleted, revision, updatedAt',
      trials: 'id, name, status, trialDate, deleted, revision, updatedAt',
      lessons: 'id, studentId, scheduledAt, status, deleted, revision, updatedAt',
      lessonSnapshots: 'id, lessonId, studentId, completedAt, revision',
      vocabulary: 'id, studentId, box, status, nextReviewDate, deleted, revision, updatedAt',
      bookings: 'id, studentId, trialId, startUtc, status, deleted, revision, updatedAt',
      exercises: 'id, level, category, topic, deleted, revision',
      templates: 'id, category, language, deleted, revision',
      settings: 'id',
      mutations: 'id, entityType, timestamp, synced',
    });
  }
}

export const db = new ProfPlanDatabase();

// Device ID generator / retriever for local-first synchronization
export function getOrCreateDeviceId(): string {
  let deviceId = localStorage.getItem('profplan_device_id');
  if (!deviceId) {
    deviceId = 'dev_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    localStorage.setItem('profplan_device_id', deviceId);
  }
  return deviceId;
}

// Request persistent storage so browser does not evict local records
export async function requestPersistentStorage(): Promise<boolean> {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persist();
    return isPersisted;
  }
  return false;
}

// Record a mutation for offline sync queue
export async function queueMutation(
  entityType: MutationRecord['entityType'],
  entityId: string,
  action: MutationRecord['action'],
  basedOnRevision: number,
  newRevision: number,
  payload: any
): Promise<void> {
  const mutation: MutationRecord = {
    id: 'mut_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    entityType,
    entityId,
    action,
    basedOnRevision,
    newRevision,
    payload,
    timestamp: new Date().toISOString(),
    synced: false,
  };
  await db.mutations.add(mutation);
}

// Seed starter data if database is brand new
export async function initializeDatabaseSeed(): Promise<void> {
  const settingsCount = await db.settings.count();
  if (settingsCount > 0) {
    return; // Already initialized
  }

  const deviceId = getOrCreateDeviceId();
  const now = new Date();
  const nowIso = now.toISOString();

  // 1. Initial Tutor Settings
  const defaultSettings: TutorSettings = {
    id: 'current',
    tutorName: 'Prof. Alexandre',
    tutorTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris',
    weekStartsOn: 1, // Monday
    currency: 'EUR',
    currencySymbol: '€',
    paperSize: 'a4',
    branding: {
      accentColor: '#FACC15', // Pure Yellow
      tagline: 'Cours de Français Personnalisés & Préparation Examens',
    },
    defaultRates: {
      standard25: 22,
      standard50: 40,
      trial25: 15,
      trial50: 25,
    },
    starterBlockMinutes: {
      m25: { warmup: 3, vocabulary: 5, reading: 7, speaking: 5, review: 5 },
      m50: { warmup: 5, vocabulary: 10, reading: 12, grammar: 10, speaking: 8, review: 5 },
    },
    googleDriveConnected: false,
    deviceId,
  };
  await db.settings.put(defaultSettings);

  // 2. Starter Message Templates
  const defaultTemplates: MessageTemplate[] = [
    {
      id: 'tpl_trial_followup_fr',
      title: 'Suivi de cours d’essai (Chaleureux)',
      category: 'trial_followup',
      language: 'fr',
      body: "Bonjour {student_name} ! Merci beaucoup pour ce premier cours d’essai. J'ai beaucoup apprécié notre échange. Vos objectifs en français sont très clairs et nous allons faire de grands progrès ensemble. N'hésitez pas à réserver vos prochains créneaux sur Preply pour garder ce bon rythme !",
      isBuiltIn: true,
      createdAt: nowIso,
      updatedAt: nowIso,
      revision: 1,
      deleted: false,
      editingDevice: deviceId,
    },
    {
      id: 'tpl_trial_followup_en',
      title: 'Trial Lesson Follow-up (Encouraging)',
      category: 'trial_followup',
      language: 'en',
      body: "Hi {student_name}! Thank you so much for today's trial lesson. It was a pleasure meeting you. You have a great foundation, and we will make fast progress toward your fluency goals. Feel free to book your regular weekly slots on Preply whenever you're ready!",
      isBuiltIn: true,
      createdAt: nowIso,
      updatedAt: nowIso,
      revision: 1,
      deleted: false,
      editingDevice: deviceId,
    },
    {
      id: 'tpl_hw_reminder_fr',
      title: 'Rappel devoirs avant cours',
      category: 'homework_reminder',
      language: 'fr',
      body: "Bonjour {student_name}, petit rappel amical pour vos devoirs avant notre prochain cours ({next_class_local_time}) : {homework}. Prenez votre temps, nous ferons le point ensemble !",
      isBuiltIn: true,
      createdAt: nowIso,
      updatedAt: nowIso,
      revision: 1,
      deleted: false,
      editingDevice: deviceId,
    },
    {
      id: 'tpl_hw_reminder_en',
      title: 'Friendly Homework Reminder',
      category: 'homework_reminder',
      language: 'en',
      body: "Hi {student_name}, just a friendly reminder regarding your homework before our class at {next_class_local_time}: {homework}. See you soon!",
      isBuiltIn: true,
      createdAt: nowIso,
      updatedAt: nowIso,
      revision: 1,
      deleted: false,
      editingDevice: deviceId,
    },
    {
      id: 'tpl_booking_confirm_fr',
      title: 'Confirmation de réservation',
      category: 'booking_confirmation',
      language: 'fr',
      body: "Bonjour {student_name}, votre prochain cours de français est confirmé pour {next_class_local_time} (heure locale pour vous). J'ai hâte de continuer notre travail sur {last_topic} !",
      isBuiltIn: true,
      createdAt: nowIso,
      updatedAt: nowIso,
      revision: 1,
      deleted: false,
      editingDevice: deviceId,
    },
    {
      id: 'tpl_lesson_recap_fr',
      title: 'Bilan de cours & Vocabulaire',
      category: 'lesson_recap',
      language: 'fr',
      body: "Bravo {student_name} pour la séance d'aujourd'hui ! Nous avons bien avancé sur {last_topic}. N'oubliez pas de réviser les nouveaux mots vus aujourd'hui. Vos devoirs : {homework}. À la semaine prochaine !",
      isBuiltIn: true,
      createdAt: nowIso,
      updatedAt: nowIso,
      revision: 1,
      deleted: false,
      editingDevice: deviceId,
    },
    {
      id: 'tpl_renewal_fr',
      title: 'Renouvellement de forfait d’heures',
      category: 'renewal_package',
      language: 'fr',
      body: "Bonjour {student_name}, nous arrivons à la fin de votre forfait d'heures sur Preply. Vos progrès sont remarquables ! Pour maintenir notre créneau hebdomadaire sans interruption, pensez à recharger votre abonnement ou votre forfait. Merci et à très vite !",
      isBuiltIn: true,
      createdAt: nowIso,
      updatedAt: nowIso,
      revision: 1,
      deleted: false,
      editingDevice: deviceId,
    },
  ];
  await db.templates.bulkPut(defaultTemplates);

  // 3. Starter Students
  const student1Id = 'stu_sophie_b1';
  const student2Id = 'stu_james_a2';

  const starterStudents: Student[] = [
    {
      id: student1Id,
      name: 'Sophie Martin',
      cefrLevel: 'B1',
      cefrHistory: [
        { level: 'A2', date: '2026-06-10', notes: 'Initial assessment on Preply' },
        { level: 'B1', date: '2026-09-01', notes: 'Passed B1 milestone in conversational fluency' },
      ],
      timezone: 'America/New_York',
      goals: 'DELF B1 preparation, professional interviews with French clients, and spontaneous conversation.',
      defaultLength: 50,
      communicationLanguage: 'fr',
      ratePerClass: 40,
      privateNotes: 'Needs gentle correction on subjunctive triggers; tends to translate directly from English idioms.',
      shareableNotes: 'Excellent progress on past tenses and vocabulary retention. Active participation.',
      isArchived: false,
      createdAt: '2026-06-10T10:00:00Z',
      updatedAt: nowIso,
      revision: 1,
      deleted: false,
      editingDevice: deviceId,
    },
    {
      id: student2Id,
      name: 'James Reynolds',
      cefrLevel: 'A2',
      cefrHistory: [
        { level: 'A1', date: '2026-07-15', notes: 'Complete beginner with basic greetings' },
        { level: 'A2', date: '2026-10-01', notes: 'Mastered present tense & everyday questions' },
      ],
      timezone: 'Europe/London',
      goals: 'Relocating to Lyon in 6 months. Focus on everyday life (housing, bakery, doctor, train travel).',
      defaultLength: 25,
      communicationLanguage: 'en',
      ratePerClass: 22,
      privateNotes: 'Visual learner. Loves flashcards and audio repetitions.',
      shareableNotes: 'Solid command of numbers, directions, and routine questions.',
      isArchived: false,
      createdAt: '2026-07-15T14:30:00Z',
      updatedAt: nowIso,
      revision: 1,
      deleted: false,
      editingDevice: deviceId,
    },
  ];
  await db.students.bulkPut(starterStudents);

  // 4. Starter Trial Student
  const starterTrial: Trial = {
    id: 'trial_lucas_williams',
    name: 'Lucas Williams',
    statedLevel: 'A1 - False beginner',
    goals: 'Holiday in Nice next summer, order wine and food effortlessly, chat with locals.',
    motivations: 'Wife is French, wants to connect with in-laws at dinner gatherings.',
    priorExposure: 'High school French 8 years ago + Duolingo streak for 3 months.',
    timezone: 'America/Chicago',
    targetLength: 25,
    status: 'held', // Trial was held, needs follow-up message!
    trialDate: new Date(Date.now() - 3600 * 1000 * 6).toISOString(), // 6 hours ago
    postClassNotes: 'Very motivated, good pronunciation. Great fit for regular 25-minute twice-weekly lessons.',
    rate: 15,
    createdAt: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
    updatedAt: nowIso,
    revision: 1,
    deleted: false,
    editingDevice: deviceId,
  };
  await db.trials.put(starterTrial);

  // 5. Starter Vocabulary (Leitner 5-box system)
  const starterVocab: VocabularyItem[] = [
    {
      id: 'voc_1',
      studentId: student1Id,
      french: 'Le dépaysement',
      english: 'Disorientation / feeling out of place in a pleasant way',
      exampleSentence: 'Ce voyage dans le sud de la France lui a offert un vrai dépaysement.',
      box: 2,
      status: 'introduced',
      consecutiveMisses: 0,
      introducedAt: '2026-10-01',
      lastReviewedAt: '2026-10-08',
      nextReviewDate: new Date(Date.now() - 86400000).toISOString().split('T')[0], // Due for review!
      reviewCount: 2,
      createdAt: nowIso,
      updatedAt: nowIso,
      revision: 1,
      deleted: false,
      editingDevice: deviceId,
    },
    {
      id: 'voc_2',
      studentId: student1Id,
      french: 'Bien que (+ subjonctif)',
      english: 'Even though / although',
      exampleSentence: 'Bien qu’il pleuve, nous irons faire une promenade.',
      box: 1,
      status: 'struggling',
      consecutiveMisses: 2,
      introducedAt: '2026-09-20',
      lastReviewedAt: '2026-10-10',
      nextReviewDate: new Date().toISOString().split('T')[0], // Due today!
      reviewCount: 3,
      createdAt: nowIso,
      updatedAt: nowIso,
      revision: 1,
      deleted: false,
      editingDevice: deviceId,
    },
    {
      id: 'voc_3',
      studentId: student1Id,
      french: 'Faire d’une pierre deux coups',
      english: 'To kill two birds with one stone',
      exampleSentence: 'En achetant le pain en rentrant du travail, je fais d’une pierre deux coups.',
      box: 4,
      status: 'reviewed',
      consecutiveMisses: 0,
      introducedAt: '2026-08-15',
      lastReviewedAt: '2026-10-01',
      nextReviewDate: '2026-10-25',
      reviewCount: 5,
      createdAt: nowIso,
      updatedAt: nowIso,
      revision: 1,
      deleted: false,
      editingDevice: deviceId,
    },
    {
      id: 'voc_4',
      studentId: student2Id,
      french: 'L’addition, s’il vous plaît',
      english: 'The bill, please',
      exampleSentence: 'Garçon, nous avons terminé. L’addition, s’il vous plaît !',
      box: 3,
      status: 'reviewed',
      consecutiveMisses: 0,
      introducedAt: '2026-09-12',
      lastReviewedAt: '2026-10-05',
      nextReviewDate: new Date().toISOString().split('T')[0], // Due today!
      reviewCount: 3,
      createdAt: nowIso,
      updatedAt: nowIso,
      revision: 1,
      deleted: false,
      editingDevice: deviceId,
    },
  ];
  await db.vocabulary.bulkPut(starterVocab);

  // 6. Starter Exercises for the Library
  const starterExercises: Exercise[] = [
    {
      id: 'ex_passe_compose_imparfait',
      title: 'Passé Composé vs Imparfait : Raconter une anecdote',
      level: 'B1',
      category: 'grammar',
      topic: 'Temps du passé',
      content:
        "Règles clés :\n- Imparfait : description du décor, habitudes, météo, sentiments continus.\n- Passé Composé : action ponctuelle, déclencheur, suite d'actions précises.\n\nExercice à trous :\n1. Pendant que je (dormir) _______, le téléphone (sonner) _______ soudainement.\n2. Hier, il (faire) _______ beau, alors nous (décider) _______ d'aller au parc.",
      tags: ['passé composé', 'imparfait', 'grammaire', 'B1'],
      createdAt: nowIso,
      updatedAt: nowIso,
      revision: 1,
      deleted: false,
      editingDevice: deviceId,
    },
    {
      id: 'ex_commande_boulangerie',
      title: 'Commander à la boulangerie française',
      level: 'A1',
      category: 'speaking',
      topic: 'Vie quotidienne',
      content:
        "Jeu de rôle :\nLe tuteur joue le boulanger, l'élève joue le client.\n\nPhrases cibles :\n- 'Bonjour madame/monsieur !'\n- 'Je voudrais une baguette tradition bien cuite, s'il vous plaît.'\n- 'Est-ce que vous avez des croissants aux amandes ?'\n- 'Ce sera tout, merci. Combien je vous dois ?'",
      tags: ['boulangerie', 'nourriture', 'A1', 'jeu de rôle'],
      createdAt: nowIso,
      updatedAt: nowIso,
      revision: 1,
      deleted: false,
      editingDevice: deviceId,
    },
  ];
  await db.exercises.bulkPut(starterExercises);

  // 7. Starter Bookings (This week's schedule!)
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86400000);
  const dayAfter = new Date(today.getTime() + 86400000 * 2);

  const starterBookings: Booking[] = [
    {
      id: 'book_1',
      studentId: student1Id,
      title: 'Sophie Martin - Cours de perfectionnement',
      startUtc: new Date(Date.UTC(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate(), 15, 0, 0)).toISOString(),
      endUtc: new Date(Date.UTC(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate(), 15, 50, 0)).toISOString(),
      durationMinutes: 50,
      source: 'manual',
      status: 'scheduled',
      notes: 'Prepare DELF debate speaking block & check subjunctive exercises.',
      createdAt: nowIso,
      updatedAt: nowIso,
      revision: 1,
      deleted: false,
      editingDevice: deviceId,
    },
    {
      id: 'book_2',
      studentId: student2Id,
      title: 'James Reynolds - Pratique orale quotidienne',
      startUtc: new Date(Date.UTC(dayAfter.getUTCFullYear(), dayAfter.getUTCMonth(), dayAfter.getUTCDate(), 17, 30, 0)).toISOString(),
      endUtc: new Date(Date.UTC(dayAfter.getUTCFullYear(), dayAfter.getUTCMonth(), dayAfter.getUTCDate(), 17, 55, 0)).toISOString(),
      durationMinutes: 25,
      source: 'manual',
      status: 'scheduled',
      notes: 'Roleplay: ordering food and buying train tickets.',
      createdAt: nowIso,
      updatedAt: nowIso,
      revision: 1,
      deleted: false,
      editingDevice: deviceId,
    },
  ];
  await db.bookings.bulkPut(starterBookings);
}

