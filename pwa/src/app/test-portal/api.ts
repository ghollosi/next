// Test Portal API client
// All data is stored in PostgreSQL via NestJS API

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.vemiax.com';

// Types
export interface Tester {
  id: string;
  email: string;
  name: string;
  language: 'HU' | 'EN';
  status: 'INVITED' | 'ACTIVE' | 'COMPLETED' | 'EXPIRED';
  currentPhase: number;
  totalPhases: number;
  lastLoginAt?: string;
  completedAt?: string;
  createdAt: string;
  password?: string; // Only returned on create
}

export interface TesterSession {
  id: string;
  email: string;
  name: string;
  language: 'HU' | 'EN';
  status: string;
  currentPhase: number;
  totalPhases: number;
}

export interface TestFeedback {
  id: string;
  testerId: string;
  phaseId: number;
  questionId: string;
  value: string;
  screenshotUrl?: string;
  createdAt: string;
}

export interface TestBugReport {
  id: string;
  testerId: string;
  phaseId: number;
  title: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'NEW' | 'IN_PROGRESS' | 'FIXED' | 'WONT_FIX';
  screenshotUrl?: string;
  createdAt: string;
}

export interface TestingStats {
  totalTesters: number;
  activeTesters: number;
  completedTesters: number;
  totalBugs: number;
  averageRating: number;
  completionRate: number;
}

// Session storage keys
const SESSION_KEYS = {
  TESTER_SESSION: 'vsys_test_session',
  ADMIN_SESSION: 'vsys_test_admin',
};

// ============= API CALLS =============

async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}/test-portal${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// ============= ADMIN =============

export async function validateAdminLogin(email: string, password: string): Promise<boolean> {
  try {
    await apiCall<{ success: boolean }>('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    return true;
  } catch {
    return false;
  }
}

export function setAdminSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_KEYS.ADMIN_SESSION, 'true');
}

export function isAdminLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SESSION_KEYS.ADMIN_SESSION) === 'true';
}

export function clearAdminSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_KEYS.ADMIN_SESSION);
}

// ============= TESTERS =============

export async function getTesters(): Promise<Tester[]> {
  return apiCall<Tester[]>('/testers');
}

export async function getTesterById(id: string): Promise<Tester> {
  return apiCall<Tester>(`/testers/${id}`);
}

export async function createTester(name: string, email: string, language: 'HU' | 'EN'): Promise<Tester> {
  return apiCall<Tester>('/testers', {
    method: 'POST',
    body: JSON.stringify({ name, email, language }),
  });
}

export async function updateTester(id: string, data: Partial<Tester>): Promise<Tester> {
  return apiCall<Tester>(`/testers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteTester(id: string): Promise<void> {
  await apiCall(`/testers/${id}`, { method: 'DELETE' });
}

export async function regenerateTesterPassword(id: string): Promise<string> {
  const result = await apiCall<{ password: string }>(`/testers/${id}/regenerate-password`, {
    method: 'POST',
  });
  return result.password;
}

export async function sendTesterInvite(id: string): Promise<void> {
  await apiCall(`/testers/${id}/send-invite`, { method: 'POST' });
}

export async function markTesterCompleted(testerId: string): Promise<void> {
  await apiCall(`/testers/${testerId}/complete`, { method: 'POST' });
}

// ============= TESTER LOGIN =============

export async function validateTesterLogin(email: string, password: string): Promise<TesterSession | null> {
  try {
    const tester = await apiCall<TesterSession>('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    return tester;
  } catch {
    return null;
  }
}

export function setTesterSession(tester: TesterSession): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_KEYS.TESTER_SESSION, JSON.stringify(tester));
}

export function getTesterSession(): TesterSession | null {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem(SESSION_KEYS.TESTER_SESSION);
  return data ? JSON.parse(data) : null;
}

export function updateTesterSession(updates: Partial<TesterSession>): void {
  const session = getTesterSession();
  if (!session) return;
  const updated = { ...session, ...updates };
  localStorage.setItem(SESSION_KEYS.TESTER_SESSION, JSON.stringify(updated));
}

export function clearTesterSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_KEYS.TESTER_SESSION);
}

// ============= FEEDBACK =============

export async function getFeedback(): Promise<TestFeedback[]> {
  return apiCall<TestFeedback[]>('/feedback');
}

export async function getFeedbackByTester(testerId: string): Promise<TestFeedback[]> {
  return apiCall<TestFeedback[]>(`/feedback/tester/${testerId}`);
}

export async function saveFeedback(
  testerId: string,
  phaseId: number,
  questionId: string,
  value: string | number | boolean,
  screenshotUrl?: string
): Promise<TestFeedback> {
  return apiCall<TestFeedback>('/feedback', {
    method: 'POST',
    body: JSON.stringify({ testerId, phaseId, questionId, value, screenshotUrl }),
  });
}

export async function saveBatchFeedback(
  testerId: string,
  phaseId: number,
  answers: { questionId: string; value: string | number | boolean }[]
): Promise<void> {
  await apiCall('/feedback/batch', {
    method: 'POST',
    body: JSON.stringify({ testerId, phaseId, answers }),
  });
}

// ============= BUG REPORTS =============

export async function getBugReports(): Promise<TestBugReport[]> {
  return apiCall<TestBugReport[]>('/bugs');
}

export async function getBugReportsByTester(testerId: string): Promise<TestBugReport[]> {
  return apiCall<TestBugReport[]>(`/bugs/tester/${testerId}`);
}

export async function createBugReport(
  testerId: string,
  phaseId: number,
  title: string,
  description: string,
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
  screenshotUrl?: string
): Promise<TestBugReport> {
  return apiCall<TestBugReport>('/bugs', {
    method: 'POST',
    body: JSON.stringify({ testerId, phaseId, title, description, severity, screenshotUrl }),
  });
}

export async function updateBugStatus(bugId: string, status: TestBugReport['status']): Promise<TestBugReport> {
  return apiCall<TestBugReport>(`/bugs/${bugId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

// ============= STATISTICS =============

export async function getTestingStats(): Promise<TestingStats> {
  return apiCall<TestingStats>('/stats');
}
