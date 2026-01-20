'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TesterSession } from '../types';
import { t } from '../i18n';
import {
  getTesterSession,
  clearTesterSession,
  markTesterCompleted,
  getFeedbackByTester,
  getBugReportsByTester,
} from '../storage';
import { TEST_PHASES } from '../test-phases';
import Confetti from 'react-confetti';

export default function CompletePage() {
  const router = useRouter();
  const [session, setSession] = useState<TesterSession | null>(null);
  const [showConfetti, setShowConfetti] = useState(true);
  const [stats, setStats] = useState({
    phases: 0,
    bugs: 0,
    feedback: 0,
  });

  useEffect(() => {
    const s = getTesterSession();
    if (!s) {
      router.replace('/test-portal');
      return;
    }
    setSession(s);

    // Mark as completed
    markTesterCompleted(s.testerId);

    // Get stats
    const feedback = getFeedbackByTester(s.testerId);
    const bugs = getBugReportsByTester(s.testerId);
    const completedPhases = Array.from(new Set(feedback.map((f) => f.phaseId)));

    setStats({
      phases: completedPhases.length,
      bugs: bugs.length,
      feedback: feedback.length,
    });

    // Stop confetti after 5 seconds
    setTimeout(() => setShowConfetti(false), 5000);
  }, [router]);

  const handleLogout = () => {
    clearTesterSession();
    router.push('/test-portal');
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
    <div className="min-h-screen bg-gradient-to-br from-green-400 via-emerald-500 to-teal-600 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Confetti */}
      {showConfetti && (
        <Confetti
          width={typeof window !== 'undefined' ? window.innerWidth : 300}
          height={typeof window !== 'undefined' ? window.innerHeight : 300}
          recycle={false}
          numberOfPieces={200}
        />
      )}

      <div className="w-full max-w-lg">
        {/* Trophy Icon */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 bg-yellow-400 rounded-full flex items-center justify-center mx-auto shadow-2xl animate-bounce">
            <svg className="w-14 h-14 text-yellow-900" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L8.5 8H4.5L7 12L5 18H9L12 22L15 18H19L17 12L19.5 8H15.5L12 2Z" />
            </svg>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            {t('completion.title', lang)}
          </h1>
          <p className="text-xl text-gray-600 mb-6">
            {t('completion.subtitle', lang)}
          </p>

          {/* Thank You Message */}
          <div className="bg-green-50 rounded-2xl p-6 mb-8">
            <p className="text-green-700 leading-relaxed">
              {t('completion.thankYouMessage', lang)}
            </p>
          </div>

          {/* Stats */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">
              {t('completion.stats', lang)}
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-primary-50 rounded-xl p-4">
                <div className="text-3xl font-bold text-primary-600">{stats.phases}</div>
                <div className="text-sm text-primary-700">{t('completion.phasesCompleted', lang)}</div>
              </div>
              <div className="bg-orange-50 rounded-xl p-4">
                <div className="text-3xl font-bold text-orange-600">{stats.bugs}</div>
                <div className="text-sm text-orange-700">{t('completion.bugsReported', lang)}</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="text-3xl font-bold text-blue-600">{stats.feedback}</div>
                <div className="text-sm text-blue-700">{t('completion.feedbackGiven', lang)}</div>
              </div>
            </div>
          </div>

          {/* Surprise Section */}
          <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-center gap-2 mb-3">
              <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 6h-2.18c.11-.31.18-.65.18-1a2.996 2.996 0 0 0-5.5-1.65l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z" />
              </svg>
              <h3 className="text-xl font-bold text-purple-800">
                {t('completion.surpriseTitle', lang)}
              </h3>
            </div>
            <p className="text-purple-700">
              {t('completion.surpriseMessage', lang)}
            </p>
          </div>

          {/* Certificate Button */}
          <div className="mb-6">
            <p className="text-sm text-gray-500 mb-3">
              {t('completion.certificate', lang)}
            </p>
            <button
              onClick={() => {
                // Generate simple certificate
                const cert = `
                  ═══════════════════════════════════════

                        vSys TESZTELŐI TANÚSÍTVÁNY
                        vSys TESTER CERTIFICATE

                  ═══════════════════════════════════════

                  Ezennel igazoljuk, hogy / This certifies that

                          ${session.testerName}

                  sikeresen elvégezte a vSys platform tesztelését
                  successfully completed vSys platform testing

                  Befejezett fázisok / Completed phases: ${stats.phases}/${TEST_PHASES.length}
                  Bejelentett hibák / Bugs reported: ${stats.bugs}

                  Dátum / Date: ${new Date().toLocaleDateString()}

                  ═══════════════════════════════════════

                  Köszönjük a segítséget!
                  Thank you for your help!

                  ═══════════════════════════════════════
                `;
                const blob = new Blob([cert], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `vsys-tester-certificate-${session.testerName.replace(/\s+/g, '-')}.txt`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700
                       rounded-xl hover:bg-gray-200 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              {t('completion.downloadCertificate', lang)}
            </button>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            {t('common.logout', lang)}
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-white/80 text-sm mt-6">
          vSys Wash Platform © 2024
        </p>
      </div>
    </div>
  );
}
