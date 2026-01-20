// Test Phases Configuration for vSys Testing Portal

import { TestPhase } from './types';

export const TEST_PHASES: TestPhase[] = [
  // Phase 1: Driver Registration & Login
  {
    id: 1,
    titleHu: 'Sofőr Regisztráció és Bejelentkezés',
    titleEn: 'Driver Registration & Login',
    descriptionHu: 'Teszteljük a sofőr alkalmazás bejelentkezési folyamatát. A sofőrök meghívókóddal vagy telefonszámmal jelentkeznek be.',
    descriptionEn: 'Test the driver app login process. Drivers log in with invitation code or phone number.',
    instructionsHu: [
      'Nyisd meg a sofőr alkalmazást a megadott linken',
      'Válaszd a "Meghívókóddal" bejelentkezést',
      'Add meg a teszt meghívó kódot és a PIN kódot (lásd alább)',
      'VAGY válaszd a "Telefonszámmal" opciót és add meg a teszt telefonszámot + PIN-t',
      'Ellenőrizd, hogy sikeresen bejelentkeztél',
      'Nézd meg a dashboard-ot és a főbb funkciókat',
    ],
    instructionsEn: [
      'Open the driver app using the provided link',
      'Select "With invitation code" login',
      'Enter the test invitation code and PIN (see below)',
      'OR select "With phone number" and enter test phone + PIN',
      'Verify that you logged in successfully',
      'Check the dashboard and main features',
    ],
    targetUrl: 'https://app.vemiax.com',
    loginInfo: {
      username: 'TESZT01',
      password: '1234',
      note: 'Meghívó kód: TESZT01, PIN: 1234 | Invitation code: TESZT01, PIN: 1234',
    },
    estimatedMinutes: 5,
    feedbackQuestions: [
      {
        id: 'p1_q1',
        type: 'YES_NO',
        questionHu: 'Sikerült bejelentkezni a meghívókóddal vagy telefonszámmal?',
        questionEn: 'Were you able to login with invitation code or phone number?',
        required: true,
      },
      {
        id: 'p1_q2',
        type: 'RATING',
        questionHu: 'Mennyire volt egyértelmű a bejelentkezési folyamat?',
        questionEn: 'How clear was the login process?',
        required: true,
        options: [
          { value: 1, labelHu: 'Nagyon zavaros', labelEn: 'Very confusing' },
          { value: 2, labelHu: 'Zavaros', labelEn: 'Confusing' },
          { value: 3, labelHu: 'Közepes', labelEn: 'Average' },
          { value: 4, labelHu: 'Egyértelmű', labelEn: 'Clear' },
          { value: 5, labelHu: 'Nagyon egyértelmű', labelEn: 'Very clear' },
        ],
      },
      {
        id: 'p1_q3',
        type: 'TEXT',
        questionHu: 'Van bármilyen észrevételed a bejelentkezéssel kapcsolatban?',
        questionEn: 'Do you have any comments about the login process?',
        required: false,
      },
    ],
  },

  // Phase 2: QR Code Scanning - Location
  {
    id: 2,
    titleHu: 'QR Kód Beolvasás - Helyszín',
    titleEn: 'QR Code Scanning - Location',
    descriptionHu: 'Teszteljük a helyszín QR kód beolvasását. A sofőr beolvassa a mosó helyszín QR kódját.',
    descriptionEn: 'Test location QR code scanning. The driver scans the wash location QR code.',
    instructionsHu: [
      'A bejelentkezett sofőr alkalmazásban kattints a "Mosás indítása" vagy "QR kód" gombra',
      'A kamera megnyílik - olvasd be a helyszín QR kódját',
      'Ha nincs kamerád, válaszd a "Kézi bevitel" opciót',
      'Add meg a helyszín kódot kézzel (pl. a helyszínen kiírt kód)',
      'Ellenőrizd, hogy a helyszín adatai megjelennek',
      'MEGJEGYZÉS: Teszteléshez használd a kézi bevitelt, ha nincs valós QR kód',
    ],
    instructionsEn: [
      'In the logged-in driver app, click "Start wash" or "QR code" button',
      'The camera will open - scan the location QR code',
      'If you don\'t have a camera, select "Manual entry"',
      'Enter the location code manually (e.g., code displayed at the location)',
      'Verify that location details are displayed',
      'NOTE: For testing, use manual entry if no real QR code is available',
    ],
    targetUrl: 'https://app.vemiax.com/wash/scan',
    loginInfo: {
      note: 'Használd a kézi bevitelt teszteléshez / Use manual entry for testing',
    },
    estimatedMinutes: 5,
    feedbackQuestions: [
      {
        id: 'p2_q1',
        type: 'YES_NO',
        questionHu: 'Sikerült beolvasni/megadni a helyszín kódot?',
        questionEn: 'Were you able to scan/enter the location code?',
        required: true,
      },
      {
        id: 'p2_q2',
        type: 'RATING',
        questionHu: 'Mennyire volt egyértelmű, hogy a sofőr olvassa be a helyszín QR kódját?',
        questionEn: 'How clear was it that the driver scans the location QR code?',
        required: true,
        options: [
          { value: 1, labelHu: 'Egyáltalán nem', labelEn: 'Not at all' },
          { value: 2, labelHu: 'Kicsit', labelEn: 'A little' },
          { value: 3, labelHu: 'Közepes', labelEn: 'Average' },
          { value: 4, labelHu: 'Elég', labelEn: 'Fairly' },
          { value: 5, labelHu: 'Teljesen', labelEn: 'Completely' },
        ],
      },
      {
        id: 'p2_q3',
        type: 'TEXT',
        questionHu: 'Mi lehetne egyértelműbb a QR kód használatával kapcsolatban?',
        questionEn: 'What could be clearer about QR code usage?',
        required: false,
      },
    ],
  },

  // Phase 3: Wash Service Selection
  {
    id: 3,
    titleHu: 'Mosási Szolgáltatás Kiválasztása',
    titleEn: 'Wash Service Selection',
    descriptionHu: 'Teszteljük a szolgáltatás kiválasztását és a mosás rögzítését.',
    descriptionEn: 'Test service selection and recording a wash.',
    instructionsHu: [
      'A helyszín kiválasztása után nézd meg az elérhető szolgáltatásokat',
      'Válassz egy szolgáltatás csomagot a listából',
      'Válaszd ki a járművedet (ha van regisztrálva) vagy add meg a rendszámot',
      'Erősítsd meg a mosás rögzítését',
      'Ellenőrizd a visszaigazolást és a mosás részleteit',
    ],
    instructionsEn: [
      'After selecting the location, view available services',
      'Select a service package from the list',
      'Select your vehicle (if registered) or enter license plate',
      'Confirm the wash recording',
      'Verify the confirmation and wash details',
    ],
    targetUrl: 'https://app.vemiax.com/wash/new',
    estimatedMinutes: 5,
    feedbackQuestions: [
      {
        id: 'p3_q1',
        type: 'YES_NO',
        questionHu: 'Sikerült elindítani a mosást?',
        questionEn: 'Were you able to start the wash?',
        required: true,
      },
      {
        id: 'p3_q2',
        type: 'RATING',
        questionHu: 'Mennyire volt egyszerű a szolgáltatás kiválasztása?',
        questionEn: 'How easy was service selection?',
        required: true,
        options: [
          { value: 1, labelHu: 'Nagyon nehéz', labelEn: 'Very difficult' },
          { value: 2, labelHu: 'Nehéz', labelEn: 'Difficult' },
          { value: 3, labelHu: 'Közepes', labelEn: 'Average' },
          { value: 4, labelHu: 'Könnyű', labelEn: 'Easy' },
          { value: 5, labelHu: 'Nagyon könnyű', labelEn: 'Very easy' },
        ],
      },
      {
        id: 'p3_q3',
        type: 'RATING',
        questionHu: 'Mennyire voltak érthetőek a szolgáltatás csomagok?',
        questionEn: 'How understandable were the service packages?',
        required: true,
        options: [
          { value: 1, labelHu: 'Egyáltalán nem', labelEn: 'Not at all' },
          { value: 2, labelHu: 'Kicsit', labelEn: 'A little' },
          { value: 3, labelHu: 'Közepesen', labelEn: 'Moderately' },
          { value: 4, labelHu: 'Érthetőek', labelEn: 'Understandable' },
          { value: 5, labelHu: 'Teljesen érthetőek', labelEn: 'Completely clear' },
        ],
      },
    ],
  },

  // Phase 4: Operator Portal - Manual Wash Entry
  {
    id: 4,
    titleHu: 'Operátor Portál - Manuális Mosás Rögzítés',
    titleEn: 'Operator Portal - Manual Wash Entry',
    descriptionHu: 'Teszteljük az operátor portált, ahol a mosó dolgozó rögzíti a mosásokat. Az operátor a helyszínen dolgozik és manuálisan viszi be az adatokat.',
    descriptionEn: 'Test the operator portal where wash workers record washes. The operator works on-site and enters data manually.',
    instructionsHu: [
      'Nyisd meg az operátor felületet (kérj hozzáférést az admintól)',
      'Az operátor látja a helyszín információit',
      'Kattints az "Új mosás" vagy hasonló gombra',
      'Add meg a jármű rendszámát',
      'Válaszd ki a szolgáltatást',
      'Rögzítsd a mosást',
      'MEGJEGYZÉS: Az operátor funkció admin hozzáférést igényel',
    ],
    instructionsEn: [
      'Open the operator interface (request access from admin)',
      'The operator sees location information',
      'Click "New wash" or similar button',
      'Enter vehicle license plate',
      'Select the service',
      'Record the wash',
      'NOTE: Operator function requires admin access',
    ],
    targetUrl: 'https://app.vemiax.com/network-admin',
    loginInfo: {
      note: 'Operátor funkció admin hozzáférést igényel / Operator function requires admin access',
    },
    estimatedMinutes: 10,
    feedbackQuestions: [
      {
        id: 'p4_q1',
        type: 'YES_NO',
        questionHu: 'Sikerült belépni az Operátor Portálra?',
        questionEn: 'Were you able to login to the Operator Portal?',
        required: true,
      },
      {
        id: 'p4_q2',
        type: 'YES_NO',
        questionHu: 'Sikerült manuálisan rögzíteni egy mosást?',
        questionEn: 'Were you able to manually record a wash?',
        required: true,
      },
      {
        id: 'p4_q3',
        type: 'RATING',
        questionHu: 'Mennyire volt egyszerű a mosás rögzítése?',
        questionEn: 'How easy was recording a wash?',
        required: true,
        options: [
          { value: 1, labelHu: 'Nagyon bonyolult', labelEn: 'Very complicated' },
          { value: 2, labelHu: 'Bonyolult', labelEn: 'Complicated' },
          { value: 3, labelHu: 'Közepes', labelEn: 'Average' },
          { value: 4, labelHu: 'Egyszerű', labelEn: 'Simple' },
          { value: 5, labelHu: 'Nagyon egyszerű', labelEn: 'Very simple' },
        ],
      },
      {
        id: 'p4_q4',
        type: 'TEXT',
        questionHu: 'Van észrevételed az operátor felülettel kapcsolatban?',
        questionEn: 'Any comments about the operator interface?',
        required: false,
      },
    ],
  },

  // Phase 5: Network Admin Portal
  {
    id: 5,
    titleHu: 'Hálózat Admin Portál',
    titleEn: 'Network Admin Portal',
    descriptionHu: 'Teszteljük a hálózat adminisztrációs portált - helyszínek, sofőrök és partnerek kezelése.',
    descriptionEn: 'Test the network administration portal - managing locations, drivers and partners.',
    instructionsHu: [
      'Nyisd meg a Network Admin portált',
      'Jelentkezz be (kérj hozzáférést az adminisztrátortól)',
      'Tekintsd meg a Dashboard-ot és a statisztikákat',
      'Nézd meg a Helyszínek listáját',
      'Ellenőrizd a Sofőrök listáját',
      'Tekintsd meg a Partner cégeket',
      'Nézd meg a Mosások áttekintését',
    ],
    instructionsEn: [
      'Open the Network Admin portal',
      'Login (request access from administrator)',
      'View the Dashboard and statistics',
      'Check the Locations list',
      'Review the Drivers list',
      'View Partner companies',
      'Check the Washes overview',
    ],
    targetUrl: 'https://app.vemiax.com/network-admin',
    loginInfo: {
      note: 'Admin hozzáférés szükséges / Admin access required',
    },
    estimatedMinutes: 15,
    feedbackQuestions: [
      {
        id: 'p5_q1',
        type: 'YES_NO',
        questionHu: 'Sikerült belépni a Network Admin portálra?',
        questionEn: 'Were you able to login to Network Admin portal?',
        required: true,
      },
      {
        id: 'p5_q2',
        type: 'RATING',
        questionHu: 'Mennyire volt átlátható a Dashboard?',
        questionEn: 'How clear was the Dashboard?',
        required: true,
        options: [
          { value: 1, labelHu: 'Zavaros', labelEn: 'Confusing' },
          { value: 2, labelHu: 'Nehezen érthető', labelEn: 'Hard to understand' },
          { value: 3, labelHu: 'Közepes', labelEn: 'Average' },
          { value: 4, labelHu: 'Átlátható', labelEn: 'Clear' },
          { value: 5, labelHu: 'Nagyon átlátható', labelEn: 'Very clear' },
        ],
      },
      {
        id: 'p5_q3',
        type: 'RATING',
        questionHu: 'Összességében hogy értékeled az admin felületet?',
        questionEn: 'Overall, how do you rate the admin interface?',
        required: true,
        options: [
          { value: 1, labelHu: 'Gyenge', labelEn: 'Poor' },
          { value: 2, labelHu: 'Elfogadható', labelEn: 'Acceptable' },
          { value: 3, labelHu: 'Közepes', labelEn: 'Average' },
          { value: 4, labelHu: 'Jó', labelEn: 'Good' },
          { value: 5, labelHu: 'Kiváló', labelEn: 'Excellent' },
        ],
      },
      {
        id: 'p5_q4',
        type: 'TEXT',
        questionHu: 'Mi tetszett és mi hiányzott az admin felületről?',
        questionEn: 'What did you like and what was missing from the admin interface?',
        required: false,
      },
    ],
  },

  // Phase 6: Partner Portal
  {
    id: 6,
    titleHu: 'Partner Portál',
    titleEn: 'Partner Portal',
    descriptionHu: 'Teszteljük a partner cég adminisztrációs felületét, ahol a flottakezelők látják a sofőrjeiket és a mosásokat.',
    descriptionEn: 'Test the partner company admin interface where fleet managers see their drivers and washes.',
    instructionsHu: [
      'Nyisd meg a Partner Portált',
      'Jelentkezz be (kérj partner hozzáférést az adminisztrátortól)',
      'Tekintsd meg a cég Dashboard-ját',
      'Nézd meg a sofőrök listáját',
      'Ellenőrizd a mosási statisztikákat',
      'Tekintsd meg a számlázási adatokat (ha vannak)',
    ],
    instructionsEn: [
      'Open the Partner Portal',
      'Login (request partner access from administrator)',
      'View the company Dashboard',
      'Check the drivers list',
      'Review wash statistics',
      'Check billing data (if any)',
    ],
    targetUrl: 'https://app.vemiax.com/partner',
    loginInfo: {
      note: 'Partner hozzáférés szükséges / Partner access required',
    },
    estimatedMinutes: 10,
    feedbackQuestions: [
      {
        id: 'p6_q1',
        type: 'YES_NO',
        questionHu: 'Sikerült belépni a Partner Portálra?',
        questionEn: 'Were you able to login to Partner Portal?',
        required: true,
      },
      {
        id: 'p6_q2',
        type: 'RATING',
        questionHu: 'Mennyire volt hasznos a partner felület?',
        questionEn: 'How useful was the partner interface?',
        required: true,
        options: [
          { value: 1, labelHu: 'Nem hasznos', labelEn: 'Not useful' },
          { value: 2, labelHu: 'Kevéssé', labelEn: 'Slightly' },
          { value: 3, labelHu: 'Közepes', labelEn: 'Average' },
          { value: 4, labelHu: 'Hasznos', labelEn: 'Useful' },
          { value: 5, labelHu: 'Nagyon hasznos', labelEn: 'Very useful' },
        ],
      },
      {
        id: 'p6_q3',
        type: 'TEXT',
        questionHu: 'Mit változtatnál a partner felületen?',
        questionEn: 'What would you change on the partner interface?',
        required: false,
      },
    ],
  },

  // Phase 7: Overall Evaluation
  {
    id: 7,
    titleHu: 'Összesített Értékelés',
    titleEn: 'Overall Evaluation',
    descriptionHu: 'Végső visszajelzés és összesített értékelés a teljes rendszerről.',
    descriptionEn: 'Final feedback and overall evaluation of the entire system.',
    instructionsHu: [
      'Gondold át az összes tesztelt funkciót',
      'Értékeld a rendszer egészét',
      'Adj részletes visszajelzést a tapasztalataidról',
      'Jelezd, ha van még hiba amit nem jelentettél',
    ],
    instructionsEn: [
      'Think about all tested features',
      'Evaluate the system as a whole',
      'Provide detailed feedback about your experience',
      'Indicate if there are bugs you haven\'t reported',
    ],
    estimatedMinutes: 10,
    feedbackQuestions: [
      {
        id: 'p7_q1',
        type: 'RATING',
        questionHu: 'Összességében hogyan értékeled a vSys platformot?',
        questionEn: 'Overall, how do you rate the vSys platform?',
        required: true,
        options: [
          { value: 1, labelHu: 'Gyenge', labelEn: 'Poor' },
          { value: 2, labelHu: 'Elfogadható', labelEn: 'Fair' },
          { value: 3, labelHu: 'Jó', labelEn: 'Good' },
          { value: 4, labelHu: 'Nagyon jó', labelEn: 'Very good' },
          { value: 5, labelHu: 'Kiváló', labelEn: 'Excellent' },
        ],
      },
      {
        id: 'p7_q2',
        type: 'RATING',
        questionHu: 'Mennyire valószínű, hogy ajánlanád másoknak?',
        questionEn: 'How likely would you recommend it to others?',
        required: true,
        options: [
          { value: 1, labelHu: 'Egyáltalán nem', labelEn: 'Not at all' },
          { value: 2, labelHu: 'Valószínűleg nem', labelEn: 'Probably not' },
          { value: 3, labelHu: 'Talán', labelEn: 'Maybe' },
          { value: 4, labelHu: 'Valószínűleg igen', labelEn: 'Probably yes' },
          { value: 5, labelHu: 'Biztosan', labelEn: 'Definitely' },
        ],
      },
      {
        id: 'p7_q3',
        type: 'TEXT',
        questionHu: 'Mi a 3 legjobb dolog a rendszerben?',
        questionEn: 'What are the 3 best things about the system?',
        required: true,
      },
      {
        id: 'p7_q4',
        type: 'TEXT',
        questionHu: 'Mi a 3 legfontosabb fejlesztési javaslat?',
        questionEn: 'What are the 3 most important improvement suggestions?',
        required: true,
      },
      {
        id: 'p7_q5',
        type: 'TEXT',
        questionHu: 'Bármilyen egyéb visszajelzés:',
        questionEn: 'Any other feedback:',
        required: false,
      },
    ],
  },
];

// Calculate total estimated time
export const TOTAL_ESTIMATED_MINUTES = TEST_PHASES.reduce(
  (sum, phase) => sum + phase.estimatedMinutes,
  0
);

// Get phase by ID
export function getPhaseById(id: number): TestPhase | undefined {
  return TEST_PHASES.find(phase => phase.id === id);
}
