'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { TesterSession, FeedbackQuestion } from '../../types';
import { t, getLocalizedText } from '../../i18n';
import {
  getTesterSession,
  saveBatchFeedback,
  updateTesterSession,
} from '../../storage';
import { TEST_PHASES, getPhaseById } from '../../test-phases';

export default function PhasePage() {
  const router = useRouter();
  const params = useParams();
  const phaseId = parseInt(params.id as string);

  const [session, setSession] = useState<TesterSession | null>(null);
  const [phase, setPhase] = useState(getPhaseById(phaseId));
  const [step, setStep] = useState<'instructions' | 'testing' | 'feedback'>('instructions');
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    const s = getTesterSession();
    if (!s) {
      router.replace('/test-portal');
      return;
    }
    setSession(s);

    const p = getPhaseById(phaseId);
    if (!p) {
      router.replace('/test-portal/dashboard');
      return;
    }
    setPhase(p);
  }, [router, phaseId]);

  if (!session || !phase) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">{t('common.loading', 'hu')}</div>
      </div>
    );
  }

  const lang = session.language;

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const validateAnswers = (): boolean => {
    const newErrors: string[] = [];
    phase.feedbackQuestions.forEach((q) => {
      if (q.required && (answers[q.id] === undefined || answers[q.id] === '')) {
        newErrors.push(q.id);
      }
    });
    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmitFeedback = () => {
    if (!validateAnswers()) {
      return;
    }

    // Save all feedback
    const feedbackItems = Object.entries(answers).map(([questionId, value]) => ({
      questionId,
      value,
    }));
    saveBatchFeedback(session.testerId, phase.id, feedbackItems);

    // Update session
    const newCompletedPhases = [...session.completedPhases, phase.id];
    updateTesterSession({
      completedPhases: newCompletedPhases,
      currentPhase: phase.id + 1,
    });

    // Check if all phases completed
    if (newCompletedPhases.length >= TEST_PHASES.length) {
      router.push('/test-portal/complete');
    } else {
      router.push('/test-portal/dashboard');
    }
  };

  const renderFeedbackInput = (question: FeedbackQuestion) => {
    const hasError = errors.includes(question.id);

    switch (question.type) {
      case 'YES_NO':
        return (
          <div className="flex gap-4">
            <button
              onClick={() => handleAnswerChange(question.id, true)}
              className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                answers[question.id] === true
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {t('common.yes', lang)}
            </button>
            <button
              onClick={() => handleAnswerChange(question.id, false)}
              className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                answers[question.id] === false
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {t('common.no', lang)}
            </button>
          </div>
        );

      case 'RATING':
        return (
          <div className="flex gap-2">
            {(question.options || []).map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleAnswerChange(question.id, opt.value)}
                className={`flex-1 py-3 px-2 rounded-xl text-center transition-all ${
                  answers[question.id] === opt.value
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <div className="text-lg font-bold">{opt.value}</div>
                <div className="text-xs truncate">
                  {getLocalizedText(opt.labelHu, opt.labelEn, lang)}
                </div>
              </button>
            ))}
          </div>
        );

      case 'TEXT':
        return (
          <textarea
            value={answers[question.id] || ''}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            className={`w-full px-4 py-3 border-2 rounded-xl resize-none h-24
                     focus:ring-4 focus:ring-primary-100 transition-all ${
                       hasError ? 'border-red-300' : 'border-gray-200 focus:border-primary-500'
                     }`}
            placeholder={t('feedback.textPlaceholder', lang)}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
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
            <span className="text-sm text-gray-500">
              {lang === 'hu' ? 'Fázis' : 'Phase'} {phase.id}/{TEST_PHASES.length}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Phase Title */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-bold text-primary-600">{phase.id}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">
            {getLocalizedText(phase.titleHu, phase.titleEn, lang)}
          </h1>
          <p className="text-gray-500 mt-2">
            {getLocalizedText(phase.descriptionHu, phase.descriptionEn, lang)}
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {(['instructions', 'testing', 'feedback'] as const).map((s, idx) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === s
                    ? 'bg-primary-600 text-white'
                    : idx < ['instructions', 'testing', 'feedback'].indexOf(step)
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {idx + 1}
              </div>
              {idx < 2 && <div className="w-12 h-0.5 bg-gray-200 mx-2" />}
            </div>
          ))}
        </div>

        {/* Instructions Step */}
        {step === 'instructions' && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              {t('phases.instructions', lang)}
            </h2>

            <ol className="space-y-3 mb-6">
              {(lang === 'hu' ? phase.instructionsHu : phase.instructionsEn).map((inst, idx) => (
                <li key={idx} className="flex gap-3">
                  <span className="w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-gray-700">{inst}</span>
                </li>
              ))}
            </ol>

            {/* Login Info */}
            {phase.loginInfo && (
              <div className="bg-blue-50 rounded-xl p-4 mb-6">
                <h3 className="font-medium text-blue-800 mb-2">
                  {t('phases.loginInfo', lang)}
                </h3>
                <div className="space-y-1 text-sm">
                  {phase.loginInfo.username && (
                    <p>
                      <span className="text-blue-600">
                        {lang === 'hu' ? 'Felhasználó' : 'Username'}:
                      </span>{' '}
                      <code className="bg-blue-100 px-2 py-0.5 rounded">{phase.loginInfo.username}</code>
                    </p>
                  )}
                  {phase.loginInfo.password && (
                    <p>
                      <span className="text-blue-600">
                        {lang === 'hu' ? 'Jelszó' : 'Password'}:
                      </span>{' '}
                      <code className="bg-blue-100 px-2 py-0.5 rounded">{phase.loginInfo.password}</code>
                    </p>
                  )}
                  {phase.loginInfo.note && (
                    <p className="text-blue-700 italic mt-2">{phase.loginInfo.note}</p>
                  )}
                </div>
              </div>
            )}

            {/* Test URL */}
            {phase.targetUrl && (
              <div className="mb-6">
                <a
                  href={phase.targetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white
                           rounded-xl hover:bg-primary-700 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                  {t('phases.openTestPage', lang)}
                </a>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => setStep('testing')}
                className="flex-1 py-3 bg-primary-600 text-white font-semibold rounded-xl
                         hover:bg-primary-700 transition-colors"
              >
                {t('common.continue', lang)} →
              </button>
            </div>
          </div>
        )}

        {/* Testing Step */}
        {step === 'testing' && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">
                {lang === 'hu' ? 'Tesztelés folyamatban' : 'Testing in progress'}
              </h2>
              <p className="text-gray-500 mb-6">
                {lang === 'hu'
                  ? 'Hajtsd végre a tesztlépéseket, majd kattints a "Kész" gombra.'
                  : 'Complete the test steps, then click "Done".'}
              </p>

              {phase.targetUrl && (
                <a
                  href={phase.targetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700
                           rounded-xl hover:bg-gray-200 transition-colors mb-6"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                  {t('phases.openTestPage', lang)}
                </a>
              )}

              <div className="flex gap-4 mt-4">
                <button
                  onClick={() => setStep('instructions')}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl
                           hover:bg-gray-200 transition-colors"
                >
                  ← {t('common.back', lang)}
                </button>
                <button
                  onClick={() => setStep('feedback')}
                  className="flex-1 py-3 bg-green-600 text-white font-semibold rounded-xl
                           hover:bg-green-700 transition-colors"
                >
                  {lang === 'hu' ? 'Kész, tovább' : 'Done, continue'} →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Feedback Step */}
        {step === 'feedback' && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-6">
              {t('feedback.title', lang)}
            </h2>

            <div className="space-y-6">
              {phase.feedbackQuestions.map((question) => (
                <div key={question.id}>
                  <label className="block text-gray-700 font-medium mb-2">
                    {getLocalizedText(question.questionHu, question.questionEn, lang)}
                    {question.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {renderFeedbackInput(question)}
                  {errors.includes(question.id) && (
                    <p className="text-red-500 text-sm mt-1">
                      {t('phases.feedbackRequired', lang)}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setStep('testing')}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl
                         hover:bg-gray-200 transition-colors"
              >
                ← {t('common.back', lang)}
              </button>
              <button
                onClick={handleSubmitFeedback}
                className="flex-1 py-3 bg-primary-600 text-white font-semibold rounded-xl
                         hover:bg-primary-700 transition-colors"
              >
                {t('common.submit', lang)} →
              </button>
            </div>
          </div>
        )}

        {/* Report Bug Link */}
        <div className="mt-8 text-center">
          <a
            href="/test-portal/bug-report"
            className="inline-flex items-center gap-2 text-orange-600 hover:text-orange-700"
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
          </a>
        </div>
      </main>
    </div>
  );
}
