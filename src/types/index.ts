export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface CEFRHistoryEntry {
  level: CEFRLevel;
  date: string;
  notes?: string;
}

export interface Student {
  id: string; // UUID
  name: string;
  cefrLevel: CEFRLevel;
  cefrHistory: CEFRHistoryEntry[];
  timezone: string; // IANA timezone, e.g. "America/New_York", "Europe/Paris"
  goals: string;
  defaultLength: 25 | 50; // minutes
  communicationLanguage: 'fr' | 'en' | 'es' | 'other';
  ratePerClass: number; // private, never in reports
  privateNotes: string; // private, never in reports
  shareableNotes: string; // shareable, included in student/parent reports
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  revision: number;
  deleted: boolean;
  editingDevice: string;
}

export type TrialStatus = 'planned' | 'held' | 'followed_up' | 'converted' | 'lost';

export interface Trial {
  id: string; // UUID
  name: string;
  statedLevel: string;
  goals: string;
  motivations: string;
  priorExposure: string;
  timezone: string;
  targetLength: 25 | 50;
  status: TrialStatus;
  trialDate: string;
  postClassNotes: string;
  followUpTemplateId?: string;
  convertedStudentId?: string;
  rate: number;
  createdAt: string;
  updatedAt: string;
  revision: number;
  deleted: boolean;
  editingDevice: string;
}

export type BlockType = 'warmup' | 'vocabulary' | 'reading' | 'grammar' | 'speaking' | 'review' | 'custom';

export interface LessonBlock {
  id: string;
  type: BlockType;
  title: string;
  minutes: number;
  content: string;
}

export type LessonStatus = 'draft' | 'ready' | 'completed' | 'cancelled' | 'no_show';

export interface LessonHomework {
  text: string;
  status: 'not_assigned' | 'drafted' | 'sent';
  sentAt?: string;
}

export interface Lesson {
  id: string; // UUID
  studentId: string;
  title: string;
  classLength: number; // 25, 50, or custom
  scheduledAt: string; // ISO UTC string
  status: LessonStatus;
  blocks: LessonBlock[];
  homework: LessonHomework;
  vocabularyIds: string[]; // Targeted words
  earnedAmount?: number;
  actualMinutes?: number;
  snapshotId?: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  deleted: boolean;
  editingDevice: string;
}

export type LeitnerBox = 1 | 2 | 3 | 4 | 5;
export type VocabRetentionState = 'introduced' | 'reviewed' | 'mastered' | 'struggling';
export type VocabOutcome = 'got_it' | 'shaky' | 'missed';

export interface VocabularyItem {
  id: string; // UUID
  studentId: string;
  french: string;
  english: string;
  exampleSentence: string;
  box: LeitnerBox;
  status: VocabRetentionState;
  consecutiveMisses: number;
  introducedAt: string;
  lastReviewedAt?: string;
  nextReviewDate: string; // YYYY-MM-DD
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
  revision: number;
  deleted: boolean;
  editingDevice: string;
}

export interface ReviewedVocabSnapshot {
  wordId: string;
  french: string;
  english: string;
  outcome: VocabOutcome;
  previousBox: LeitnerBox;
  newBox: LeitnerBox;
}

export interface LessonSnapshot {
  id: string; // UUID
  lessonId: string;
  studentId: string;
  studentName: string;
  cefrLevel: CEFRLevel;
  completedAt: string; // ISO
  actualMinutes: number;
  earnedAmount: number;
  blocks: LessonBlock[];
  vocabularyReviewed: ReviewedVocabSnapshot[];
  homeworkText: string;
  homeworkSent: boolean;
  topicsCovered: string[];
  grammarCovered: string[];
  tutorNotes?: string;
  createdAt: string;
  revision: number;
  editingDevice: string;
}

export interface Booking {
  id: string; // UUID
  studentId?: string;
  trialId?: string;
  title: string;
  startUtc: string; // ISO UTC
  endUtc: string;   // ISO UTC
  durationMinutes: number;
  source: 'manual' | 'calendar';
  calendarUid?: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
  notes?: string;
  lessonId?: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  deleted: boolean;
  editingDevice: string;
}

export interface Exercise {
  id: string; // UUID
  title: string;
  level: CEFRLevel;
  topic: string;
  category: 'grammar' | 'reading' | 'vocabulary' | 'speaking' | 'warmup';
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  revision: number;
  deleted: boolean;
  editingDevice: string;
}

export type TemplateCategory =
  | 'trial_followup'
  | 'booking_confirmation'
  | 'cancellation_noshow'
  | 'homework_reminder'
  | 'lesson_recap'
  | 'renewal_package'
  | 'monthly_report_cover';

export interface MessageTemplate {
  id: string; // UUID
  title: string;
  category: TemplateCategory;
  language: 'fr' | 'en';
  body: string;
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
  revision: number;
  deleted: boolean;
  editingDevice: string;
}

export interface TutorSettings {
  id: 'current';
  tutorName: string;
  tutorTimezone: string;
  weekStartsOn: 0 | 1; // 0 = Sunday, 1 = Monday
  currency: string;
  currencySymbol: string;
  paperSize: 'a4' | 'letter';
  branding: {
    logoUrl?: string;
    accentColor: string; // #FACC15
    tagline: string;
  };
  defaultRates: {
    standard25: number;
    standard50: number;
    trial25: number;
    trial50: number;
  };
  starterBlockMinutes: {
    m25: { warmup: number; vocabulary: number; reading: number; speaking: number; review: number };
    m50: { warmup: number; vocabulary: number; reading: number; grammar: number; speaking: number; review: number };
  };
  googleDriveConnected: boolean;
  googleDriveUserEmail?: string;
  googleClientId?: string;
  lastSyncedAt?: string;
  deviceId: string;
  screenLockEnabled?: boolean;
  screenLockPin?: string;
}

export interface RecordConflict {
  entityType: MutationRecord['entityType'];
  entityId: string;
  localRecord: any;
  remoteRecord: any;
  differingFields: string[];
}

export interface MutationRecord {
  id: string;
  entityType:
    | 'students'
    | 'trials'
    | 'lessons'
    | 'lessonSnapshots'
    | 'vocabulary'
    | 'bookings'
    | 'exercises'
    | 'templates'
    | 'settings';
  entityId: string;
  action: 'create' | 'update' | 'delete';
  basedOnRevision: number;
  newRevision: number;
  payload: any;
  timestamp: string;
  synced: boolean;
}

