// Test Portal Types

export type Language = 'hu' | 'en';

export type TesterStatus = 'INVITED' | 'ACTIVE' | 'COMPLETED' | 'EXPIRED';

export type TestPhaseStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';

export type FeedbackType = 'YES_NO' | 'RATING' | 'TEXT' | 'SCREENSHOT';

export interface Tester {
  id: string;
  email: string;
  name: string;
  language: Language;
  status: TesterStatus;
  password?: string; // Only returned on creation
  createdAt: string;
  lastLoginAt?: string;
  completedAt?: string;
  currentPhase: number;
  totalPhases: number;
}

export interface TestPhase {
  id: number;
  titleHu: string;
  titleEn: string;
  descriptionHu: string;
  descriptionEn: string;
  instructionsHu: string[];
  instructionsEn: string[];
  targetUrl?: string;
  loginInfo?: {
    username?: string;
    password?: string;
    note?: string;
  };
  estimatedMinutes: number;
  feedbackQuestions: FeedbackQuestion[];
}

export interface FeedbackQuestion {
  id: string;
  type: FeedbackType;
  questionHu: string;
  questionEn: string;
  required: boolean;
  options?: { value: number; labelHu: string; labelEn: string }[];
}

export interface TestFeedback {
  testerId: string;
  phaseId: number;
  questionId: string;
  value: string | number | boolean;
  screenshotUrl?: string;
  createdAt: string;
}

export interface BugReport {
  id: string;
  testerId: string;
  phaseId: number;
  title: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  screenshotUrl?: string;
  createdAt: string;
  status: 'NEW' | 'REVIEWED' | 'FIXED' | 'WONT_FIX';
}

export interface TesterSession {
  testerId: string;
  testerName: string;
  email: string;
  language: Language;
  currentPhase: number;
  totalPhases: number;
  completedPhases: number[];
}

// Admin stats
export interface TestingStats {
  totalTesters: number;
  activeTesters: number;
  completedTesters: number;
  totalBugs: number;
  averageRating: number;
  completionRate: number;
}
