// Local Storage based data management for Test Portal
// For a small-scale testing portal (max 5 testers), localStorage is sufficient

import {
  Tester,
  TesterSession,
  TestFeedback,
  BugReport,
  TestingStats,
  Language,
  TesterStatus
} from './types';

const STORAGE_KEYS = {
  TESTERS: 'vsys_test_testers',
  FEEDBACK: 'vsys_test_feedback',
  BUGS: 'vsys_test_bugs',
  CURRENT_SESSION: 'vsys_test_session',
  ADMIN_SESSION: 'vsys_test_admin',
};

// Generate simple ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Generate random password
function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// ============= TESTERS =============

export function getTesters(): Tester[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(STORAGE_KEYS.TESTERS);
  return data ? JSON.parse(data) : [];
}

export function getTesterById(id: string): Tester | null {
  const testers = getTesters();
  return testers.find(t => t.id === id) || null;
}

export function getTesterByEmail(email: string): Tester | null {
  const testers = getTesters();
  return testers.find(t => t.email.toLowerCase() === email.toLowerCase()) || null;
}

export function createTester(name: string, email: string, language: Language): Tester {
  const testers = getTesters();

  // Check max testers (5)
  if (testers.filter(t => t.status !== 'EXPIRED').length >= 5) {
    throw new Error('Maximum number of testers (5) reached');
  }

  // Check if email already exists
  if (testers.find(t => t.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('Email already exists');
  }

  const password = generatePassword();

  const newTester: Tester = {
    id: generateId(),
    email,
    name,
    language,
    status: 'INVITED',
    password,
    createdAt: new Date().toISOString(),
    currentPhase: 1,
    totalPhases: 7,
  };

  testers.push(newTester);
  localStorage.setItem(STORAGE_KEYS.TESTERS, JSON.stringify(testers));

  return newTester;
}

export function updateTester(id: string, updates: Partial<Tester>): Tester | null {
  const testers = getTesters();
  const index = testers.findIndex(t => t.id === id);

  if (index === -1) return null;

  testers[index] = { ...testers[index], ...updates };
  localStorage.setItem(STORAGE_KEYS.TESTERS, JSON.stringify(testers));

  return testers[index];
}

export function deleteTester(id: string): boolean {
  const testers = getTesters();
  const filtered = testers.filter(t => t.id !== id);

  if (filtered.length === testers.length) return false;

  localStorage.setItem(STORAGE_KEYS.TESTERS, JSON.stringify(filtered));
  return true;
}

export function regenerateTesterPassword(id: string): string | null {
  const testers = getTesters();
  const index = testers.findIndex(t => t.id === id);

  if (index === -1) return null;

  const newPassword = generatePassword();
  testers[index].password = newPassword;
  localStorage.setItem(STORAGE_KEYS.TESTERS, JSON.stringify(testers));

  return newPassword;
}

export function getTesterPassword(id: string): string | null {
  const tester = getTesterById(id);
  return tester?.password || null;
}

export function validateTesterLogin(email: string, password: string): Tester | null {
  const tester = getTesterByEmail(email);

  if (!tester || tester.password !== password) {
    return null;
  }

  if (tester.status === 'EXPIRED') {
    return null;
  }

  // Update status to ACTIVE and last login
  updateTester(tester.id, {
    status: tester.status === 'INVITED' ? 'ACTIVE' : tester.status,
    lastLoginAt: new Date().toISOString(),
  });

  return tester;
}

// ============= TESTER SESSION =============

export function setTesterSession(tester: Tester): void {
  if (typeof window === 'undefined') return;

  const session: TesterSession = {
    testerId: tester.id,
    testerName: tester.name,
    email: tester.email,
    language: tester.language,
    currentPhase: tester.currentPhase,
    totalPhases: tester.totalPhases,
    completedPhases: [],
  };

  // Get completed phases from feedback
  const feedback = getFeedbackByTester(tester.id);
  const completedPhases = Array.from(new Set(feedback.map(f => {
    const phaseId = parseInt(f.questionId.split('_')[0].replace('p', ''));
    return phaseId;
  })));

  session.completedPhases = completedPhases;
  session.currentPhase = completedPhases.length > 0 ? Math.max(...completedPhases) + 1 : 1;

  localStorage.setItem(STORAGE_KEYS.CURRENT_SESSION, JSON.stringify(session));
}

export function getTesterSession(): TesterSession | null {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem(STORAGE_KEYS.CURRENT_SESSION);
  return data ? JSON.parse(data) : null;
}

export function updateTesterSession(updates: Partial<TesterSession>): void {
  const session = getTesterSession();
  if (!session) return;

  const updated = { ...session, ...updates };
  localStorage.setItem(STORAGE_KEYS.CURRENT_SESSION, JSON.stringify(updated));

  // Also update the tester record
  updateTester(session.testerId, {
    currentPhase: updated.currentPhase,
  });
}

export function clearTesterSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.CURRENT_SESSION);
}

// ============= ADMIN SESSION =============

// Hardcoded admin credentials for test portal
const ADMIN_EMAIL = 'gabor.hollosi@vedox.hu';
const ADMIN_PASSWORD = 'VsysAdmin2024!';

export function validateAdminLogin(email: string, password: string): boolean {
  return email.toLowerCase() === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD;
}

export function setAdminSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.ADMIN_SESSION, 'true');
}

export function isAdminLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEYS.ADMIN_SESSION) === 'true';
}

export function clearAdminSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.ADMIN_SESSION);
}

// ============= FEEDBACK =============

export function getFeedback(): TestFeedback[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(STORAGE_KEYS.FEEDBACK);
  return data ? JSON.parse(data) : [];
}

export function getFeedbackByTester(testerId: string): TestFeedback[] {
  return getFeedback().filter(f => f.testerId === testerId);
}

export function getFeedbackByPhase(phaseId: number): TestFeedback[] {
  return getFeedback().filter(f => f.phaseId === phaseId);
}

export function saveFeedback(
  testerId: string,
  phaseId: number,
  questionId: string,
  value: string | number | boolean,
  screenshotUrl?: string
): TestFeedback {
  const feedback = getFeedback();

  // Check if feedback already exists for this question
  const existingIndex = feedback.findIndex(
    f => f.testerId === testerId && f.questionId === questionId
  );

  const newFeedback: TestFeedback = {
    testerId,
    phaseId,
    questionId,
    value,
    screenshotUrl,
    createdAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    feedback[existingIndex] = newFeedback;
  } else {
    feedback.push(newFeedback);
  }

  localStorage.setItem(STORAGE_KEYS.FEEDBACK, JSON.stringify(feedback));
  return newFeedback;
}

export function saveBatchFeedback(
  testerId: string,
  phaseId: number,
  answers: { questionId: string; value: string | number | boolean }[]
): void {
  answers.forEach(answer => {
    saveFeedback(testerId, phaseId, answer.questionId, answer.value);
  });
}

// ============= BUG REPORTS =============

export function getBugReports(): BugReport[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(STORAGE_KEYS.BUGS);
  return data ? JSON.parse(data) : [];
}

export function getBugReportsByTester(testerId: string): BugReport[] {
  return getBugReports().filter(b => b.testerId === testerId);
}

export function createBugReport(
  testerId: string,
  phaseId: number,
  title: string,
  description: string,
  severity: BugReport['severity'],
  screenshotUrl?: string
): BugReport {
  const bugs = getBugReports();

  const newBug: BugReport = {
    id: generateId(),
    testerId,
    phaseId,
    title,
    description,
    severity,
    screenshotUrl,
    createdAt: new Date().toISOString(),
    status: 'NEW',
  };

  bugs.push(newBug);
  localStorage.setItem(STORAGE_KEYS.BUGS, JSON.stringify(bugs));

  return newBug;
}

export function updateBugStatus(bugId: string, status: BugReport['status']): BugReport | null {
  const bugs = getBugReports();
  const index = bugs.findIndex(b => b.id === bugId);

  if (index === -1) return null;

  bugs[index].status = status;
  localStorage.setItem(STORAGE_KEYS.BUGS, JSON.stringify(bugs));

  return bugs[index];
}

// ============= STATISTICS =============

export function getTestingStats(): TestingStats {
  const testers = getTesters();
  const feedback = getFeedback();
  const bugs = getBugReports();

  const activeTesters = testers.filter(t => t.status === 'ACTIVE').length;
  const completedTesters = testers.filter(t => t.status === 'COMPLETED').length;

  // Calculate average rating from all rating feedback
  const ratings = feedback.filter(f => typeof f.value === 'number');
  const avgRating = ratings.length > 0
    ? ratings.reduce((sum, f) => sum + (f.value as number), 0) / ratings.length
    : 0;

  // Calculate completion rate
  const totalPhases = testers.length * 7;
  const completedPhases = feedback.length > 0
    ? Array.from(new Set(feedback.map(f => `${f.testerId}-${f.phaseId}`))).length
    : 0;
  const completionRate = totalPhases > 0 ? (completedPhases / totalPhases) * 100 : 0;

  return {
    totalTesters: testers.length,
    activeTesters,
    completedTesters,
    totalBugs: bugs.length,
    averageRating: Math.round(avgRating * 10) / 10,
    completionRate: Math.round(completionRate),
  };
}

// ============= MARK TESTER AS COMPLETED =============

export function markTesterCompleted(testerId: string): void {
  updateTester(testerId, {
    status: 'COMPLETED',
    completedAt: new Date().toISOString(),
  });
}

// ============= EXPORT DATA =============

export function exportAllData(): {
  testers: Tester[];
  feedback: TestFeedback[];
  bugs: BugReport[];
  stats: TestingStats;
} {
  return {
    testers: getTesters().map(t => ({ ...t, password: '***' })), // Hide passwords
    feedback: getFeedback(),
    bugs: getBugReports(),
    stats: getTestingStats(),
  };
}
