'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ALL_TEST_MODULES,
  TestModule,
  TestCase,
  TestStep,
  TestResult,
  TEST_SUMMARY
} from '../test-cases';
import { getTesterSession } from '../api';

interface TestExecution {
  testCaseId: string;
  stepResults: {
    stepNumber: number;
    status: TestResult;
    actualResult?: string;
    screenshotNote?: string;
  }[];
  overallResult: TestResult;
  executedAt: string;
  executedBy: string;
  notes?: string;
}

function TestExecutionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedModule, setSelectedModule] = useState<TestModule | null>(null);
  const [selectedTestCase, setSelectedTestCase] = useState<TestCase | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepResults, setStepResults] = useState<Map<number, { status: TestResult; actual?: string }>>(new Map());
  const [executions, setExecutions] = useState<TestExecution[]>([]);
  const [testerName, setTesterName] = useState('');
  const [showSummary, setShowSummary] = useState(false);

  // Load saved executions from localStorage and get tester name from session
  useEffect(() => {
    // Get tester name from session
    const session = getTesterSession();
    if (session?.name) {
      setTesterName(session.name);
    } else {
      // Fallback to localStorage for backwards compatibility
      const name = localStorage.getItem('vsys_tester_name');
      if (name) {
        setTesterName(name);
      }
    }

    // Load saved executions
    const saved = localStorage.getItem('vsys_test_executions');
    if (saved) {
      setExecutions(JSON.parse(saved));
    }
  }, []);

  // Save executions to localStorage
  const saveExecutions = (execs: TestExecution[]) => {
    localStorage.setItem('vsys_test_executions', JSON.stringify(execs));
    setExecutions(execs);
  };

  const saveTesterName = (name: string) => {
    localStorage.setItem('vsys_tester_name', name);
    setTesterName(name);
  };

  const handleStepResult = (stepNumber: number, status: TestResult, actual?: string) => {
    const newResults = new Map(stepResults);
    newResults.set(stepNumber, { status, actual });
    setStepResults(newResults);
  };

  const completeTestCase = () => {
    if (!selectedTestCase || !testerName) return;

    const stepResultsArray = Array.from(stepResults.entries()).map(([stepNumber, result]) => ({
      stepNumber,
      status: result.status,
      actualResult: result.actual
    }));

    // Determine overall result
    const hasFailure = stepResultsArray.some(r => r.status === 'FAIL');
    const hasBlocked = stepResultsArray.some(r => r.status === 'BLOCKED');
    const allPassed = stepResultsArray.every(r => r.status === 'PASS');

    let overallResult: TestResult = 'NOT_TESTED';
    if (hasFailure) overallResult = 'FAIL';
    else if (hasBlocked) overallResult = 'BLOCKED';
    else if (allPassed) overallResult = 'PASS';

    const execution: TestExecution = {
      testCaseId: selectedTestCase.id,
      stepResults: stepResultsArray,
      overallResult,
      executedAt: new Date().toISOString(),
      executedBy: testerName
    };

    const newExecutions = [...executions.filter(e => e.testCaseId !== selectedTestCase.id), execution];
    saveExecutions(newExecutions);

    // Reset and go back to list
    setSelectedTestCase(null);
    setStepResults(new Map());
    setCurrentStepIndex(0);
  };

  const getExecutionForTestCase = (tcId: string): TestExecution | undefined => {
    return executions.find(e => e.testCaseId === tcId);
  };

  const getModuleStats = (module: TestModule) => {
    const total = module.testCases.length;
    const executed = module.testCases.filter(tc => getExecutionForTestCase(tc.id)).length;
    const passed = module.testCases.filter(tc => getExecutionForTestCase(tc.id)?.overallResult === 'PASS').length;
    const failed = module.testCases.filter(tc => getExecutionForTestCase(tc.id)?.overallResult === 'FAIL').length;
    return { total, executed, passed, failed };
  };

  const getOverallStats = () => {
    const total = ALL_TEST_MODULES.reduce((sum, m) => sum + m.testCases.length, 0);
    const executed = executions.length;
    const passed = executions.filter(e => e.overallResult === 'PASS').length;
    const failed = executions.filter(e => e.overallResult === 'FAIL').length;
    const blocked = executions.filter(e => e.overallResult === 'BLOCKED').length;
    return { total, executed, passed, failed, blocked };
  };

  const exportResults = () => {
    const stats = getOverallStats();
    const report = {
      reportDate: new Date().toISOString(),
      tester: testerName,
      summary: stats,
      modules: ALL_TEST_MODULES.map(module => ({
        moduleName: module.moduleName,
        ...getModuleStats(module),
        testCases: module.testCases.map(tc => {
          const exec = getExecutionForTestCase(tc.id);
          return {
            id: tc.id,
            title: tc.title,
            priority: tc.priority,
            result: exec?.overallResult || 'NOT_TESTED',
            executedAt: exec?.executedAt,
            steps: exec?.stepResults
          };
        })
      }))
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vsys-test-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const clearResults = () => {
    if (confirm('Biztosan törlöd az összes teszt eredményt?')) {
      localStorage.removeItem('vsys_test_executions');
      setExecutions([]);
    }
  };

  // Render tester name input if not set
  if (!testerName) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold text-white mb-6">Teszt Végrehajtás</h1>
          <p className="text-gray-400 mb-4">Add meg a neved a teszt eredmények rögzítéséhez:</p>
          <input
            type="text"
            placeholder="Tesztelő neve"
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white mb-4"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.currentTarget.value) {
                saveTesterName(e.currentTarget.value);
              }
            }}
          />
          <button
            onClick={() => {
              const input = document.querySelector('input') as HTMLInputElement;
              if (input.value) saveTesterName(input.value);
            }}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700"
          >
            Kezdés
          </button>
        </div>
      </div>
    );
  }

  // Render test execution
  if (selectedTestCase) {
    const currentStep = selectedTestCase.steps[currentStepIndex];
    const stepResult = stepResults.get(currentStep.stepNumber);

    return (
      <div className="min-h-screen bg-gray-900 text-white">
        {/* Header */}
        <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <button
              onClick={() => {
                if (confirm('Megszakítod a tesztet? Az eredmények elvesznek.')) {
                  setSelectedTestCase(null);
                  setStepResults(new Map());
                  setCurrentStepIndex(0);
                }
              }}
              className="text-gray-400 hover:text-white"
            >
              ← Vissza
            </button>
            <span className="text-sm text-gray-400">
              {selectedTestCase.id} - Lépés {currentStepIndex + 1}/{selectedTestCase.steps.length}
            </span>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-6">
          {/* Test Case Info */}
          <div className="bg-gray-800 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                selectedTestCase.priority === 'CRITICAL' ? 'bg-red-900 text-red-300' :
                selectedTestCase.priority === 'HIGH' ? 'bg-orange-900 text-orange-300' :
                selectedTestCase.priority === 'MEDIUM' ? 'bg-yellow-900 text-yellow-300' :
                'bg-gray-700 text-gray-300'
              }`}>
                {selectedTestCase.priority}
              </span>
              <span className="px-2 py-1 rounded text-xs bg-gray-700 text-gray-300">
                {selectedTestCase.category}
              </span>
            </div>
            <h2 className="text-lg font-semibold">{selectedTestCase.title}</h2>
          </div>

          {/* Preconditions */}
          {currentStepIndex === 0 && selectedTestCase.preconditions.length > 0 && (
            <div className="bg-blue-900/30 border border-blue-700 rounded-xl p-4 mb-6">
              <h3 className="font-medium text-blue-400 mb-2">Előfeltételek:</h3>
              <ul className="space-y-1">
                {selectedTestCase.preconditions.map((pre, i) => (
                  <li key={i} className="text-blue-200 text-sm flex items-start gap-2">
                    <span className="text-blue-400">•</span> {pre}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Current Step */}
          <div className="bg-gray-800 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center font-bold">
                {currentStep.stepNumber}
              </div>
              <h3 className="text-lg font-medium">Lépés {currentStep.stepNumber}</h3>
            </div>

            {/* Action */}
            <div className="mb-6">
              <label className="text-sm text-gray-400 mb-1 block">MŰVELET:</label>
              <p className="text-white bg-gray-700 rounded-lg p-3">{currentStep.action}</p>
            </div>

            {/* Test Data */}
            {currentStep.testData && (
              <div className="mb-6">
                <label className="text-sm text-gray-400 mb-1 block">TESZT ADAT:</label>
                <code className="block bg-gray-900 text-green-400 rounded-lg p-3 font-mono">
                  {currentStep.testData}
                </code>
              </div>
            )}

            {/* Expected Result */}
            <div className="mb-6">
              <label className="text-sm text-gray-400 mb-1 block">ELVÁRT EREDMÉNY:</label>
              <p className="text-yellow-300 bg-gray-700 rounded-lg p-3">{currentStep.expectedResult}</p>
            </div>

            {/* Screenshot reminder */}
            {currentStep.screenshot && (
              <div className="bg-orange-900/30 border border-orange-700 rounded-lg p-3 mb-6">
                <p className="text-orange-300 text-sm">
                  📸 Ha FAIL, készíts képernyőképet!
                </p>
              </div>
            )}

            {/* Result Input */}
            <div className="border-t border-gray-700 pt-6">
              <label className="text-sm text-gray-400 mb-3 block">EREDMÉNY:</label>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <button
                  onClick={() => handleStepResult(currentStep.stepNumber, 'PASS')}
                  className={`py-4 rounded-xl font-semibold transition-all ${
                    stepResult?.status === 'PASS'
                      ? 'bg-green-600 text-white ring-2 ring-green-400'
                      : 'bg-gray-700 text-gray-300 hover:bg-green-600/30'
                  }`}
                >
                  ✓ SIKERES
                </button>
                <button
                  onClick={() => handleStepResult(currentStep.stepNumber, 'FAIL')}
                  className={`py-4 rounded-xl font-semibold transition-all ${
                    stepResult?.status === 'FAIL'
                      ? 'bg-red-600 text-white ring-2 ring-red-400'
                      : 'bg-gray-700 text-gray-300 hover:bg-red-600/30'
                  }`}
                >
                  ✗ SIKERTELEN
                </button>
                <button
                  onClick={() => handleStepResult(currentStep.stepNumber, 'BLOCKED')}
                  className={`py-4 rounded-xl font-semibold transition-all ${
                    stepResult?.status === 'BLOCKED'
                      ? 'bg-yellow-600 text-white ring-2 ring-yellow-400'
                      : 'bg-gray-700 text-gray-300 hover:bg-yellow-600/30'
                  }`}
                >
                  ⚠ BLOKKOLT
                </button>
              </div>

              {/* Actual result notes - show for FAIL and BLOCKED */}
              {stepResult?.status && stepResult.status !== 'PASS' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">
                      Mi történt valójában? (kötelező)
                    </label>
                    <textarea
                      value={stepResult.actual || ''}
                      onChange={(e) => handleStepResult(currentStep.stepNumber, stepResult.status, e.target.value)}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white resize-none h-24"
                      placeholder="Írd le részletesen, mit tapasztaltál..."
                    />
                  </div>

                  {/* Screenshot note */}
                  {currentStep.screenshot && (
                    <div className="bg-orange-900/30 border border-orange-700 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-orange-600/30 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h4 className="text-orange-300 font-medium mb-1">📸 Képernyőkép szükséges!</h4>
                          <p className="text-orange-200/70 text-sm mb-2">
                            Kérjük, készíts képernyőképet a hibáról és mentsd el. A teszt befejezése után csatold a hibajelentésedhez.
                          </p>
                          <p className="text-orange-400/60 text-xs">
                            Tipp: Windows: Win+Shift+S | Mac: Cmd+Shift+4
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Step Navigation */}
          <div className="flex gap-4">
            <button
              onClick={() => setCurrentStepIndex(Math.max(0, currentStepIndex - 1))}
              disabled={currentStepIndex === 0}
              className="flex-1 py-3 bg-gray-700 text-white rounded-xl disabled:opacity-50"
            >
              ← Előző
            </button>

            {currentStepIndex < selectedTestCase.steps.length - 1 ? (
              <button
                onClick={() => {
                  if (stepResult?.status) {
                    setCurrentStepIndex(currentStepIndex + 1);
                  } else {
                    alert('Válassz eredményt a továbblépéshez!');
                  }
                }}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
              >
                Következő →
              </button>
            ) : (
              <button
                onClick={completeTestCase}
                disabled={!stepResult?.status}
                className="flex-1 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50"
              >
                Teszt Befejezése ✓
              </button>
            )}
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-2 mt-6">
            {selectedTestCase.steps.map((_, i) => {
              const result = stepResults.get(i + 1);
              return (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full ${
                    i === currentStepIndex ? 'ring-2 ring-blue-400' : ''
                  } ${
                    result?.status === 'PASS' ? 'bg-green-500' :
                    result?.status === 'FAIL' ? 'bg-red-500' :
                    result?.status === 'BLOCKED' ? 'bg-yellow-500' :
                    'bg-gray-600'
                  }`}
                />
              );
            })}
          </div>
        </main>
      </div>
    );
  }

  // Show summary
  if (showSummary) {
    const stats = getOverallStats();
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <button onClick={() => setShowSummary(false)} className="text-gray-400 hover:text-white">
              ← Vissza
            </button>
            <h1 className="font-semibold">Teszt Összesítő</h1>
            <div />
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-6">
          {/* Overall stats */}
          <div className="grid grid-cols-5 gap-4 mb-8">
            <div className="bg-gray-800 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-white">{stats.total}</div>
              <div className="text-sm text-gray-400">Összes</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-blue-400">{stats.executed}</div>
              <div className="text-sm text-gray-400">Végrehajtva</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-green-400">{stats.passed}</div>
              <div className="text-sm text-gray-400">PASS</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-red-400">{stats.failed}</div>
              <div className="text-sm text-gray-400">FAIL</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-yellow-400">{stats.blocked}</div>
              <div className="text-sm text-gray-400">BLOCKED</div>
            </div>
          </div>

          {/* Pass rate */}
          {stats.executed > 0 && (
            <div className="bg-gray-800 rounded-xl p-4 mb-8">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-400">Sikeres arány</span>
                <span className="text-xl font-bold">
                  {Math.round((stats.passed / stats.executed) * 100)}%
                </span>
              </div>
              <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500"
                  style={{ width: `${(stats.passed / stats.executed) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Module breakdown */}
          <h2 className="text-lg font-semibold mb-4">Modul részletek</h2>
          <div className="space-y-4">
            {ALL_TEST_MODULES.map(module => {
              const mStats = getModuleStats(module);
              return (
                <div key={module.moduleId} className="bg-gray-800 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-medium">{module.moduleName}</h3>
                    <span className="text-sm text-gray-400">
                      {mStats.executed}/{mStats.total}
                    </span>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <span className="text-green-400">✓ {mStats.passed}</span>
                    <span className="text-red-400">✗ {mStats.failed}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Export buttons */}
          <div className="flex gap-4 mt-8">
            <button
              onClick={exportResults}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
            >
              📥 Exportálás (JSON)
            </button>
            <button
              onClick={clearResults}
              className="px-6 py-3 bg-red-600/30 text-red-400 rounded-xl hover:bg-red-600/50"
            >
              Törlés
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Render module/test case list
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push('/test-portal/dashboard')}
            className="text-gray-400 hover:text-white"
          >
            ← Dashboard
          </button>
          <h1 className="font-semibold">Teszt Végrehajtás</h1>
          <button
            onClick={() => setShowSummary(true)}
            className="text-blue-400 hover:text-blue-300"
          >
            Összesítő
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Tester info */}
        <div className="bg-gray-800 rounded-xl p-4 mb-6 flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-400">Tesztelő</p>
            <p className="font-medium">{testerName}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Haladás</p>
            <p className="font-medium">{executions.length} / {TEST_SUMMARY.totalTestCases}</p>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-gray-800 rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-red-400">{TEST_SUMMARY.criticalTests}</div>
            <div className="text-xs text-gray-400">CRITICAL</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-orange-400">{TEST_SUMMARY.highTests}</div>
            <div className="text-xs text-gray-400">HIGH</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-yellow-400">{TEST_SUMMARY.mediumTests}</div>
            <div className="text-xs text-gray-400">MEDIUM</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-gray-400">{TEST_SUMMARY.lowTests}</div>
            <div className="text-xs text-gray-400">LOW</div>
          </div>
        </div>

        {/* Module list or Test case list */}
        {!selectedModule ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Teszt Modulok</h2>
            {ALL_TEST_MODULES.map(module => {
              const stats = getModuleStats(module);
              const progress = stats.total > 0 ? (stats.executed / stats.total) * 100 : 0;
              return (
                <button
                  key={module.moduleId}
                  onClick={() => setSelectedModule(module)}
                  className="w-full bg-gray-800 rounded-xl p-4 text-left hover:bg-gray-750 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-medium">{module.moduleName}</h3>
                      <p className="text-sm text-gray-400">{module.description}</p>
                    </div>
                    <span className="text-sm text-gray-400">
                      {stats.executed}/{stats.total}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${stats.failed > 0 ? 'bg-red-500' : 'bg-green-500'}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex gap-4 mt-2 text-xs">
                    <span className="text-green-400">✓ {stats.passed}</span>
                    <span className="text-red-400">✗ {stats.failed}</span>
                    <span className="text-gray-500">{stats.total - stats.executed} maradt</span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div>
            <button
              onClick={() => setSelectedModule(null)}
              className="text-blue-400 hover:text-blue-300 mb-4"
            >
              ← Modulok
            </button>
            <h2 className="text-lg font-semibold mb-4">{selectedModule.moduleName}</h2>
            <div className="space-y-3">
              {selectedModule.testCases.map(tc => {
                const execution = getExecutionForTestCase(tc.id);
                return (
                  <button
                    key={tc.id}
                    onClick={() => setSelectedTestCase(tc)}
                    className="w-full bg-gray-800 rounded-xl p-4 text-left hover:bg-gray-750 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-gray-500 font-mono">{tc.id}</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            tc.priority === 'CRITICAL' ? 'bg-red-900/50 text-red-400' :
                            tc.priority === 'HIGH' ? 'bg-orange-900/50 text-orange-400' :
                            tc.priority === 'MEDIUM' ? 'bg-yellow-900/50 text-yellow-400' :
                            'bg-gray-700 text-gray-400'
                          }`}>
                            {tc.priority}
                          </span>
                        </div>
                        <h3 className="font-medium text-sm">{tc.title}</h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {tc.steps.length} lépés • {tc.category}
                        </p>
                      </div>
                      <div className="ml-4">
                        {execution ? (
                          <span className={`px-3 py-1 rounded-lg text-sm font-medium ${
                            execution.overallResult === 'PASS' ? 'bg-green-900/50 text-green-400' :
                            execution.overallResult === 'FAIL' ? 'bg-red-900/50 text-red-400' :
                            execution.overallResult === 'BLOCKED' ? 'bg-yellow-900/50 text-yellow-400' :
                            'bg-gray-700 text-gray-400'
                          }`}>
                            {execution.overallResult}
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-lg text-sm bg-gray-700 text-gray-400">
                            →
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function TestExecutionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-900 flex items-center justify-center"><div className="text-white">Betöltés...</div></div>}>
      <TestExecutionContent />
    </Suspense>
  );
}
