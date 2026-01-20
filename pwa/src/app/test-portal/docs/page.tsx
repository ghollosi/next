'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TesterSession, Language } from '../types';
import { t, getLocalizedText } from '../i18n';
import { getTesterSession } from '../storage';
import { TEST_PHASES, TOTAL_ESTIMATED_MINUTES } from '../test-phases';

export default function DocsPage() {
  const router = useRouter();
  const [session, setSession] = useState<TesterSession | null>(null);
  const [lang, setLang] = useState<Language>('hu');
  const [activeSection, setActiveSection] = useState<'overview' | 'system' | 'phases' | 'faq'>('overview');

  useEffect(() => {
    const s = getTesterSession();
    if (s) {
      setSession(s);
      setLang(s.language);
    }
  }, []);

  const content = {
    overview: {
      hu: {
        title: 'Áttekintés',
        content: `
## Mi ez a tesztelési portál?

Ez a portál segít neked végigmenni a vSys platform tesztelésén. A tesztelés 7 fázisból áll, és körülbelül ${TOTAL_ESTIMATED_MINUTES} percet vesz igénybe.

## Hogyan működik?

1. **Fázisonként haladj** - Minden fázis egy konkrét funkció tesztelésére koncentrál
2. **Kövesd az utasításokat** - Minden fázisnál részletes útmutatót kapsz
3. **Adj visszajelzést** - Minden fázis végén válaszolj a kérdésekre
4. **Jelents hibákat** - Ha bármilyen problémát találsz, jelezd nekünk

## Fontos tudnivalók

- **QR kód használat**: A SOFŐR olvassa be a HELYSZÍN QR kódját, NEM fordítva!
- **Teszt adatok**: Használd a megadott teszt bejelentkezési adatokat
- **Hibák**: Ha hibát találsz, jelentsd be a "Hiba bejelentése" gombbal
        `,
      },
      en: {
        title: 'Overview',
        content: `
## What is this testing portal?

This portal helps you go through testing the vSys platform. Testing consists of 7 phases and takes approximately ${TOTAL_ESTIMATED_MINUTES} minutes.

## How does it work?

1. **Progress phase by phase** - Each phase focuses on testing a specific function
2. **Follow the instructions** - You'll get detailed guidance for each phase
3. **Provide feedback** - Answer questions at the end of each phase
4. **Report bugs** - If you find any issues, let us know

## Important information

- **QR code usage**: The DRIVER scans the LOCATION QR code, NOT the other way around!
- **Test data**: Use the provided test login credentials
- **Bugs**: If you find a bug, report it using the "Report a bug" button
        `,
      },
    },
    system: {
      hu: {
        title: 'Rendszer leírás',
        content: `
## Mi a vSys?

A vSys Wash egy modern, felhő alapú platform kamion- és autómosó hálózatok kezelésére.

## Portálok

### 1. Sofőr Alkalmazás (PWA)
- Mobilra optimalizált webalkalmazás
- QR kódos mosás indítás
- Járművek kezelése

### 2. Operátor Portál
- Helyszíni dolgozók felülete
- **Manuális** mosás rögzítés (NEM QR kód!)
- Napi műveletek kezelése

### 3. Network Admin
- Hálózat adminisztráció
- Helyszínek, sofőrök, partnerek kezelése
- Statisztikák és riportok

### 4. Partner Portál
- Flotta cégek felülete
- Sofőrök és számlák kezelése

## QR Kód Folyamat (FONTOS!)

**Helyes folyamat:**
1. A HELYSZÍNNEK (mosónak) van QR kódja
2. A SOFŐR a telefonjával beolvassa a helyszín QR kódját
3. Ez azonosítja a helyszínt és elindítja a mosás folyamatot

**Mi NEM történik:**
- Az operátor NEM szkennel QR kódot
- A sofőrnek NINCS QR kódja
        `,
      },
      en: {
        title: 'System Description',
        content: `
## What is vSys?

vSys Wash is a modern, cloud-based platform for managing truck and car wash networks.

## Portals

### 1. Driver App (PWA)
- Mobile-optimized web application
- QR code wash initiation
- Vehicle management

### 2. Operator Portal
- Interface for on-site workers
- **Manual** wash recording (NOT QR code!)
- Daily operations management

### 3. Network Admin
- Network administration
- Locations, drivers, partners management
- Statistics and reports

### 4. Partner Portal
- Interface for fleet companies
- Drivers and invoices management

## QR Code Process (IMPORTANT!)

**Correct process:**
1. The LOCATION (wash station) has a QR code
2. The DRIVER scans the location QR code with their phone
3. This identifies the location and starts the wash process

**What does NOT happen:**
- The operator does NOT scan a QR code
- The driver does NOT have a QR code
        `,
      },
    },
    faq: {
      hu: {
        title: 'Gyakori kérdések',
        content: `
## Gyakori kérdések

### Mit tegyek, ha nem tudok bejelentkezni?
Ellenőrizd, hogy a helyes email címet és jelszót használod-e. Ha továbbra sem működik, vedd fel a kapcsolatot az adminisztrátorral.

### Hogyan jelenthetek hibát?
Használd a "Hiba bejelentése" gombot a dashboard-on vagy bármelyik fázis oldalon.

### Mi történik, ha kihagyok egy fázist?
A fázisokat sorrendben kell teljesíteni. Nem hagyhatod ki őket.

### Mennyi ideig tart a teljes tesztelés?
Körülbelül ${TOTAL_ESTIMATED_MINUTES} perc, de ez függ a részletességedtől.

### Ki látja a visszajelzéseimet?
Csak az adminisztrátorok látják a visszajelzéseket. Az adataidat bizalmasan kezeljük.

### Mi a jutalom a tesztelésért?
A tesztelés befejezése után egy tanúsítványt kapsz, és hamarosan értesítünk egy meglepetésről!
        `,
      },
      en: {
        title: 'FAQ',
        content: `
## Frequently Asked Questions

### What should I do if I can't log in?
Check that you're using the correct email and password. If it still doesn't work, contact the administrator.

### How can I report a bug?
Use the "Report a bug" button on the dashboard or any phase page.

### What happens if I skip a phase?
Phases must be completed in order. You cannot skip them.

### How long does the full testing take?
Approximately ${TOTAL_ESTIMATED_MINUTES} minutes, but it depends on your thoroughness.

### Who sees my feedback?
Only administrators can see the feedback. Your data is handled confidentially.

### What is the reward for testing?
After completing the testing, you'll receive a certificate, and we'll notify you about a surprise soon!
        `,
      },
    },
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push(session ? '/test-portal/dashboard' : '/test-portal')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {t('common.back', lang)}
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setLang('hu')}
                className={`px-3 py-1 rounded text-sm ${
                  lang === 'hu' ? 'bg-primary-100 text-primary-700' : 'text-gray-500'
                }`}
              >
                HU
              </button>
              <button
                onClick={() => setLang('en')}
                className={`px-3 py-1 rounded text-sm ${
                  lang === 'en' ? 'bg-primary-100 text-primary-700' : 'text-gray-500'
                }`}
              >
                EN
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">
          {t('docs.title', lang)}
        </h1>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar */}
          <div className="w-full md:w-48 flex-shrink-0">
            <div className="bg-white rounded-xl shadow-sm p-4">
              <nav className="space-y-1">
                {(['overview', 'system', 'phases', 'faq'] as const).map((section) => (
                  <button
                    key={section}
                    onClick={() => setActiveSection(section)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      activeSection === section
                        ? 'bg-primary-100 text-primary-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {section === 'overview' && t('docs.overview', lang)}
                    {section === 'system' && t('docs.systemDescription', lang)}
                    {section === 'phases' && t('docs.testCases', lang)}
                    {section === 'faq' && t('docs.faq', lang)}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1">
            <div className="bg-white rounded-xl shadow-sm p-6">
              {activeSection === 'phases' ? (
                // Special rendering for phases
                <div>
                  <h2 className="text-xl font-bold text-gray-800 mb-6">
                    {t('docs.testCases', lang)}
                  </h2>
                  <div className="space-y-6">
                    {TEST_PHASES.map((phase) => (
                      <div key={phase.id} className="border-b pb-6 last:border-b-0">
                        <h3 className="font-semibold text-gray-800 mb-2">
                          {phase.id}. {getLocalizedText(phase.titleHu, phase.titleEn, lang)}
                        </h3>
                        <p className="text-gray-600 mb-3">
                          {getLocalizedText(phase.descriptionHu, phase.descriptionEn, lang)}
                        </p>
                        <div className="text-sm text-gray-500">
                          <span>~{phase.estimatedMinutes} {t('common.minutes', lang)}</span>
                          <span className="mx-2">•</span>
                          <span>{phase.feedbackQuestions.length} {lang === 'hu' ? 'kérdés' : 'questions'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                // Markdown-like content
                <div className="prose prose-primary max-w-none">
                  <div
                    dangerouslySetInnerHTML={{
                      __html: (content[activeSection]?.[lang]?.content || '')
                        .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-gray-800 mt-6 mb-3">$1</h2>')
                        .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-gray-700 mt-4 mb-2">$1</h3>')
                        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                        .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
                        .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4"><strong>$1.</strong> $2</li>')
                        .replace(/\n\n/g, '</p><p class="text-gray-600 mb-4">')
                        .replace(/\n/g, '<br/>')
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
