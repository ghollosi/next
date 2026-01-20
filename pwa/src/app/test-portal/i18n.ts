// Internationalization for Test Portal - Hungarian and English

import { Language } from './types';

export const translations = {
  // Common
  common: {
    loading: { hu: 'Betöltés...', en: 'Loading...' },
    error: { hu: 'Hiba történt', en: 'An error occurred' },
    save: { hu: 'Mentés', en: 'Save' },
    cancel: { hu: 'Mégse', en: 'Cancel' },
    submit: { hu: 'Beküldés', en: 'Submit' },
    next: { hu: 'Következő', en: 'Next' },
    previous: { hu: 'Előző', en: 'Previous' },
    back: { hu: 'Vissza', en: 'Back' },
    yes: { hu: 'Igen', en: 'Yes' },
    no: { hu: 'Nem', en: 'No' },
    continue: { hu: 'Folytatás', en: 'Continue' },
    finish: { hu: 'Befejezés', en: 'Finish' },
    logout: { hu: 'Kijelentkezés', en: 'Logout' },
    minutes: { hu: 'perc', en: 'minutes' },
    required: { hu: 'Kötelező', en: 'Required' },
    optional: { hu: 'Opcionális', en: 'Optional' },
  },

  // Login page
  login: {
    title: { hu: 'vSys Tesztportál', en: 'vSys Test Portal' },
    subtitle: { hu: 'Bejelentkezés tesztelők számára', en: 'Login for testers' },
    email: { hu: 'Email cím', en: 'Email address' },
    password: { hu: 'Jelszó', en: 'Password' },
    loginButton: { hu: 'Bejelentkezés', en: 'Login' },
    invalidCredentials: { hu: 'Hibás email vagy jelszó', en: 'Invalid email or password' },
    welcomeMessage: {
      hu: 'Köszönjük, hogy segítesz nekünk a vSys platform tesztelésében!',
      en: 'Thank you for helping us test the vSys platform!'
    },
  },

  // Dashboard
  dashboard: {
    title: { hu: 'Tesztelési Folyamat', en: 'Testing Progress' },
    welcome: { hu: 'Üdvözlünk', en: 'Welcome' },
    progress: { hu: 'Haladás', en: 'Progress' },
    currentPhase: { hu: 'Jelenlegi fázis', en: 'Current phase' },
    completedPhases: { hu: 'Befejezett fázisok', en: 'Completed phases' },
    remainingPhases: { hu: 'Hátralévő fázisok', en: 'Remaining phases' },
    estimatedTime: { hu: 'Becsült idő', en: 'Estimated time' },
    startTesting: { hu: 'Tesztelés indítása', en: 'Start testing' },
    continueTesting: { hu: 'Tesztelés folytatása', en: 'Continue testing' },
    viewDocumentation: { hu: 'Dokumentáció megtekintése', en: 'View documentation' },
    reportBug: { hu: 'Hiba bejelentése', en: 'Report a bug' },
  },

  // Test phases
  phases: {
    notStarted: { hu: 'Még nem kezdődött', en: 'Not started' },
    inProgress: { hu: 'Folyamatban', en: 'In progress' },
    completed: { hu: 'Befejezve', en: 'Completed' },
    skipped: { hu: 'Kihagyva', en: 'Skipped' },
    instructions: { hu: 'Utasítások', en: 'Instructions' },
    loginInfo: { hu: 'Bejelentkezési adatok', en: 'Login information' },
    openTestPage: { hu: 'Tesztoldal megnyitása', en: 'Open test page' },
    markComplete: { hu: 'Fázis befejezése', en: 'Mark as complete' },
    feedback: { hu: 'Visszajelzés', en: 'Feedback' },
    feedbackRequired: { hu: 'Kérjük, adj visszajelzést a folytatáshoz', en: 'Please provide feedback to continue' },
  },

  // Feedback
  feedback: {
    title: { hu: 'Visszajelzés', en: 'Feedback' },
    ratingLabels: {
      1: { hu: 'Nagyon rossz', en: 'Very poor' },
      2: { hu: 'Rossz', en: 'Poor' },
      3: { hu: 'Közepes', en: 'Average' },
      4: { hu: 'Jó', en: 'Good' },
      5: { hu: 'Kiváló', en: 'Excellent' },
    },
    textPlaceholder: { hu: 'Írd le a tapasztalataidat...', en: 'Describe your experience...' },
    uploadScreenshot: { hu: 'Képernyőkép feltöltése', en: 'Upload screenshot' },
    thankYou: { hu: 'Köszönjük a visszajelzést!', en: 'Thank you for your feedback!' },
  },

  // Bug report
  bugReport: {
    title: { hu: 'Hiba bejelentése', en: 'Report a bug' },
    bugTitle: { hu: 'Hiba rövid leírása', en: 'Bug title' },
    description: { hu: 'Részletes leírás', en: 'Detailed description' },
    severity: { hu: 'Súlyosság', en: 'Severity' },
    severityLevels: {
      LOW: { hu: 'Alacsony - Kozmetikai hiba', en: 'Low - Cosmetic issue' },
      MEDIUM: { hu: 'Közepes - Működési hiba', en: 'Medium - Functional issue' },
      HIGH: { hu: 'Magas - Jelentős probléma', en: 'High - Significant problem' },
      CRITICAL: { hu: 'Kritikus - Használhatatlan', en: 'Critical - Unusable' },
    },
    screenshot: { hu: 'Képernyőkép (opcionális)', en: 'Screenshot (optional)' },
    submitBug: { hu: 'Hiba beküldése', en: 'Submit bug' },
    bugSubmitted: { hu: 'Hiba sikeresen bejelentve!', en: 'Bug reported successfully!' },
  },

  // Completion / Thank you
  completion: {
    title: { hu: 'Gratulálunk!', en: 'Congratulations!' },
    subtitle: { hu: 'Sikeresen befejezted a tesztelést!', en: 'You have successfully completed testing!' },
    thankYouMessage: {
      hu: 'Hálásak vagyunk, hogy időt szántál a vSys platform tesztelésére. A visszajelzésed rendkívül értékes számunkra és segít abban, hogy egy jobb terméket készítsünk.',
      en: 'We are grateful that you took the time to test the vSys platform. Your feedback is extremely valuable to us and helps us build a better product.'
    },
    stats: { hu: 'Statisztikáid', en: 'Your stats' },
    phasesCompleted: { hu: 'Befejezett fázisok', en: 'Phases completed' },
    bugsReported: { hu: 'Bejelentett hibák', en: 'Bugs reported' },
    feedbackGiven: { hu: 'Visszajelzések', en: 'Feedback given' },
    surpriseTitle: { hu: 'Meglepetés!', en: 'Surprise!' },
    surpriseMessage: {
      hu: 'Hamarosan értesíteni fogunk egy kis meglepetésről, amit készítettünk neked köszönetképpen!',
      en: 'We will soon notify you about a little surprise we have prepared for you as a thank you!'
    },
    certificate: { hu: 'Letöltheted a tesztelői tanúsítványodat', en: 'Download your tester certificate' },
    downloadCertificate: { hu: 'Tanúsítvány letöltése', en: 'Download certificate' },
  },

  // Documentation
  docs: {
    title: { hu: 'Tesztelési Dokumentáció', en: 'Testing Documentation' },
    overview: { hu: 'Áttekintés', en: 'Overview' },
    systemDescription: { hu: 'Rendszer leírás', en: 'System description' },
    testCases: { hu: 'Tesztesetek', en: 'Test cases' },
    faq: { hu: 'Gyakori kérdések', en: 'FAQ' },
  },

  // Admin
  admin: {
    title: { hu: 'Admin Panel', en: 'Admin Panel' },
    testers: { hu: 'Tesztelők', en: 'Testers' },
    addTester: { hu: 'Új tesztelő', en: 'Add tester' },
    testerName: { hu: 'Név', en: 'Name' },
    testerEmail: { hu: 'Email', en: 'Email' },
    testerLanguage: { hu: 'Nyelv', en: 'Language' },
    testerStatus: { hu: 'Státusz', en: 'Status' },
    testerProgress: { hu: 'Haladás', en: 'Progress' },
    sendInvite: { hu: 'Meghívó küldése', en: 'Send invite' },
    inviteSent: { hu: 'Meghívó elküldve!', en: 'Invite sent!' },
    deleteConfirm: { hu: 'Biztosan törölni szeretnéd ezt a tesztelőt?', en: 'Are you sure you want to delete this tester?' },
    stats: { hu: 'Statisztikák', en: 'Statistics' },
    bugs: { hu: 'Bejelentett hibák', en: 'Reported bugs' },
    feedbackResults: { hu: 'Visszajelzések', en: 'Feedback results' },
    exportData: { hu: 'Adatok exportálása', en: 'Export data' },
    maxTestersReached: { hu: 'Elérted a maximum tesztelő számot (5)', en: 'Maximum testers reached (5)' },
  },
};

// Helper function to get translation
export function t(key: string, lang: Language): string {
  const keys = key.split('.');
  let value: any = translations;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return key; // Return key if not found
    }
  }

  if (value && typeof value === 'object' && lang in value) {
    return value[lang];
  }

  return key;
}

// Helper to get phase title/description based on language
export function getLocalizedText(hu: string, en: string, lang: Language): string {
  return lang === 'hu' ? hu : en;
}
