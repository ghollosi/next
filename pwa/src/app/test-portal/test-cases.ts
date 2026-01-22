// Comprehensive Test Cases for vSys Platform
// Professional QA Test Suite with exact expected results

export type TestResult = 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIPPED' | 'NOT_TESTED';
export type TestPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type TestCategory = 'FUNCTIONAL' | 'VALIDATION' | 'NEGATIVE' | 'BOUNDARY' | 'SECURITY' | 'UI' | 'PERFORMANCE';

export interface TestStep {
  stepNumber: number;
  action: string;           // Exact action to perform
  testData?: string;        // Specific test data to use
  expectedResult: string;   // Exact expected outcome
  actualResult?: string;    // Filled by tester
  status?: TestResult;
  screenshot?: boolean;     // Should take screenshot if fails
}

export interface TestCase {
  id: string;               // TC-001, TC-002, etc.
  title: string;
  category: TestCategory;
  priority: TestPriority;
  preconditions: string[];  // What must be true before test
  steps: TestStep[];
  postconditions?: string[];
  notes?: string;
}

export interface TestModule {
  moduleId: string;
  moduleName: string;
  description: string;
  testCases: TestCase[];
}

// ============================================================================
// MODULE 1: DRIVER APP (SOFŐR ALKALMAZÁS)
// ============================================================================
export const DRIVER_APP_TESTS: TestModule = {
  moduleId: 'MOD-DRIVER',
  moduleName: 'Sofőr Alkalmazás',
  description: 'Sofőr PWA alkalmazás teljes tesztelése',
  testCases: [
    // ---------- LOGIN TESTS ----------
    {
      id: 'TC-DRV-001',
      title: 'Sikeres bejelentkezés email + jelszóval',
      category: 'FUNCTIONAL',
      priority: 'CRITICAL',
      preconditions: [
        'Sofőr nincs bejelentkezve',
        'Érvényes sofőr email cím és jelszó (kérd el az admintól)'
      ],
      steps: [
        {
          stepNumber: 1,
          action: 'Nyisd meg: https://app.vemiax.com/login',
          expectedResult: 'Bejelentkezési oldal megjelenik email és jelszó mezőkkel',
          screenshot: true
        },
        {
          stepNumber: 2,
          action: 'Add meg a sofőr email címét',
          testData: '[SOFŐR_EMAIL]',
          expectedResult: 'Az email megjelenik a mezőben'
        },
        {
          stepNumber: 3,
          action: 'Add meg a jelszót',
          testData: '[SOFŐR_JELSZÓ]',
          expectedResult: 'A jelszó karakterek csillagként jelennek meg'
        },
        {
          stepNumber: 4,
          action: 'Kattints "Bejelentkezés" gombra',
          expectedResult: 'Sikeres bejelentkezés, főoldal/dashboard megjelenik',
          screenshot: true
        }
      ],
      postconditions: ['Sofőr be van jelentkezve', 'Session aktív']
    },
    {
      id: 'TC-DRV-002',
      title: 'Hibás email visszautasítása',
      category: 'NEGATIVE',
      priority: 'HIGH',
      preconditions: ['Sofőr nincs bejelentkezve'],
      steps: [
        {
          stepNumber: 1,
          action: 'Nyisd meg: https://app.vemiax.com/login',
          expectedResult: 'Bejelentkezési oldal megjelenik'
        },
        {
          stepNumber: 2,
          action: 'Add meg nem létező email címet: nemletezo@teszt.hu',
          testData: 'nemletezo@teszt.hu',
          expectedResult: 'Az email megjelenik a mezőben'
        },
        {
          stepNumber: 3,
          action: 'Add meg bármilyen jelszót: teszt123',
          testData: 'teszt123',
          expectedResult: 'Jelszó megjelenik csillagokként'
        },
        {
          stepNumber: 4,
          action: 'Kattints "Bejelentkezés" gombra',
          expectedResult: 'Hibaüzenet: "Hibás email vagy jelszó" - NEM árulja el, hogy az email nem létezik',
          screenshot: true
        }
      ],
      notes: 'A rendszer NEM engedheti be hibás adatokkal'
    },
    {
      id: 'TC-DRV-003',
      title: 'Hibás jelszó visszautasítása',
      category: 'NEGATIVE',
      priority: 'HIGH',
      preconditions: ['Érvényes sofőr email cím ismert'],
      steps: [
        {
          stepNumber: 1,
          action: 'Add meg az érvényes email címet',
          testData: '[SOFŐR_EMAIL]',
          expectedResult: 'Email elfogadva'
        },
        {
          stepNumber: 2,
          action: 'Írd be hibás jelszót: rosszjelszo123',
          testData: 'rosszjelszo123',
          expectedResult: 'A jelszó megjelenik csillagokként'
        },
        {
          stepNumber: 3,
          action: 'Kattints "Bejelentkezés" gombra',
          expectedResult: 'Hibaüzenet: "Hibás email vagy jelszó". NEM lép be.',
          screenshot: true
        }
      ]
    },
    {
      id: 'TC-DRV-004',
      title: 'Üres email validáció',
      category: 'VALIDATION',
      priority: 'MEDIUM',
      preconditions: ['Bejelentkezési oldal megnyitva'],
      steps: [
        {
          stepNumber: 1,
          action: 'Hagyd üresen az email mezőt',
          testData: '(üres)',
          expectedResult: 'Mező üresen marad'
        },
        {
          stepNumber: 2,
          action: 'Add meg a jelszót és próbálj bejelentkezni',
          expectedResult: 'Validációs hiba: "Email megadása kötelező" vagy a gomb inaktív',
          screenshot: true
        }
      ]
    },
    {
      id: 'TC-DRV-005',
      title: 'Üres jelszó validáció',
      category: 'VALIDATION',
      priority: 'MEDIUM',
      preconditions: ['Bejelentkezési oldal megnyitva'],
      steps: [
        {
          stepNumber: 1,
          action: 'Add meg az email címet',
          testData: '[SOFŐR_EMAIL]',
          expectedResult: 'Email elfogadva'
        },
        {
          stepNumber: 2,
          action: 'Hagyd üresen a jelszó mezőt és próbálj bejelentkezni',
          testData: '(üres)',
          expectedResult: 'Validációs hiba: "Jelszó megadása kötelező" vagy a gomb inaktív',
          screenshot: true
        }
      ]
    },
    {
      id: 'TC-DRV-006',
      title: 'Érvénytelen email formátum validáció',
      category: 'VALIDATION',
      priority: 'MEDIUM',
      preconditions: ['Bejelentkezési oldal megnyitva'],
      steps: [
        {
          stepNumber: 1,
          action: 'Írd be: nemvalidemail',
          testData: 'nemvalidemail',
          expectedResult: 'Szöveg megjelenik'
        },
        {
          stepNumber: 2,
          action: 'Próbálj bejelentkezni',
          expectedResult: 'Validációs hiba: "Érvényes email cím szükséges" vagy hasonló',
          screenshot: true
        }
      ]
    },
    // ---------- QR/LOCATION CODE TESTS ----------
    {
      id: 'TC-DRV-010',
      title: 'Helyszín kód kézi bevitele',
      category: 'FUNCTIONAL',
      priority: 'CRITICAL',
      preconditions: ['Sofőr bejelentkezve'],
      steps: [
        {
          stepNumber: 1,
          action: 'Kattints "Mosás indítása" vagy "QR kód" gombra',
          expectedResult: 'QR olvasó vagy kód beviteli opció megjelenik'
        },
        {
          stepNumber: 2,
          action: 'Válaszd "Kézi bevitel" opciót',
          expectedResult: 'Kód beviteli mező megjelenik'
        },
        {
          stepNumber: 3,
          action: 'Írd be a helyszín kódot (kérd el az admintól)',
          testData: '[HELYSZÍN_KÓD]',
          expectedResult: 'A helyszín adatai megjelennek: név, cím, szolgáltatások',
          screenshot: true
        }
      ]
    },
    {
      id: 'TC-DRV-011',
      title: 'Nem létező helyszín kód',
      category: 'NEGATIVE',
      priority: 'HIGH',
      preconditions: ['Sofőr bejelentkezve', 'Kód beviteli módban'],
      steps: [
        {
          stepNumber: 1,
          action: 'Írd be: NEMLETEZIK999',
          testData: 'NEMLETEZIK999',
          expectedResult: 'Hibaüzenet: "Helyszín nem található" vagy hasonló',
          screenshot: true
        }
      ]
    },
    // ---------- WASH RECORDING TESTS ----------
    {
      id: 'TC-DRV-020',
      title: 'Mosás indítása szolgáltatás választással',
      category: 'FUNCTIONAL',
      priority: 'CRITICAL',
      preconditions: ['Sofőr bejelentkezve', 'Helyszín kiválasztva'],
      steps: [
        {
          stepNumber: 1,
          action: 'Ellenőrizd, hogy látszanak-e a szolgáltatások',
          expectedResult: 'Szolgáltatás lista megjelenik árakkal',
          screenshot: true
        },
        {
          stepNumber: 2,
          action: 'Válassz egy szolgáltatást (pl. "Teljes mosás")',
          expectedResult: 'Szolgáltatás kijelölve, ár megjelenik'
        },
        {
          stepNumber: 3,
          action: 'Add meg/válaszd ki a járművet',
          expectedResult: 'Jármű kiválasztva vagy rendszám megadva'
        },
        {
          stepNumber: 4,
          action: 'Kattints "Mosás indítása" vagy "Megerősítés"',
          expectedResult: 'Visszaigazolás: "Mosás rögzítve" + részletek (dátum, szolgáltatás, ár)',
          screenshot: true
        }
      ],
      postconditions: ['Mosás megjelenik az előzményekben']
    },
    {
      id: 'TC-DRV-021',
      title: 'Mosás szolgáltatás nélkül (validáció)',
      category: 'VALIDATION',
      priority: 'HIGH',
      preconditions: ['Helyszín kiválasztva'],
      steps: [
        {
          stepNumber: 1,
          action: 'NE válassz szolgáltatást',
          expectedResult: 'Nincs kijelölt szolgáltatás'
        },
        {
          stepNumber: 2,
          action: 'Próbálj mosást indítani',
          expectedResult: 'Hibaüzenet: "Válassz szolgáltatást" vagy gomb inaktív',
          screenshot: true
        }
      ]
    },
    // ---------- VEHICLE TESTS ----------
    {
      id: 'TC-DRV-030',
      title: 'Jármű hozzáadása érvényes rendszámmal',
      category: 'FUNCTIONAL',
      priority: 'HIGH',
      preconditions: ['Sofőr bejelentkezve'],
      steps: [
        {
          stepNumber: 1,
          action: 'Navigálj a Járművek/Profil menübe',
          expectedResult: 'Járművek lista megjelenik'
        },
        {
          stepNumber: 2,
          action: 'Kattints "Új jármű" vagy "+" gombra',
          expectedResult: 'Jármű hozzáadás form megjelenik'
        },
        {
          stepNumber: 3,
          action: 'Add meg: ABC-123',
          testData: 'ABC-123',
          expectedResult: 'Rendszám elfogadva'
        },
        {
          stepNumber: 4,
          action: 'Mentsd el',
          expectedResult: 'Jármű megjelenik a listában',
          screenshot: true
        }
      ]
    },
    {
      id: 'TC-DRV-031',
      title: 'Üres rendszám validáció',
      category: 'VALIDATION',
      priority: 'MEDIUM',
      preconditions: ['Jármű hozzáadás formnál'],
      steps: [
        {
          stepNumber: 1,
          action: 'Hagyd üresen a rendszám mezőt',
          testData: '(üres)',
          expectedResult: 'Validációs hiba megjelenik'
        },
        {
          stepNumber: 2,
          action: 'Próbáld menteni',
          expectedResult: 'NEM ment, hibaüzenet látható',
          screenshot: true
        }
      ]
    },
    // ---------- HISTORY TESTS ----------
    {
      id: 'TC-DRV-040',
      title: 'Mosási előzmények megjelenítése',
      category: 'FUNCTIONAL',
      priority: 'HIGH',
      preconditions: ['Sofőr bejelentkezve', 'Van legalább 1 korábbi mosás'],
      steps: [
        {
          stepNumber: 1,
          action: 'Navigálj az "Előzmények" vagy "Mosások" menübe',
          expectedResult: 'Mosások listája megjelenik'
        },
        {
          stepNumber: 2,
          action: 'Ellenőrizd egy mosás adatait',
          expectedResult: 'Látható: dátum, helyszín, szolgáltatás, ár',
          screenshot: true
        }
      ]
    },
    // ---------- LOGOUT TESTS ----------
    {
      id: 'TC-DRV-050',
      title: 'Kijelentkezés',
      category: 'FUNCTIONAL',
      priority: 'HIGH',
      preconditions: ['Sofőr bejelentkezve'],
      steps: [
        {
          stepNumber: 1,
          action: 'Keresd meg a Kijelentkezés opciót (profil/menü)',
          expectedResult: 'Kijelentkezés gomb/link megtalálható'
        },
        {
          stepNumber: 2,
          action: 'Kattints a Kijelentkezés gombra',
          expectedResult: 'Visszakerülsz a bejelentkezési oldalra',
          screenshot: true
        },
        {
          stepNumber: 3,
          action: 'Próbálj vissza navigálni a dashboardra (URL-ből)',
          expectedResult: 'Átirányít a loginra, NEM engedi belépni'
        }
      ]
    }
  ]
};

// ============================================================================
// MODULE 2: OPERATOR PORTAL
// ============================================================================
export const OPERATOR_PORTAL_TESTS: TestModule = {
  moduleId: 'MOD-OPERATOR',
  moduleName: 'Operátor Portál',
  description: 'Mosóhelyszín operátor felületének tesztelése',
  testCases: [
    {
      id: 'TC-OPR-001',
      title: 'Operátor bejelentkezés email + jelszóval',
      category: 'FUNCTIONAL',
      priority: 'CRITICAL',
      preconditions: ['Érvényes operátor email cím és jelszó (kérd el a Network Admintól)'],
      steps: [
        {
          stepNumber: 1,
          action: 'Nyisd meg: https://app.vemiax.com/operator-portal/login',
          expectedResult: 'Operátor bejelentkezési oldal megjelenik email és jelszó mezőkkel',
          screenshot: true
        },
        {
          stepNumber: 2,
          action: 'Add meg az operátor email címét',
          testData: '[OPERÁTOR_EMAIL]',
          expectedResult: 'Email elfogadva'
        },
        {
          stepNumber: 3,
          action: 'Add meg a jelszót',
          testData: '[OPERÁTOR_JELSZÓ]',
          expectedResult: 'Jelszó elfogadva (csillagokként jelenik meg)'
        },
        {
          stepNumber: 4,
          action: 'Kattints Bejelentkezés',
          expectedResult: 'Operátor dashboard megjelenik, helyszín információval',
          screenshot: true
        }
      ]
    },
    {
      id: 'TC-OPR-002',
      title: 'Hibás operátor jelszó',
      category: 'NEGATIVE',
      priority: 'HIGH',
      preconditions: ['Érvényes operátor email cím'],
      steps: [
        {
          stepNumber: 1,
          action: 'Add meg helyes email címet',
          testData: '[OPERÁTOR_EMAIL]',
          expectedResult: 'Email elfogadva'
        },
        {
          stepNumber: 2,
          action: 'Add meg hibás jelszót: rosszjelszo',
          testData: 'rosszjelszo',
          expectedResult: 'Jelszó megjelenik csillagokként'
        },
        {
          stepNumber: 3,
          action: 'Kattints Bejelentkezés',
          expectedResult: 'Hibaüzenet: "Hibás email vagy jelszó"',
          screenshot: true
        }
      ]
    },
    {
      id: 'TC-OPR-010',
      title: 'Manuális mosás rögzítés',
      category: 'FUNCTIONAL',
      priority: 'CRITICAL',
      preconditions: ['Operátor bejelentkezve'],
      steps: [
        {
          stepNumber: 1,
          action: 'Kattints "Új mosás" vagy "Mosás rögzítése" gombra',
          expectedResult: 'Mosás rögzítő form megjelenik',
          screenshot: true
        },
        {
          stepNumber: 2,
          action: 'Add meg a rendszámot: TEST-001',
          testData: 'TEST-001',
          expectedResult: 'Rendszám mező kitöltve'
        },
        {
          stepNumber: 3,
          action: 'Válassz szolgáltatást',
          expectedResult: 'Szolgáltatás kijelölve, ár látható'
        },
        {
          stepNumber: 4,
          action: 'Rögzítsd a mosást',
          expectedResult: 'Sikeres visszaigazolás, mosás megjelenik a listában',
          screenshot: true
        }
      ]
    },
    {
      id: 'TC-OPR-011',
      title: 'Mosás rendszám nélkül',
      category: 'VALIDATION',
      priority: 'HIGH',
      preconditions: ['Operátor bejelentkezve', 'Mosás form nyitva'],
      steps: [
        {
          stepNumber: 1,
          action: 'Hagyd üresen a rendszám mezőt',
          testData: '(üres)',
          expectedResult: 'Mező üresen marad'
        },
        {
          stepNumber: 2,
          action: 'Próbáld rögzíteni',
          expectedResult: 'Hibaüzenet: "Rendszám kötelező" vagy gomb inaktív',
          screenshot: true
        }
      ]
    },
    {
      id: 'TC-OPR-020',
      title: 'Mai mosások listája',
      category: 'FUNCTIONAL',
      priority: 'HIGH',
      preconditions: ['Operátor bejelentkezve', 'Van mai mosás'],
      steps: [
        {
          stepNumber: 1,
          action: 'Nézd meg a napi összesítőt/listát',
          expectedResult: 'Mai mosások száma és listája látható',
          screenshot: true
        },
        {
          stepNumber: 2,
          action: 'Ellenőrizd egy mosás részleteit',
          expectedResult: 'Rendszám, szolgáltatás, időpont, ár látható'
        }
      ]
    },
    {
      id: 'TC-OPR-030',
      title: 'Naptár/Foglalások megtekintése',
      category: 'FUNCTIONAL',
      priority: 'MEDIUM',
      preconditions: ['Operátor bejelentkezve'],
      steps: [
        {
          stepNumber: 1,
          action: 'Navigálj a Naptár/Foglalások menübe',
          expectedResult: 'Naptár vagy foglalások lista megjelenik',
          screenshot: true
        },
        {
          stepNumber: 2,
          action: 'Ellenőrizd, hogy láthatók-e a mai foglalások',
          expectedResult: 'Mai foglalások listája (ha vannak) vagy üres állapot'
        }
      ]
    }
  ]
};

// ============================================================================
// MODULE 3: PARTNER PORTAL
// ============================================================================
export const PARTNER_PORTAL_TESTS: TestModule = {
  moduleId: 'MOD-PARTNER',
  moduleName: 'Partner Portál',
  description: 'Partner cég (flotta) felületének tesztelése',
  testCases: [
    {
      id: 'TC-PTR-001',
      title: 'Partner Admin bejelentkezés email + jelszóval',
      category: 'FUNCTIONAL',
      priority: 'CRITICAL',
      preconditions: ['Érvényes partner admin email cím és jelszó (kérd el a Network Admintól)'],
      steps: [
        {
          stepNumber: 1,
          action: 'Nyisd meg: https://app.vemiax.com/partner/login',
          expectedResult: 'Partner bejelentkezési oldal email és jelszó mezőkkel',
          screenshot: true
        },
        {
          stepNumber: 2,
          action: 'Add meg a partner admin email címét',
          testData: '[PARTNER_ADMIN_EMAIL]',
          expectedResult: 'Email elfogadva'
        },
        {
          stepNumber: 3,
          action: 'Add meg a jelszót',
          testData: '[PARTNER_ADMIN_JELSZÓ]',
          expectedResult: 'Jelszó elfogadva (csillagokként jelenik meg)'
        },
        {
          stepNumber: 4,
          action: 'Kattints Bejelentkezés',
          expectedResult: 'Sikeres bejelentkezés, partner dashboard megjelenik',
          screenshot: true
        }
      ]
    },
    {
      id: 'TC-PTR-002',
      title: 'Hibás partner admin email',
      category: 'NEGATIVE',
      priority: 'HIGH',
      preconditions: [],
      steps: [
        {
          stepNumber: 1,
          action: 'Add meg nem létező email címet: nemletezo@partner.hu',
          testData: 'nemletezo@partner.hu',
          expectedResult: 'Email elfogadva'
        },
        {
          stepNumber: 2,
          action: 'Add meg bármilyen jelszót',
          testData: 'teszt123',
          expectedResult: 'Jelszó megjelenik csillagokként'
        },
        {
          stepNumber: 3,
          action: 'Kattints Bejelentkezés',
          expectedResult: 'Hibaüzenet: "Hibás email vagy jelszó"',
          screenshot: true
        }
      ]
    },
    {
      id: 'TC-PTR-003',
      title: 'Hibás partner admin jelszó',
      category: 'NEGATIVE',
      priority: 'HIGH',
      preconditions: ['Érvényes partner admin email cím'],
      steps: [
        {
          stepNumber: 1,
          action: 'Add meg az érvényes email címet',
          testData: '[PARTNER_ADMIN_EMAIL]',
          expectedResult: 'Email elfogadva'
        },
        {
          stepNumber: 2,
          action: 'Add meg hibás jelszót: rosszjelszo',
          testData: 'rosszjelszo',
          expectedResult: 'Jelszó megjelenik csillagokként'
        },
        {
          stepNumber: 3,
          action: 'Kattints Bejelentkezés',
          expectedResult: 'Hibaüzenet: "Hibás email vagy jelszó"',
          screenshot: true
        }
      ]
    },
    {
      id: 'TC-PTR-010',
      title: 'Sofőrök listázása',
      category: 'FUNCTIONAL',
      priority: 'HIGH',
      preconditions: ['Partner bejelentkezve'],
      steps: [
        {
          stepNumber: 1,
          action: 'Navigálj a Sofőrök menübe',
          expectedResult: 'Sofőrök listája megjelenik',
          screenshot: true
        },
        {
          stepNumber: 2,
          action: 'Ellenőrizd egy sofőr adatait',
          expectedResult: 'Név, státusz látható'
        }
      ]
    },
    {
      id: 'TC-PTR-020',
      title: 'Mosási statisztikák megtekintése',
      category: 'FUNCTIONAL',
      priority: 'HIGH',
      preconditions: ['Partner bejelentkezve'],
      steps: [
        {
          stepNumber: 1,
          action: 'Nézd meg a dashboard-ot vagy statisztikák menüt',
          expectedResult: 'Összesített mosások száma, költség látható',
          screenshot: true
        }
      ]
    },
    {
      id: 'TC-PTR-030',
      title: 'Számlák megtekintése',
      category: 'FUNCTIONAL',
      priority: 'HIGH',
      preconditions: ['Partner bejelentkezve', 'Van számla'],
      steps: [
        {
          stepNumber: 1,
          action: 'Navigálj a Számlák menübe',
          expectedResult: 'Számlák listája megjelenik',
          screenshot: true
        },
        {
          stepNumber: 2,
          action: 'Nyiss meg egy számlát',
          expectedResult: 'Számla részletek: dátum, összeg, státusz'
        }
      ]
    }
  ]
};

// ============================================================================
// MODULE 4: NETWORK ADMIN
// ============================================================================
export const NETWORK_ADMIN_TESTS: TestModule = {
  moduleId: 'MOD-NETADMIN',
  moduleName: 'Network Admin',
  description: 'Hálózat adminisztrátor felület tesztelése',
  testCases: [
    {
      id: 'TC-ADM-001',
      title: 'Admin bejelentkezés email + jelszó',
      category: 'FUNCTIONAL',
      priority: 'CRITICAL',
      preconditions: ['Érvényes admin email és jelszó'],
      steps: [
        {
          stepNumber: 1,
          action: 'Nyisd meg: https://app.vemiax.com/network-admin/login',
          expectedResult: 'Admin login oldal',
          screenshot: true
        },
        {
          stepNumber: 2,
          action: 'Add meg az email címet',
          testData: '[ADMIN_EMAIL]',
          expectedResult: 'Email elfogadva'
        },
        {
          stepNumber: 3,
          action: 'Add meg a jelszót',
          testData: '[ADMIN_JELSZÓ]',
          expectedResult: 'Sikeres belépés, dashboard megjelenik',
          screenshot: true
        }
      ]
    },
    {
      id: 'TC-ADM-002',
      title: 'Hibás admin jelszó',
      category: 'NEGATIVE',
      priority: 'HIGH',
      preconditions: ['Érvényes admin email'],
      steps: [
        {
          stepNumber: 1,
          action: 'Add meg helyes emailt, de hibás jelszót: wrongpassword',
          testData: 'wrongpassword',
          expectedResult: 'Hibaüzenet: "Hibás email vagy jelszó"',
          screenshot: true
        }
      ]
    },
    {
      id: 'TC-ADM-003',
      title: 'Nem létező email',
      category: 'NEGATIVE',
      priority: 'MEDIUM',
      preconditions: [],
      steps: [
        {
          stepNumber: 1,
          action: 'Add meg: nemletezo@test.com',
          testData: 'nemletezo@test.com',
          expectedResult: 'Hibaüzenet (ne árulja el, hogy az email nem létezik - biztonsági ok)',
          screenshot: true
        }
      ]
    },
    {
      id: 'TC-ADM-010',
      title: 'Dashboard adatok megjelenése',
      category: 'FUNCTIONAL',
      priority: 'HIGH',
      preconditions: ['Admin bejelentkezve'],
      steps: [
        {
          stepNumber: 1,
          action: 'Ellenőrizd a dashboard statisztikákat',
          expectedResult: 'Látható: mai mosások, havi összesítő, bevétel',
          screenshot: true
        }
      ]
    },
    {
      id: 'TC-ADM-020',
      title: 'Helyszínek listázása',
      category: 'FUNCTIONAL',
      priority: 'HIGH',
      preconditions: ['Admin bejelentkezve'],
      steps: [
        {
          stepNumber: 1,
          action: 'Navigálj a Helyszínek menübe',
          expectedResult: 'Helyszínek listája megjelenik',
          screenshot: true
        },
        {
          stepNumber: 2,
          action: 'Kattints egy helyszínre',
          expectedResult: 'Helyszín részletek: név, cím, szolgáltatások, QR kód'
        }
      ]
    },
    {
      id: 'TC-ADM-021',
      title: 'Új helyszín létrehozása',
      category: 'FUNCTIONAL',
      priority: 'HIGH',
      preconditions: ['Admin bejelentkezve'],
      steps: [
        {
          stepNumber: 1,
          action: 'Kattints "Új helyszín" gombra',
          expectedResult: 'Helyszín létrehozó form megjelenik'
        },
        {
          stepNumber: 2,
          action: 'Töltsd ki: Név="Teszt Mosó", Cím="1234 Budapest, Teszt u. 1"',
          testData: 'Név: Teszt Mosó, Cím: 1234 Budapest, Teszt u. 1',
          expectedResult: 'Mezők kitöltve'
        },
        {
          stepNumber: 3,
          action: 'Mentsd el',
          expectedResult: 'Helyszín létrehozva, megjelenik a listában',
          screenshot: true
        }
      ]
    },
    {
      id: 'TC-ADM-022',
      title: 'Helyszín létrehozás kötelező mezők nélkül',
      category: 'VALIDATION',
      priority: 'MEDIUM',
      preconditions: ['Helyszín form nyitva'],
      steps: [
        {
          stepNumber: 1,
          action: 'Hagyd üresen a Név mezőt',
          testData: '(üres)',
          expectedResult: 'Validációs hiba a mentésnél',
          screenshot: true
        }
      ]
    },
    {
      id: 'TC-ADM-030',
      title: 'Sofőrök listázása és szűrése',
      category: 'FUNCTIONAL',
      priority: 'HIGH',
      preconditions: ['Admin bejelentkezve', 'Vannak sofőrök'],
      steps: [
        {
          stepNumber: 1,
          action: 'Navigálj a Sofőrök menübe',
          expectedResult: 'Sofőrök listája megjelenik',
          screenshot: true
        },
        {
          stepNumber: 2,
          action: 'Használd a keresőt/szűrőt',
          expectedResult: 'Lista frissül a szűrési feltételek alapján'
        }
      ]
    },
    {
      id: 'TC-ADM-031',
      title: 'Sofőr jóváhagyása',
      category: 'FUNCTIONAL',
      priority: 'HIGH',
      preconditions: ['Van függőben lévő sofőr regisztráció'],
      steps: [
        {
          stepNumber: 1,
          action: 'Keresd meg a függőben lévő sofőrt',
          expectedResult: 'Sofőr "Függőben" státusszal látható'
        },
        {
          stepNumber: 2,
          action: 'Kattints "Jóváhagyás" gombra',
          expectedResult: 'Sofőr státusza "Aktív"-ra változik',
          screenshot: true
        }
      ]
    },
    {
      id: 'TC-ADM-040',
      title: 'Partnerek listázása',
      category: 'FUNCTIONAL',
      priority: 'HIGH',
      preconditions: ['Admin bejelentkezve'],
      steps: [
        {
          stepNumber: 1,
          action: 'Navigálj a Partnerek menübe',
          expectedResult: 'Partner cégek listája',
          screenshot: true
        },
        {
          stepNumber: 2,
          action: 'Nyiss meg egy partnert',
          expectedResult: 'Partner részletek: név, kontakt, sofőrök száma'
        }
      ]
    },
    {
      id: 'TC-ADM-050',
      title: 'Mosások áttekintése',
      category: 'FUNCTIONAL',
      priority: 'HIGH',
      preconditions: ['Admin bejelentkezve', 'Vannak mosások'],
      steps: [
        {
          stepNumber: 1,
          action: 'Navigálj a Mosások menübe',
          expectedResult: 'Mosások listája dátum szerint',
          screenshot: true
        },
        {
          stepNumber: 2,
          action: 'Szűrj dátumra vagy helyszínre',
          expectedResult: 'Lista a szűrt eredményekkel'
        }
      ]
    },
    {
      id: 'TC-ADM-060',
      title: 'Beállítások módosítása',
      category: 'FUNCTIONAL',
      priority: 'MEDIUM',
      preconditions: ['Admin bejelentkezve'],
      steps: [
        {
          stepNumber: 1,
          action: 'Navigálj a Beállítások menübe',
          expectedResult: 'Beállítások oldal megjelenik',
          screenshot: true
        },
        {
          stepNumber: 2,
          action: 'Módosíts egy beállítást és mentsd el',
          expectedResult: 'Sikeres mentés visszajelzés'
        }
      ]
    }
  ]
};

// ============================================================================
// MODULE 5: CROSS-FUNCTIONAL TESTS
// ============================================================================
export const CROSS_FUNCTIONAL_TESTS: TestModule = {
  moduleId: 'MOD-CROSS',
  moduleName: 'Keresztfunkcionális Tesztek',
  description: 'Több modul együttműködésének tesztelése',
  testCases: [
    {
      id: 'TC-CRS-001',
      title: 'Sofőr mosás megjelenik admin felületen',
      category: 'FUNCTIONAL',
      priority: 'CRITICAL',
      preconditions: ['Sofőr és Admin bejelentkezve külön böngészőben'],
      steps: [
        {
          stepNumber: 1,
          action: 'Sofőr: Rögzíts egy mosást',
          expectedResult: 'Mosás sikeres'
        },
        {
          stepNumber: 2,
          action: 'Admin: Frissítsd a mosások listát',
          expectedResult: 'Az új mosás megjelenik a listában 1 percen belül',
          screenshot: true
        }
      ]
    },
    {
      id: 'TC-CRS-002',
      title: 'Operátor mosás megjelenik partner felületen',
      category: 'FUNCTIONAL',
      priority: 'CRITICAL',
      preconditions: ['Operátor és Partner bejelentkezve'],
      steps: [
        {
          stepNumber: 1,
          action: 'Operátor: Rögzíts mosást a partner egyik járművére',
          testData: 'Rendszám a partner flottájából',
          expectedResult: 'Mosás rögzítve'
        },
        {
          stepNumber: 2,
          action: 'Partner: Ellenőrizd a statisztikákat',
          expectedResult: 'Új mosás látható a partner felületén',
          screenshot: true
        }
      ]
    },
    {
      id: 'TC-CRS-003',
      title: 'Admin által létrehozott helyszín elérhető sofőrnek',
      category: 'FUNCTIONAL',
      priority: 'HIGH',
      preconditions: ['Admin létrehozott egy új helyszínt'],
      steps: [
        {
          stepNumber: 1,
          action: 'Admin: Jegyezd fel az új helyszín kódját',
          expectedResult: 'Helyszín kód rendelkezésre áll'
        },
        {
          stepNumber: 2,
          action: 'Sofőr: Próbáld beolvasni/beírni a kódot',
          expectedResult: 'Helyszín felismerve, szolgáltatások megjelennek',
          screenshot: true
        }
      ]
    }
  ]
};

// ============================================================================
// MODULE 6: SECURITY TESTS
// ============================================================================
export const SECURITY_TESTS: TestModule = {
  moduleId: 'MOD-SECURITY',
  moduleName: 'Biztonsági Tesztek',
  description: 'Alapvető biztonsági ellenőrzések',
  testCases: [
    {
      id: 'TC-SEC-001',
      title: 'Session lejárat ellenőrzése',
      category: 'SECURITY',
      priority: 'HIGH',
      preconditions: ['Bejelentkezve bármely portálba'],
      steps: [
        {
          stepNumber: 1,
          action: 'Jelentkezz be, majd várj 30+ percet inaktívan',
          expectedResult: 'Session lejár, újra be kell jelentkezni'
        }
      ],
      notes: 'Ha nincs automatikus kijelentkezés, az biztonsági kockázat'
    },
    {
      id: 'TC-SEC-002',
      title: 'Közvetlen URL hozzáférés védelem',
      category: 'SECURITY',
      priority: 'HIGH',
      preconditions: ['NEM vagy bejelentkezve'],
      steps: [
        {
          stepNumber: 1,
          action: 'Próbáld megnyitni közvetlenül: https://app.vemiax.com/network-admin/dashboard',
          expectedResult: 'Átirányít a login oldalra, NEM engedi be',
          screenshot: true
        }
      ]
    },
    {
      id: 'TC-SEC-003',
      title: 'SQL Injection alapvető teszt',
      category: 'SECURITY',
      priority: 'CRITICAL',
      preconditions: ['Login oldal'],
      steps: [
        {
          stepNumber: 1,
          action: 'Email mezőbe írd: \' OR \'1\'=\'1',
          testData: "' OR '1'='1",
          expectedResult: 'NEM enged be, normál hibaüzenet',
          screenshot: true
        }
      ],
      notes: 'Ha beenged, KRITIKUS biztonsági hiba!'
    },
    {
      id: 'TC-SEC-004',
      title: 'XSS alapvető teszt',
      category: 'SECURITY',
      priority: 'HIGH',
      preconditions: ['Bármely beviteli mező'],
      steps: [
        {
          stepNumber: 1,
          action: 'Bármely szöveges mezőbe írd: <script>alert("xss")</script>',
          testData: '<script>alert("xss")</script>',
          expectedResult: 'NEM fut le a script, escaped-ként jelenik meg vagy elutasítva',
          screenshot: true
        }
      ],
      notes: 'Ha popup jelenik meg, XSS sebezhetőség!'
    }
  ]
};

// ============================================================================
// MODULE 7: UI/UX TESTS
// ============================================================================
export const UI_UX_TESTS: TestModule = {
  moduleId: 'MOD-UI',
  moduleName: 'UI/UX Tesztek',
  description: 'Felhasználói felület és élmény tesztelése',
  testCases: [
    {
      id: 'TC-UI-001',
      title: 'Mobil nézet ellenőrzés - Sofőr App',
      category: 'UI',
      priority: 'HIGH',
      preconditions: ['Mobil eszköz vagy böngésző mobil nézet (F12 → Toggle device)'],
      steps: [
        {
          stepNumber: 1,
          action: 'Nyisd meg mobilon: https://app.vemiax.com/login',
          expectedResult: 'Oldal megfelelően jelenik meg, gombok elérhetők',
          screenshot: true
        },
        {
          stepNumber: 2,
          action: 'Navigálj végig a főbb funkciókon',
          expectedResult: 'Minden funkció használható, nincs vízszintes görgetés'
        }
      ]
    },
    {
      id: 'TC-UI-002',
      title: 'Hibaüzenetek érthetősége',
      category: 'UI',
      priority: 'MEDIUM',
      preconditions: [],
      steps: [
        {
          stepNumber: 1,
          action: 'Idézz elő egy hibát (pl. hibás bejelentkezés)',
          expectedResult: 'Hibaüzenet érthető, magyar nyelvű',
          screenshot: true
        }
      ]
    },
    {
      id: 'TC-UI-003',
      title: 'Betöltési állapot jelzése',
      category: 'UI',
      priority: 'MEDIUM',
      preconditions: [],
      steps: [
        {
          stepNumber: 1,
          action: 'Végezz egy műveletet ami időbe telik (pl. lista betöltés)',
          expectedResult: 'Loading indikátor vagy spinner látható',
          screenshot: true
        }
      ]
    },
    {
      id: 'TC-UI-004',
      title: 'Sikeres művelet visszajelzés',
      category: 'UI',
      priority: 'MEDIUM',
      preconditions: [],
      steps: [
        {
          stepNumber: 1,
          action: 'Végezz sikeres műveletet (pl. mosás rögzítés)',
          expectedResult: 'Sikeres visszajelzés: zöld üzenet, pipa ikon, vagy hasonló',
          screenshot: true
        }
      ]
    }
  ]
};

// ============================================================================
// ALL TEST MODULES
// ============================================================================
export const ALL_TEST_MODULES: TestModule[] = [
  DRIVER_APP_TESTS,
  OPERATOR_PORTAL_TESTS,
  PARTNER_PORTAL_TESTS,
  NETWORK_ADMIN_TESTS,
  CROSS_FUNCTIONAL_TESTS,
  SECURITY_TESTS,
  UI_UX_TESTS
];

// Statistics
export const getTotalTestCases = (): number => {
  return ALL_TEST_MODULES.reduce((sum, module) => sum + module.testCases.length, 0);
};

export const getTestCasesByPriority = (priority: TestPriority): TestCase[] => {
  return ALL_TEST_MODULES.flatMap(module =>
    module.testCases.filter(tc => tc.priority === priority)
  );
};

export const getTestCasesByCategory = (category: TestCategory): TestCase[] => {
  return ALL_TEST_MODULES.flatMap(module =>
    module.testCases.filter(tc => tc.category === category)
  );
};

// Export summary
export const TEST_SUMMARY = {
  totalModules: ALL_TEST_MODULES.length,
  totalTestCases: getTotalTestCases(),
  criticalTests: getTestCasesByPriority('CRITICAL').length,
  highTests: getTestCasesByPriority('HIGH').length,
  mediumTests: getTestCasesByPriority('MEDIUM').length,
  lowTests: getTestCasesByPriority('LOW').length,
  functionalTests: getTestCasesByCategory('FUNCTIONAL').length,
  negativeTests: getTestCasesByCategory('NEGATIVE').length,
  validationTests: getTestCasesByCategory('VALIDATION').length,
  securityTests: getTestCasesByCategory('SECURITY').length,
  uiTests: getTestCasesByCategory('UI').length,
};
