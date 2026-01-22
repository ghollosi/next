'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Language } from '../types';
import { t, getLocalizedText } from '../i18n';
import { getTesterSession, createBugReport, getBugReportsByTester, TesterSession } from '../api';
import { TEST_PHASES } from '../test-phases';

interface BugReport {
  id: string;
  testerId: string;
  phaseId: number;
  title: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: string;
  screenshotUrl?: string;
  createdAt: string;
}

export default function BugReportPage() {
  const router = useRouter();
  const [session, setSession] = useState<TesterSession | null>(null);
  const [lang, setLang] = useState<Language>('hu');
  const [myBugs, setMyBugs] = useState<BugReport[]>([]);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [phaseId, setPhaseId] = useState(1);
  const [severity, setSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const s = getTesterSession();
      if (!s) {
        router.replace('/test-portal');
        return;
      }
      setSession(s);
      setLang((s.language?.toLowerCase() || 'hu') as Language);

      try {
        const bugs = await getBugReportsByTester(s.id);
        setMyBugs(bugs);
      } catch (err) {
        console.error('Failed to load bugs:', err);
      }
    };
    loadData();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    setIsSubmitting(true);

    try {
      await createBugReport(session.id, phaseId, title, description, severity);
      setSuccess(true);
      setTitle('');
      setDescription('');

      // Reload bugs
      const bugs = await getBugReportsByTester(session.id);
      setMyBugs(bugs);

      // Reset success after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to submit bug:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Severity translations
  const severityLabels = {
    LOW: { hu: 'Alacsony', en: 'Low' },
    MEDIUM: { hu: 'Közepes', en: 'Medium' },
    HIGH: { hu: 'Magas', en: 'High' },
    CRITICAL: { hu: 'Kritikus', en: 'Critical' },
  };

  const severityDescriptions = {
    LOW: { hu: 'Kozmetikai hiba, nem akadályozza a használatot', en: 'Cosmetic issue, does not block usage' },
    MEDIUM: { hu: 'Működési hiba, van workaround', en: 'Functional issue, workaround exists' },
    HIGH: { hu: 'Jelentős probléma, nehéz használni', en: 'Significant problem, difficult to use' },
    CRITICAL: { hu: 'Blokkoló hiba, nem használható', en: 'Blocking issue, unusable' },
  };

  const statusLabels: Record<string, { hu: string; en: string }> = {
    NEW: { hu: 'Új', en: 'New' },
    IN_PROGRESS: { hu: 'Folyamatban', en: 'In Progress' },
    FIXED: { hu: 'Javítva', en: 'Fixed' },
    WONT_FIX: { hu: 'Nem javítjuk', en: 'Won\'t Fix' },
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">{lang === 'hu' ? 'Betöltés...' : 'Loading...'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/test-portal/dashboard')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {lang === 'hu' ? 'Vissza' : 'Back'}
            </button>
            <div className="text-sm text-gray-500">
              {session.name}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            {lang === 'hu' ? 'Hiba bejelentése' : 'Report a Bug'}
          </h1>
          <p className="text-gray-500 mt-2">
            {lang === 'hu'
              ? 'Találtál hibát? Kérjük, írd le részletesen, hogy javíthassuk!'
              : 'Found a bug? Please describe it in detail so we can fix it!'}
          </p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="text-green-700 font-medium">
              {lang === 'hu' ? 'Hiba sikeresen bejelentve! Köszönjük!' : 'Bug reported successfully! Thank you!'}
            </div>
          </div>
        )}

        {/* Bug Report Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Phase Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {lang === 'hu' ? 'Melyik részben találtad a hibát?' : 'Where did you find the bug?'}
              </label>
              <select
                value={phaseId}
                onChange={(e) => setPhaseId(parseInt(e.target.value))}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-white
                         focus:border-orange-500 focus:ring-4 focus:ring-orange-100 transition-all"
              >
                <option value={0}>{lang === 'hu' ? 'Egyéb / Általános' : 'Other / General'}</option>
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
                {lang === 'hu' ? 'Hiba rövid leírása' : 'Bug title'} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl
                         focus:border-orange-500 focus:ring-4 focus:ring-orange-100 transition-all"
                placeholder={lang === 'hu' ? 'Pl: A gomb nem működik' : 'E.g., Button not working'}
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {lang === 'hu' ? 'Részletes leírás' : 'Detailed description'} <span className="text-red-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl
                         focus:border-orange-500 focus:ring-4 focus:ring-orange-100
                         resize-none h-32 transition-all"
                placeholder={
                  lang === 'hu'
                    ? 'Írd le részletesen:\n- Mit csináltál?\n- Mi történt?\n- Mi lett volna a helyes működés?'
                    : 'Describe in detail:\n- What did you do?\n- What happened?\n- What should have happened?'
                }
                required
              />
            </div>

            {/* Severity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                {lang === 'hu' ? 'Súlyosság' : 'Severity'}
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSeverity(s)}
                    className={`p-4 rounded-xl text-left transition-all ${
                      severity === s
                        ? s === 'LOW'
                          ? 'bg-gray-100 border-2 border-gray-400 shadow-sm'
                          : s === 'MEDIUM'
                          ? 'bg-yellow-50 border-2 border-yellow-400 shadow-sm'
                          : s === 'HIGH'
                          ? 'bg-orange-50 border-2 border-orange-400 shadow-sm'
                          : 'bg-red-50 border-2 border-red-400 shadow-sm'
                        : 'bg-gray-50 border-2 border-transparent hover:border-gray-200'
                    }`}
                  >
                    <div className={`font-semibold ${
                      s === 'LOW' ? 'text-gray-700' :
                      s === 'MEDIUM' ? 'text-yellow-700' :
                      s === 'HIGH' ? 'text-orange-700' :
                      'text-red-700'
                    }`}>
                      {severityLabels[s][lang]}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {severityDescriptions[s][lang]}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting || !title.trim() || !description.trim()}
              className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-xl
                       hover:from-orange-600 hover:to-orange-700 active:scale-[0.98] transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-200"
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
                  {lang === 'hu' ? 'Küldés...' : 'Submitting...'}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  {lang === 'hu' ? 'Hiba beküldése' : 'Submit Bug Report'}
                </span>
              )}
            </button>
          </form>
        </div>

        {/* My Bug Reports */}
        {myBugs.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              {lang === 'hu' ? 'Az én bejelentéseim' : 'My Reports'}
              <span className="text-sm font-normal text-gray-400">({myBugs.length})</span>
            </h2>
            <div className="space-y-3">
              {myBugs.map((bug) => (
                <div key={bug.id} className="border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-800 truncate">{bug.title}</h3>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{bug.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                          </svg>
                          {lang === 'hu' ? 'Fázis' : 'Phase'} {bug.phaseId || '-'}
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {new Date(bug.createdAt).toLocaleDateString(lang === 'hu' ? 'hu-HU' : 'en-US')}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                          bug.severity === 'CRITICAL'
                            ? 'bg-red-100 text-red-700'
                            : bug.severity === 'HIGH'
                            ? 'bg-orange-100 text-orange-700'
                            : bug.severity === 'MEDIUM'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {severityLabels[bug.severity][lang]}
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                          bug.status === 'NEW'
                            ? 'bg-blue-100 text-blue-700'
                            : bug.status === 'IN_PROGRESS'
                            ? 'bg-purple-100 text-purple-700'
                            : bug.status === 'FIXED'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {statusLabels[bug.status]?.[lang] || bug.status}
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
