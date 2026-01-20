'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TesterSession } from '../types';
import { t, getLocalizedText } from '../i18n';
import {
  getTesterSession,
  clearTesterSession,
  getFeedbackByTester,
  getBugReportsByTester,
} from '../storage';
import { TEST_PHASES, TOTAL_ESTIMATED_MINUTES } from '../test-phases';

export default function TesterDashboard() {
  const router = useRouter();
  const [session, setSession] = useState<TesterSession | null>(null);
  const [completedPhases, setCompletedPhases] = useState<number[]>([]);

  useEffect(() => {
    const s = getTesterSession();
    if (!s) {
      router.replace('/test-portal');
      return;
    }
    setSession(s);

    // Calculate completed phases from feedback
    const feedback = getFeedbackByTester(s.testerId);
    const phases = Array.from(new Set(feedback.map((f) => f.phaseId)));
    setCompletedPhases(phases);
  }, [router]);

  const handleLogout = () => {
    clearTesterSession();
    router.push('/test-portal');
  };

  const handleStartPhase = (phaseId: number) => {
    router.push(`/test-portal/phase/${phaseId}`);
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">{t('common.loading', 'hu')}</div>
      </div>
    );
  }

  const lang = session.language;
  const currentPhaseIndex = completedPhases.length;
  const allCompleted = completedPhases.length >= TEST_PHASES.length;

  // Calculate remaining time
  const remainingMinutes = TEST_PHASES.filter(
    (p) => !completedPhases.includes(p.id)
  ).reduce((sum, p) => sum + p.estimatedMinutes, 0);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">
              {t('dashboard.title', lang)}
            </h1>
            <p className="text-sm text-gray-500">
              {t('dashboard.welcome', lang)}, {session.testerName}!
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            {t('common.logout', lang)}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Progress Card */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            {t('dashboard.progress', lang)}
          </h2>

          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-500"
                  style={{
                    width: `${(completedPhases.length / TEST_PHASES.length) * 100}%`,
                  }}
                />
              </div>
            </div>
            <span className="text-lg font-bold text-primary-600">
              {completedPhases.length}/{TEST_PHASES.length}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="bg-green-50 rounded-xl p-3">
              <p className="text-green-600 font-medium">{t('dashboard.completedPhases', lang)}</p>
              <p className="text-2xl font-bold text-green-700">{completedPhases.length}</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-blue-600 font-medium">{t('dashboard.remainingPhases', lang)}</p>
              <p className="text-2xl font-bold text-blue-700">
                {TEST_PHASES.length - completedPhases.length}
              </p>
            </div>
            <div className="bg-purple-50 rounded-xl p-3">
              <p className="text-purple-600 font-medium">{t('dashboard.estimatedTime', lang)}</p>
              <p className="text-2xl font-bold text-purple-700">
                ~{remainingMinutes} {t('common.minutes', lang)}
              </p>
            </div>
            <div className="bg-orange-50 rounded-xl p-3">
              <p className="text-orange-600 font-medium">
                {lang === 'hu' ? 'Bejelentett hibák' : 'Bugs reported'}
              </p>
              <p className="text-2xl font-bold text-orange-700">
                {getBugReportsByTester(session.testerId).length}
              </p>
            </div>
          </div>
        </div>

        {/* All Completed Message */}
        {allCompleted && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-green-800 mb-2">
              {lang === 'hu' ? 'Minden fázis befejezve!' : 'All phases completed!'}
            </h3>
            <p className="text-green-600 mb-4">
              {lang === 'hu'
                ? 'Köszönjük a munkádat! Kattints az alábbi gombra a befejezéshez.'
                : 'Thank you for your work! Click the button below to finish.'}
            </p>
            <button
              onClick={() => router.push('/test-portal/complete')}
              className="px-6 py-3 bg-green-600 text-white font-semibold rounded-xl
                       hover:bg-green-700 transition-colors"
            >
              {t('common.finish', lang)} →
            </button>
          </div>
        )}

        {/* Phase List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">
            {lang === 'hu' ? 'Tesztelési fázisok' : 'Test phases'}
          </h2>

          {TEST_PHASES.map((phase, index) => {
            const isCompleted = completedPhases.includes(phase.id);
            const isCurrent = index === currentPhaseIndex;
            const isLocked = index > currentPhaseIndex;

            return (
              <div
                key={phase.id}
                className={`bg-white rounded-xl shadow-sm p-4 transition-all ${
                  isCompleted
                    ? 'border-2 border-green-200'
                    : isCurrent
                    ? 'border-2 border-primary-300 ring-4 ring-primary-100'
                    : isLocked
                    ? 'opacity-60'
                    : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Status Icon */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isCompleted
                        ? 'bg-green-100 text-green-600'
                        : isCurrent
                        ? 'bg-primary-100 text-primary-600'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {isCompleted ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <span className="font-bold">{phase.id}</span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800">
                      {getLocalizedText(phase.titleHu, phase.titleEn, lang)}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {getLocalizedText(phase.descriptionHu, phase.descriptionEn, lang)}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      <span>
                        ~{phase.estimatedMinutes} {t('common.minutes', lang)}
                      </span>
                      <span>{phase.feedbackQuestions.length} {lang === 'hu' ? 'kérdés' : 'questions'}</span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="flex-shrink-0">
                    {isCompleted ? (
                      <span className="px-4 py-2 bg-green-100 text-green-600 text-sm font-medium rounded-lg">
                        {t('phases.completed', lang)}
                      </span>
                    ) : isCurrent ? (
                      <button
                        onClick={() => handleStartPhase(phase.id)}
                        className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg
                                 hover:bg-primary-700 transition-colors"
                      >
                        {completedPhases.length === 0
                          ? t('dashboard.startTesting', lang)
                          : t('dashboard.continueTesting', lang)}
                      </button>
                    ) : (
                      <span className="px-4 py-2 bg-gray-100 text-gray-400 text-sm font-medium rounded-lg">
                        {lang === 'hu' ? 'Zárolva' : 'Locked'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Test Button */}
        <div className="mt-8">
          <button
            onClick={() => router.push('/test-portal/quick-test')}
            className="w-full flex items-center justify-center gap-3 p-5 bg-gradient-to-r from-primary-600 to-primary-700
                     text-white rounded-2xl shadow-lg hover:from-primary-700 hover:to-primary-800 transition-all"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <div className="text-left">
              <div className="font-bold text-lg">
                {lang === 'hu' ? 'Gyors Teszteles' : 'Quick Test'}
              </div>
              <div className="text-sm opacity-90">
                {lang === 'hu'
                  ? 'Valassz sofört, helyszint vagy partnert es lepj be azonnal'
                  : 'Select driver, location or partner and login instantly'}
              </div>
            </div>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Quick Actions */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <button
            onClick={() => router.push('/docs?from=tester')}
            className="flex items-center justify-center gap-2 p-4 bg-white rounded-xl shadow-sm
                     text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
            {t('dashboard.viewDocumentation', lang)}
          </button>
          <button
            onClick={() => router.push('/test-portal/bug-report')}
            className="flex items-center justify-center gap-2 p-4 bg-white rounded-xl shadow-sm
                     text-orange-600 hover:bg-orange-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            {t('dashboard.reportBug', lang)}
          </button>
        </div>
      </main>
    </div>
  );
}
