'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TesterSession, BugReport } from '../types';
import { t, getLocalizedText } from '../i18n';
import { getTesterSession, createBugReport, getBugReportsByTester } from '../storage';
import { TEST_PHASES } from '../test-phases';

export default function BugReportPage() {
  const router = useRouter();
  const [session, setSession] = useState<TesterSession | null>(null);
  const [myBugs, setMyBugs] = useState<BugReport[]>([]);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [phaseId, setPhaseId] = useState(1);
  const [severity, setSeverity] = useState<BugReport['severity']>('MEDIUM');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const s = getTesterSession();
    if (!s) {
      router.replace('/test-portal');
      return;
    }
    setSession(s);
    setMyBugs(getBugReportsByTester(s.testerId));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    setIsSubmitting(true);

    try {
      createBugReport(session.testerId, phaseId, title, description, severity);
      setSuccess(true);
      setTitle('');
      setDescription('');
      setMyBugs(getBugReportsByTester(session.testerId));

      // Reset success after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to submit bug:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">{t('common.loading', 'hu')}</div>
      </div>
    );
  }

  const lang = session.language;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/test-portal/dashboard')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {t('common.back', lang)}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">
          {t('bugReport.title', lang)}
        </h1>

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700">
            {t('bugReport.bugSubmitted', lang)}
          </div>
        )}

        {/* Bug Report Form */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Phase Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {lang === 'hu' ? 'Melyik fázisban találtad?' : 'Which phase did you find it in?'}
              </label>
              <select
                value={phaseId}
                onChange={(e) => setPhaseId(parseInt(e.target.value))}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl
                         focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
              >
                {TEST_PHASES.map((phase) => (
                  <option key={phase.id} value={phase.id}>
                    {phase.id}. {getLocalizedText(phase.titleHu, phase.titleEn, lang)}
                  </option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('bugReport.bugTitle', lang)} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl
                         focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
                placeholder={lang === 'hu' ? 'Pl: A gomb nem működik' : 'E.g., Button not working'}
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('bugReport.description', lang)} <span className="text-red-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl
                         focus:border-primary-500 focus:ring-4 focus:ring-primary-100
                         resize-none h-32"
                placeholder={
                  lang === 'hu'
                    ? 'Írd le részletesen, mit tapasztaltál és hogyan lehet reprodukálni...'
                    : 'Describe in detail what you experienced and how to reproduce it...'
                }
                required
              />
            </div>

            {/* Severity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('bugReport.severity', lang)}
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSeverity(s)}
                    className={`p-3 rounded-xl text-left transition-all ${
                      severity === s
                        ? s === 'LOW'
                          ? 'bg-gray-100 border-2 border-gray-400'
                          : s === 'MEDIUM'
                          ? 'bg-yellow-100 border-2 border-yellow-400'
                          : s === 'HIGH'
                          ? 'bg-orange-100 border-2 border-orange-400'
                          : 'bg-red-100 border-2 border-red-400'
                        : 'bg-gray-50 border-2 border-transparent hover:border-gray-200'
                    }`}
                  >
                    <div className="font-medium">{s}</div>
                    <div className="text-xs text-gray-500">
                      {getLocalizedText(
                        t(`bugReport.severityLevels.${s}`, 'hu'),
                        t(`bugReport.severityLevels.${s}`, 'en'),
                        lang
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting || !title.trim() || !description.trim()}
              className="w-full py-4 bg-orange-500 text-white font-semibold rounded-xl
                       hover:bg-orange-600 active:scale-[0.98] transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  {t('common.loading', lang)}
                </span>
              ) : (
                t('bugReport.submitBug', lang)
              )}
            </button>
          </form>
        </div>

        {/* My Bug Reports */}
        {myBugs.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              {lang === 'hu' ? 'Az én bejelentéseim' : 'My reports'} ({myBugs.length})
            </h2>
            <div className="space-y-3">
              {myBugs.map((bug) => (
                <div key={bug.id} className="border rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-gray-800">{bug.title}</h3>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{bug.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        <span>
                          {lang === 'hu' ? 'Fázis' : 'Phase'} {bug.phaseId}
                        </span>
                        <span>{new Date(bug.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          bug.severity === 'CRITICAL'
                            ? 'bg-red-100 text-red-700'
                            : bug.severity === 'HIGH'
                            ? 'bg-orange-100 text-orange-700'
                            : bug.severity === 'MEDIUM'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {bug.severity}
                      </span>
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          bug.status === 'NEW'
                            ? 'bg-blue-100 text-blue-700'
                            : bug.status === 'REVIEWED'
                            ? 'bg-purple-100 text-purple-700'
                            : bug.status === 'FIXED'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {bug.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
