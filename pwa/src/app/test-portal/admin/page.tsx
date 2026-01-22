'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Language } from '../types';
import { t } from '../i18n';
import {
  isAdminLoggedIn,
  validateAdminLogin,
  setAdminSession,
  clearAdminSession,
  getTesters,
  createTester,
  deleteTester,
  updateTester,
  regenerateTesterPassword,
  sendTesterInvite,
  getBugReports,
  updateBugStatus,
  getTestingStats,
  getFeedback,
  Tester,
  TestBugReport,
  TestingStats,
  TestFeedback,
} from '../api';
import { TEST_PHASES } from '../test-phases';

export default function AdminPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [lang, setLang] = useState<Language>('hu');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Admin state
  const [testers, setTesters] = useState<Tester[]>([]);
  const [bugs, setBugs] = useState<TestBugReport[]>([]);
  const [feedback, setFeedback] = useState<TestFeedback[]>([]);
  const [stats, setStats] = useState<TestingStats>({
    totalTesters: 0,
    activeTesters: 0,
    completedTesters: 0,
    totalBugs: 0,
    averageRating: 0,
    completionRate: 0,
  });

  // Add tester form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTesterName, setNewTesterName] = useState('');
  const [newTesterEmail, setNewTesterEmail] = useState('');
  const [newTesterLang, setNewTesterLang] = useState<'HU' | 'EN'>('HU');
  const [createdTester, setCreatedTester] = useState<Tester | null>(null);

  // Edit tester
  const [editingTester, setEditingTester] = useState<Tester | null>(null);
  const [editName, setEditName] = useState('');
  const [editLang, setEditLang] = useState<'HU' | 'EN'>('HU');

  // Active tab
  const [activeTab, setActiveTab] = useState<'testers' | 'bugs' | 'feedback' | 'export'>('testers');

  const loadData = useCallback(async () => {
    try {
      const [testersData, bugsData, feedbackData, statsData] = await Promise.all([
        getTesters(),
        getBugReports(),
        getFeedback(),
        getTestingStats(),
      ]);
      setTesters(testersData);
      setBugs(bugsData);
      setFeedback(feedbackData);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  }, []);

  useEffect(() => {
    if (isAdminLoggedIn()) {
      setIsLoggedIn(true);
      loadData();
    }
    setIsLoading(false);
  }, [loadData]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const valid = await validateAdminLogin(email, password);
      if (valid) {
        setAdminSession();
        setIsLoggedIn(true);
        await loadData();
      } else {
        setError(t('login.invalidCredentials', lang));
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    clearAdminSession();
    setIsLoggedIn(false);
    router.push('/test-portal');
  };

  const handleAddTester = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSendingInvite(true);

    try {
      const tester = await createTester(newTesterName, newTesterEmail, newTesterLang);

      // Send invitation email
      try {
        await sendTesterInvite(tester.id);
      } catch {
        console.warn('Invitation email could not be sent, but tester was created');
      }

      setCreatedTester(tester);
      setNewTesterName('');
      setNewTesterEmail('');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSendingInvite(false);
    }
  };

  const handleDeleteTester = async (id: string) => {
    if (confirm(t('admin.deleteConfirm', lang))) {
      try {
        await deleteTester(id);
        await loadData();
      } catch (err: any) {
        setError(err.message);
      }
    }
  };

  const handleEditTester = (tester: Tester) => {
    setEditingTester(tester);
    setEditName(tester.name);
    setEditLang(tester.language);
  };

  const handleSaveEdit = async () => {
    if (!editingTester) return;
    try {
      await updateTester(editingTester.id, {
        name: editName,
        language: editLang,
      });
      setEditingTester(null);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRegeneratePassword = async (tester: Tester) => {
    if (!confirm(lang === 'hu'
      ? 'Biztosan új jelszót szeretnél generálni? A régi jelszó érvénytelenné válik!'
      : 'Are you sure you want to generate a new password? The old password will be invalidated!'
    )) return;

    try {
      const newPassword = await regenerateTesterPassword(tester.id);

      // Send new password via email
      try {
        await sendTesterInvite(tester.id);
        alert(lang === 'hu'
          ? `Új jelszó generálva és elküldve: ${newPassword}`
          : `New password generated and sent: ${newPassword}`
        );
      } catch {
        alert(lang === 'hu'
          ? `Új jelszó: ${newPassword} (email küldés sikertelen)`
          : `New password: ${newPassword} (email sending failed)`
        );
      }
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleResendInvite = async (tester: Tester) => {
    try {
      await sendTesterInvite(tester.id);
      alert(lang === 'hu' ? 'Meghívó elküldve!' : 'Invite sent!');
    } catch (err: any) {
      alert(lang === 'hu' ? 'Hiba történt az email küldésekor' : 'Error sending email');
    }
  };

  const handleExportData = async () => {
    const data = {
      testers: testers.map(t => ({ ...t, password: '***' })),
      feedback,
      bugs,
      stats,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vsys-test-results-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBugStatusChange = async (bugId: string, status: TestBugReport['status']) => {
    try {
      await updateBugStatus(bugId, status);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Loading state
  if (isLoading && !isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Login Screen
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h1 className="text-2xl font-bold text-gray-800 text-center mb-6">
              {t('admin.title', lang)}
            </h1>

            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl
                           focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
                  placeholder="admin@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('login.password', lang)}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl
                           focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-gray-800 text-white font-semibold rounded-xl
                         hover:bg-gray-900 transition-colors disabled:opacity-50"
              >
                {isLoading ? '...' : t('login.loginButton', lang)}
              </button>
            </form>

            <div className="mt-4 text-center">
              <a
                href="/test-portal"
                className="text-sm text-gray-500 hover:text-primary-600"
              >
                ← {t('common.back', lang)}
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Admin Dashboard
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">
            vSys Test Portal - {t('admin.title', lang)}
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              <button
                onClick={() => setLang('hu')}
                className={`px-2 py-1 rounded text-sm ${
                  lang === 'hu' ? 'bg-primary-100 text-primary-700' : 'text-gray-500'
                }`}
              >
                HU
              </button>
              <button
                onClick={() => setLang('en')}
                className={`px-2 py-1 rounded text-sm ${
                  lang === 'en' ? 'bg-primary-100 text-primary-700' : 'text-gray-500'
                }`}
              >
                EN
              </button>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              {t('common.logout', lang)}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">{t('admin.testers', lang)}</p>
            <p className="text-2xl font-bold text-gray-800">{stats.totalTesters}/5</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">{lang === 'hu' ? 'Aktív' : 'Active'}</p>
            <p className="text-2xl font-bold text-green-600">{stats.activeTesters}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">{t('admin.bugs', lang)}</p>
            <p className="text-2xl font-bold text-orange-600">{stats.totalBugs}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">{lang === 'hu' ? 'Átlag értékelés' : 'Avg rating'}</p>
            <p className="text-2xl font-bold text-primary-600">{stats.averageRating || '-'}/5</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(['testers', 'bugs', 'feedback', 'export'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab === 'testers' && t('admin.testers', lang)}
              {tab === 'bugs' && t('admin.bugs', lang)}
              {tab === 'feedback' && t('admin.feedbackResults', lang)}
              {tab === 'export' && t('admin.exportData', lang)}
            </button>
          ))}
        </div>

        {/* Testers Tab */}
        {activeTab === 'testers' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-800">
                {t('admin.testers', lang)}
              </h2>
              <button
                onClick={() => setShowAddForm(true)}
                disabled={testers.length >= 5}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg
                         hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                + {t('admin.addTester', lang)}
              </button>
            </div>

            {testers.length >= 5 && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
                {t('admin.maxTestersReached', lang)}
              </div>
            )}

            {/* Add Tester Form */}
            {showAddForm && (
              <div className="mb-6 p-4 bg-gray-50 rounded-xl">
                <h3 className="font-medium text-gray-800 mb-4">
                  {t('admin.addTester', lang)}
                </h3>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                    {error}
                  </div>
                )}

                {createdTester ? (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                    <p className="font-medium text-green-700 mb-2">
                      {t('admin.inviteSent', lang)}
                    </p>
                    <div className="space-y-1 text-sm">
                      <p><strong>Email:</strong> {createdTester.email}</p>
                      <p><strong>{t('login.password', lang)}:</strong> {createdTester.password}</p>
                    </div>
                    <button
                      onClick={() => {
                        setCreatedTester(null);
                        setShowAddForm(false);
                      }}
                      className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg"
                    >
                      OK
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleAddTester} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('admin.testerName', lang)}
                        </label>
                        <input
                          type="text"
                          value={newTesterName}
                          onChange={(e) => setNewTesterName(e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('admin.testerEmail', lang)}
                        </label>
                        <input
                          type="email"
                          value={newTesterEmail}
                          onChange={(e) => setNewTesterEmail(e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('admin.testerLanguage', lang)}
                        </label>
                        <select
                          value={newTesterLang}
                          onChange={(e) => setNewTesterLang(e.target.value as 'HU' | 'EN')}
                          className="w-full px-3 py-2 border rounded-lg"
                        >
                          <option value="HU">Magyar</option>
                          <option value="EN">English</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={sendingInvite}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                      >
                        {sendingInvite
                          ? (lang === 'hu' ? 'Küldés...' : 'Sending...')
                          : t('admin.sendInvite', lang)}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddForm(false)}
                        disabled={sendingInvite}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
                      >
                        {t('common.cancel', lang)}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Testers List */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                      {t('admin.testerName', lang)}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                      {t('admin.testerEmail', lang)}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                      {t('admin.testerStatus', lang)}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                      {t('admin.testerProgress', lang)}
                    </th>
                    <th className="text-right py-3 px-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {testers.map((tester) => (
                    <tr key={tester.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-800">{tester.name}</div>
                        <div className="text-xs text-gray-500">{tester.language}</div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{tester.email}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            tester.status === 'COMPLETED'
                              ? 'bg-green-100 text-green-700'
                              : tester.status === 'ACTIVE'
                              ? 'bg-blue-100 text-blue-700'
                              : tester.status === 'INVITED'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {tester.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-primary-600 h-2 rounded-full"
                              style={{
                                width: `${((tester.currentPhase - 1) / tester.totalPhases) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-sm text-gray-600">
                            {tester.currentPhase - 1}/{tester.totalPhases}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 justify-end flex-wrap">
                          {/* Resend Invite */}
                          <button
                            onClick={() => handleResendInvite(tester)}
                            className="text-primary-600 hover:text-primary-800 text-xs px-2 py-1 border rounded"
                            title={lang === 'hu' ? 'Meghívó újraküldése' : 'Resend invite'}
                          >
                            📧
                          </button>
                          {/* Edit */}
                          <button
                            onClick={() => handleEditTester(tester)}
                            className="text-blue-600 hover:text-blue-800 text-xs px-2 py-1 border rounded"
                          >
                            {lang === 'hu' ? 'Szerk.' : 'Edit'}
                          </button>
                          {/* Regenerate Password */}
                          <button
                            onClick={() => handleRegeneratePassword(tester)}
                            className="text-orange-600 hover:text-orange-800 text-xs px-2 py-1 border rounded"
                            title={lang === 'hu' ? 'Új jelszó' : 'New password'}
                          >
                            🔄
                          </button>
                          {/* Delete */}
                          <button
                            onClick={() => handleDeleteTester(tester.id)}
                            className="text-red-600 hover:text-red-800 text-xs px-2 py-1 border rounded"
                          >
                            {lang === 'hu' ? 'Törlés' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {testers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500">
                        {lang === 'hu' ? 'Még nincs tesztelő' : 'No testers yet'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Edit Tester Modal */}
            {editingTester && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
                  <h3 className="text-lg font-semibold mb-4">
                    {lang === 'hu' ? 'Tesztelő szerkesztése' : 'Edit Tester'}
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('admin.testerName', lang)}
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={editingTester.email}
                        disabled
                        className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {lang === 'hu' ? 'Email nem módosítható' : 'Email cannot be changed'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('admin.testerLanguage', lang)}
                      </label>
                      <select
                        value={editLang}
                        onChange={(e) => setEditLang(e.target.value as 'HU' | 'EN')}
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        <option value="HU">Magyar</option>
                        <option value="EN">English</option>
                      </select>
                    </div>
                    <div className="flex gap-2 pt-4">
                      <button
                        onClick={handleSaveEdit}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                      >
                        {lang === 'hu' ? 'Mentés' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingTester(null)}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800"
                      >
                        {t('common.cancel', lang)}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bugs Tab */}
        {activeTab === 'bugs' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-6">
              {t('admin.bugs', lang)}
            </h2>

            {bugs.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                {lang === 'hu' ? 'Még nincs bejelentett hiba' : 'No bugs reported yet'}
              </p>
            ) : (
              <div className="space-y-4">
                {bugs.map((bug) => {
                  const tester = testers.find((t) => t.id === bug.testerId);
                  return (
                    <div key={bug.id} className="border rounded-xl p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium text-gray-800">{bug.title}</h3>
                          <p className="text-sm text-gray-600 mt-1">{bug.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span>Phase {bug.phaseId}</span>
                            <span>{tester?.name || 'Unknown'}</span>
                            <span>{new Date(bug.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
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
                          <select
                            value={bug.status}
                            onChange={(e) =>
                              handleBugStatusChange(bug.id, e.target.value as TestBugReport['status'])
                            }
                            className="text-sm border rounded px-2 py-1"
                          >
                            <option value="NEW">New</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="FIXED">Fixed</option>
                            <option value="WONT_FIX">Won&apos;t Fix</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Feedback Tab */}
        {activeTab === 'feedback' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-6">
              {t('admin.feedbackResults', lang)}
            </h2>

            {TEST_PHASES.map((phase) => {
              const phaseFeedback = feedback.filter((f) => f.phaseId === phase.id);
              const ratings = phaseFeedback.filter((f) => {
                try {
                  const val = JSON.parse(f.value);
                  return typeof val === 'number';
                } catch {
                  return false;
                }
              });
              const avgRating =
                ratings.length > 0
                  ? ratings.reduce((sum, f) => {
                      try {
                        return sum + JSON.parse(f.value);
                      } catch {
                        return sum;
                      }
                    }, 0) / ratings.length
                  : 0;

              return (
                <div key={phase.id} className="mb-6 border-b pb-6 last:border-b-0">
                  <h3 className="font-medium text-gray-800 mb-2">
                    {lang === 'hu' ? phase.titleHu : phase.titleEn}
                  </h3>
                  <div className="flex items-center gap-6 text-sm">
                    <span className="text-gray-600">
                      {lang === 'hu' ? 'Válaszok' : 'Responses'}: {phaseFeedback.length}
                    </span>
                    {avgRating > 0 && (
                      <span className="text-primary-600">
                        {lang === 'hu' ? 'Átlag értékelés' : 'Avg rating'}:{' '}
                        {avgRating.toFixed(1)}/5
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Export Tab */}
        {activeTab === 'export' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-6">
              {t('admin.exportData', lang)}
            </h2>

            <p className="text-gray-600 mb-6">
              {lang === 'hu'
                ? 'Az összes tesztelési adat exportálása JSON formátumban.'
                : 'Export all testing data in JSON format.'}
            </p>

            <button
              onClick={handleExportData}
              className="px-6 py-3 bg-primary-600 text-white rounded-xl
                       hover:bg-primary-700 transition-colors"
            >
              {t('admin.exportData', lang)} (JSON)
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
