const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, PageBreak, ShadingType, convertInchesToTwip, Header, Footer, PageNumber } = require('docx');
const fs = require('fs');
const path = require('path');

// Color scheme
const COLORS = {
  primary: '2563EB',      // Blue
  secondary: '64748B',    // Slate
  success: '16A34A',      // Green
  warning: 'EA580C',      // Orange
  danger: 'DC2626',       // Red
  dark: '1E293B',         // Dark slate
  light: 'F1F5F9',        // Light gray
  white: 'FFFFFF',
};

// Helper function to create styled heading
function createHeading(text, level) {
  const sizes = {
    1: 36,
    2: 28,
    3: 24,
    4: 20,
  };

  return new Paragraph({
    children: [
      new TextRun({
        text: text,
        bold: true,
        size: sizes[level] * 2,
        color: level === 1 ? COLORS.primary : COLORS.dark,
      }),
    ],
    heading: level === 1 ? HeadingLevel.HEADING_1 :
             level === 2 ? HeadingLevel.HEADING_2 :
             level === 3 ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_4,
    spacing: { before: level === 1 ? 400 : 300, after: 200 },
  });
}

// Helper function to create checkbox item
function createCheckboxItem(text, indent = 0) {
  return new Paragraph({
    children: [
      new TextRun({
        text: '☐ ',
        size: 22,
      }),
      new TextRun({
        text: text,
        size: 22,
      }),
    ],
    indent: { left: convertInchesToTwip(0.25 + indent * 0.25) },
    spacing: { before: 60, after: 60 },
  });
}

// Helper function to create regular paragraph
function createParagraph(text, options = {}) {
  return new Paragraph({
    children: [
      new TextRun({
        text: text,
        size: 22,
        bold: options.bold || false,
        italics: options.italic || false,
        color: options.color || COLORS.dark,
      }),
    ],
    spacing: { before: 100, after: 100 },
    alignment: options.alignment || AlignmentType.LEFT,
  });
}

// Helper function to create info box
function createInfoBox(text, type = 'info') {
  const colors = {
    info: { bg: 'E0F2FE', border: COLORS.primary },
    warning: { bg: 'FEF3C7', border: COLORS.warning },
    danger: { bg: 'FEE2E2', border: COLORS.danger },
    success: { bg: 'DCFCE7', border: COLORS.success },
  };

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: type === 'warning' ? '⚠️ FONTOS: ' :
                          type === 'danger' ? '🚨 KRITIKUS: ' :
                          type === 'success' ? '✅ ' : 'ℹ️ ',
                    bold: true,
                    size: 22,
                  }),
                  new TextRun({
                    text: text,
                    size: 22,
                  }),
                ],
                spacing: { before: 100, after: 100 },
              }),
            ],
            shading: { fill: colors[type].bg, type: ShadingType.SOLID },
            margins: { top: 100, bottom: 100, left: 150, right: 150 },
            borders: {
              left: { style: BorderStyle.SINGLE, size: 24, color: colors[type].border },
            },
          }),
        ],
      }),
    ],
    margins: { top: 200, bottom: 200 },
  });
}

// Create the main table
function createTable(headers, rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      // Header row
      new TableRow({
        children: headers.map(header =>
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: header,
                    bold: true,
                    size: 20,
                    color: COLORS.white,
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
            shading: { fill: COLORS.primary, type: ShadingType.SOLID },
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
          })
        ),
        tableHeader: true,
      }),
      // Data rows
      ...rows.map((row, index) =>
        new TableRow({
          children: row.map(cell =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: cell,
                      size: 20,
                    }),
                  ],
                }),
              ],
              shading: { fill: index % 2 === 0 ? COLORS.white : COLORS.light, type: ShadingType.SOLID },
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
            })
          ),
        })
      ),
    ],
  });
}

// Create code block
function createCodeBlock(text) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: text.split('\n').map(line =>
              new Paragraph({
                children: [
                  new TextRun({
                    text: line,
                    font: 'Courier New',
                    size: 18,
                  }),
                ],
              })
            ),
            shading: { fill: '1E293B', type: ShadingType.SOLID },
            margins: { top: 150, bottom: 150, left: 200, right: 200 },
          }),
        ],
      }),
    ],
  });
}

async function generateDocument() {
  const doc = new Document({
    styles: {
      paragraphStyles: [
        {
          id: 'Normal',
          name: 'Normal',
          run: {
            font: 'Segoe UI',
            size: 22,
          },
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            right: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1),
          },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: 'VSys Mosórendszer - Tesztelési Útmutató v1.1',
                  size: 18,
                  color: COLORS.secondary,
                }),
              ],
              alignment: AlignmentType.RIGHT,
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Oldal ',
                  size: 18,
                }),
                new TextRun({
                  children: [PageNumber.CURRENT],
                  size: 18,
                }),
                new TextRun({
                  text: ' / ',
                  size: 18,
                }),
                new TextRun({
                  children: [PageNumber.TOTAL_PAGES],
                  size: 18,
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
        }),
      },
      children: [
        // Title Page
        new Paragraph({ spacing: { before: 2000 } }),
        new Paragraph({
          children: [
            new TextRun({
              text: 'VSys Mosórendszer',
              bold: true,
              size: 72,
              color: COLORS.primary,
            }),
          ],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: 'Tesztelési Útmutató',
              bold: true,
              size: 48,
              color: COLORS.dark,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 600 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
              color: COLORS.primary,
              size: 24,
            }),
          ],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({ spacing: { before: 600 } }),
        new Paragraph({
          children: [
            new TextRun({
              text: 'Verzió: 1.1',
              size: 28,
              color: COLORS.secondary,
            }),
          ],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: 'Dátum: 2026-01-19',
              size: 28,
              color: COLORS.secondary,
            }),
          ],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: 'Alkalmazás: https://app.vemiax.com',
              size: 28,
              color: COLORS.primary,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 200 },
        }),
        new Paragraph({
          children: [new PageBreak()],
        }),

        // Table of Contents
        createHeading('Tartalomjegyzék', 1),
        createParagraph('1. Rendszer Bemutatás'),
        createParagraph('2. Tesztelési Környezet'),
        createParagraph('3. Platform Admin Tesztelés'),
        createParagraph('4. Network Admin Tesztelés'),
        createParagraph('5. Partner Portal Tesztelés'),
        createParagraph('6. Operator Portal Tesztelés'),
        createParagraph('7. Sofőr PWA Tesztelés'),
        createParagraph('8. Keresztfunkcionális Tesztek'),
        createParagraph('9. Nem-funkcionális Tesztek'),
        createParagraph('10. Hibajelentés'),
        createParagraph('11. Tesztelési Ütemterv'),
        new Paragraph({ children: [new PageBreak()] }),

        // Section 1: System Introduction
        createHeading('1. Rendszer Bemutatás', 1),

        createHeading('1.1 Mi a VSys?', 2),
        createParagraph('A VSys egy komplex, többszintű kamionmosó menedzsment rendszer, amely a következő szereplőket szolgálja ki:'),
        new Paragraph({ spacing: { before: 200 } }),

        createTable(
          ['Szereplő', 'Leírás', 'Portál'],
          [
            ['Platform Admin', 'A teljes rendszer üzemeltetője (Vemiax)', '/platform-admin'],
            ['Network Admin', 'Mosóhálózat tulajdonosa/üzemeltetője', '/network-admin'],
            ['Partner', 'Fuvarozó cég, amely sofőröket küld mosatni', '/partner'],
            ['Operator', 'Mosóállomás kezelője, aki a mosásokat végzi', '/operator-portal'],
            ['Sofőr (Driver)', 'Kamionsofőr, aki mosatni viszi a járművet', '/ (PWA főoldal)'],
          ]
        ),

        createHeading('1.2 Fő Funkciók', 2),
        createParagraph('• Mosások kezelése:'),
        createParagraph('    - QR kódos mód: A SOFŐR beolvassa a HELYSZÍN QR kódját a telefonjával'),
        createParagraph('    - Manuális mód: Az OPERÁTOR rendszám alapján rögzíti a mosást'),
        createParagraph('• Partner menedzsment: Fuvarozó cégek, sofőrök, járművek kezelése'),
        createParagraph('• Árazás: Helyszín és partner specifikus árak, kedvezmények'),
        createParagraph('• Számlázás: Automatikus számlakiállítás (Számlázz.hu, Billingo integráció)'),
        createParagraph('• Riportok: Forgalmi, pénzügyi kimutatások'),

        createHeading('1.3 QR Kód Használat - FONTOS!', 2),
        createInfoBox('A rendszerben a HELYSZÍNEKNEK (mosóállomásoknak) van QR kódja, NEM a sofőröknek!', 'danger'),
        new Paragraph({ spacing: { before: 200 } }),
        createParagraph('Helyes folyamat:', { bold: true }),
        createParagraph('1. Minden mosóhelyszínhez egyedi QR kód tartozik'),
        createParagraph('2. A QR kód ki van nyomtatva/kihelyezve a mosóhelyszínen'),
        createParagraph('3. A SOFŐR a telefonjával beolvassa a helyszín QR kódját'),
        createParagraph('4. Ez azonosítja a helyszínt és elindítja a mosás folyamatot'),
        new Paragraph({ spacing: { before: 200 } }),
        createParagraph('Mi NEM történik:', { bold: true }),
        createParagraph('• Az operátor NEM szkennel QR kódot'),
        createParagraph('• A sofőrnek NINCS QR kódja amit az operátor beolvasna'),

        new Paragraph({ children: [new PageBreak()] }),

        // Section 2: Test Environment
        createHeading('2. Tesztelési Környezet', 1),

        createHeading('2.1 Teszt Fiókok', 2),
        createTable(
          ['Szerep', 'Email', 'PIN/Jelszó', 'Megjegyzés'],
          [
            ['Platform Admin', 'platform@test.com', 'Admin123!', 'Teljes hozzáférés'],
            ['Network Admin', 'network@test.com', 'Admin123!', 'Demo hálózat admin'],
            ['Partner Admin', 'partner@test.com', '1234', 'Teszt partner'],
            ['Operator', 'operator@test.com', '1234', 'Teszt mosóhely'],
            ['Sofőr', 'driver@test.com', '1234', 'Teszt sofőr'],
          ]
        ),
        createInfoBox('A teszt fiókokat a Platform Admin hozza létre a tesztelés előtt!', 'warning'),

        createHeading('2.2 Böngésző Követelmények', 2),
        createParagraph('• Chrome (ajánlott) - legújabb verzió'),
        createParagraph('• Firefox - legújabb verzió'),
        createParagraph('• Safari - legújabb verzió'),
        createParagraph('• Edge - legújabb verzió'),

        createHeading('2.3 Mobil Tesztelés', 2),
        createParagraph('• iOS Safari (iPhone 12 vagy újabb ajánlott)'),
        createParagraph('• Android Chrome (Android 10 vagy újabb)'),
        createParagraph('• PWA telepítés tesztelése mindkét platformon'),

        new Paragraph({ children: [new PageBreak()] }),

        // Section 3: Platform Admin Testing
        createHeading('3. Platform Admin Tesztelés', 1),
        createParagraph('URL: https://app.vemiax.com/platform-admin', { bold: true }),

        createHeading('3.1 Belépés', 2),
        createCheckboxItem('Belépés helyes email/jelszóval - sikeres'),
        createCheckboxItem('Belépés hibás jelszóval - hibaüzenet megjelenik'),
        createCheckboxItem('"Elfelejtett jelszó" funkció működik'),
        createCheckboxItem('Jelszó visszaállítás email megérkezik'),
        createCheckboxItem('Új jelszó beállítása sikeres'),

        createHeading('3.2 Dashboard', 2),
        createCheckboxItem('Dashboard betöltődik hibamentesen'),
        createCheckboxItem('Statisztikák megjelennek (hálózatok száma, mosások, bevétel)'),
        createCheckboxItem('Grafikonok renderelődnek'),
        createCheckboxItem('Adatok frissíthetők'),

        createHeading('3.3 Hálózatok Kezelése', 2),
        createCheckboxItem('Hálózatok listája betöltődik'),
        createCheckboxItem('Új hálózat létrehozása'),
        createCheckboxItem('Kötelező mezők validálása működik', 1),
        createCheckboxItem('Hálózat sikeresen létrejön', 1),
        createCheckboxItem('Admin felhasználó automatikusan létrejön', 1),
        createCheckboxItem('Hálózat szerkesztése'),
        createCheckboxItem('Hálózat részletek megtekintése'),

        createHeading('3.4 Beállítások', 2),
        createCheckboxItem('Beállítások oldal betöltődik'),
        createCheckboxItem('HelpTooltip tesztelés: Minden mezőnél a kérdőjel ikonra kattintva/ráhúzva megjelenik a súgó szöveg'),
        createCheckboxItem('Platform beállítások módosíthatók'),
        createCheckboxItem('Mentés sikeres'),

        new Paragraph({ children: [new PageBreak()] }),

        // Section 4: Network Admin Testing
        createHeading('4. Network Admin Tesztelés', 1),
        createParagraph('URL: https://app.vemiax.com/network-admin', { bold: true }),

        createHeading('4.1 Belépés', 2),
        createCheckboxItem('Belépés helyes email/jelszóval'),
        createCheckboxItem('Session perzisztencia (oldal frissítés után is bejelentkezve marad)'),
        createCheckboxItem('Kijelentkezés működik'),

        createHeading('4.2 Dashboard', 2),
        createCheckboxItem('Mai mosások száma helyes'),
        createCheckboxItem('Heti/havi statisztikák'),
        createCheckboxItem('Bevételi adatok'),
        createCheckboxItem('Legutóbbi mosások listája'),

        createHeading('4.3 Helyszínek (Locations)', 2),
        createCheckboxItem('Helyszínek listája betöltődik'),
        createCheckboxItem('Új helyszín létrehozása'),
        createCheckboxItem('Név megadása (kötelező)', 1),
        createCheckboxItem('Cím megadása', 1),
        createCheckboxItem('GPS koordináták (opcionális)', 1),
        createCheckboxItem('Operátor hozzárendelése', 1),
        createCheckboxItem('Mentés sikeres', 1),
        createCheckboxItem('Helyszín szerkesztése'),
        createCheckboxItem('Helyszín részletek - QR kód megjelenik (ezt a sofőrök fogják beolvasni!)'),
        createCheckboxItem('QR kód letölthető/nyomtatható'),

        createHeading('4.4 Beállítások (Settings) - HelpTooltip tesztelés', 2),
        createInfoBox('KIEMELT TESZTELÉS: HelpTooltip funkció - Minden tab-on ellenőrizd, hogy a kérdőjel ikonok működnek!', 'warning'),

        createHeading('Cégadatok tab', 3),
        createCheckboxItem('Cégnév - tooltip megjelenik'),
        createCheckboxItem('Adószám - tooltip megjelenik'),
        createCheckboxItem('EU ÁFA szám - tooltip megjelenik'),
        createCheckboxItem('Ország - tooltip megjelenik'),
        createCheckboxItem('Cím - tooltip megjelenik'),
        createCheckboxItem('Bank neve - tooltip megjelenik'),
        createCheckboxItem('Számlaszám - tooltip megjelenik'),
        createCheckboxItem('IBAN - tooltip megjelenik'),
        createCheckboxItem('Email - tooltip megjelenik'),
        createCheckboxItem('Telefon - tooltip megjelenik'),

        createHeading('Regionális tab', 3),
        createCheckboxItem('Ország - tooltip megjelenik'),
        createCheckboxItem('Időzóna - tooltip megjelenik'),
        createCheckboxItem('Alapértelmezett pénznem - tooltip megjelenik'),
        createCheckboxItem('Nyelv - tooltip megjelenik'),

        createHeading('Számlázás tab', 3),
        createCheckboxItem('Számlázó rendszer - tooltip megjelenik'),
        createCheckboxItem('(Számlázz.hu esetén) Agent kulcs - tooltip megjelenik'),
        createCheckboxItem('(Billingo esetén) API kulcs - tooltip megjelenik'),
        createCheckboxItem('NAV felhasználónév - tooltip megjelenik'),
        createCheckboxItem('Adószám (NAV) - tooltip megjelenik'),

        createHeading('Értesítések tab', 3),
        createCheckboxItem('Email szolgáltató - tooltip megjelenik'),
        createCheckboxItem('(SMTP esetén) Minden SMTP mező - tooltip megjelenik'),
        createCheckboxItem('SMS szolgáltató - tooltip megjelenik'),
        createCheckboxItem('(Twilio esetén) Account SID - tooltip megjelenik'),
        createCheckboxItem('(Twilio esetén) Telefonszám - tooltip megjelenik'),

        createHeading('Üzleti szabályok tab', 3),
        createCheckboxItem('Fizetési módok - tooltip megjelenik'),
        createCheckboxItem('Készpénzes fizetés - tooltip megjelenik'),
        createCheckboxItem('Bankkártyás fizetés - tooltip megjelenik'),
        createCheckboxItem('Üzemanyagkártyás fizetés - tooltip megjelenik'),
        createCheckboxItem('Önálló regisztráció - tooltip megjelenik'),
        createCheckboxItem('Automatikus jóváhagyás - tooltip megjelenik'),
        createCheckboxItem('Email megerősítés - tooltip megjelenik'),
        createCheckboxItem('Telefonszám megerősítés - tooltip megjelenik'),

        new Paragraph({ children: [new PageBreak()] }),

        // Section 6: Operator Portal Testing
        createHeading('6. Operator Portal Tesztelés', 1),
        createParagraph('URL: https://app.vemiax.com/operator-portal', { bold: true }),

        createHeading('6.1 Belépés', 2),
        createCheckboxItem('Belépés PIN kóddal'),
        createCheckboxItem('Session kezelés'),
        createCheckboxItem('Kijelentkezés'),

        createHeading('6.2 Dashboard', 2),
        createCheckboxItem('Mai mosások száma'),
        createCheckboxItem('Aktív mosások'),
        createCheckboxItem('Várakozó mosások'),

        createHeading('6.3 Manuális Mosás Rögzítés', 2),
        createInfoBox('Az operátor NEM szkennel QR kódot! A mosásokat rendszám alapján rögzíti manuálisan.', 'danger'),
        createCheckboxItem('"Új mosás" / "Mosás rögzítése" gomb működik'),
        createCheckboxItem('Mosás rögzítési űrlap megjelenik'),
        createCheckboxItem('Rendszám (vontató) mező - kötelező', 1),
        createCheckboxItem('Pótkocsi rendszám mező (opcionális, kamionmosónál)', 1),
        createCheckboxItem('Ügyfél típus választás (Szerződéses / Nem szerződéses)', 1),
        createCheckboxItem('Szerződéses ügyfél esetén: Partner kiválasztás legördülő menüből'),
        createCheckboxItem('Nem szerződéses (walk-in) ügyfél esetén:'),
        createCheckboxItem('Fizetési mód választás (készpénz, kártya, üzemanyagkártya)', 1),
        createCheckboxItem('Számla kérés checkbox', 1),
        createCheckboxItem('Ha számlát kér: cégnév, adószám, email mezők', 1),
        createCheckboxItem('Járműtípus kiválasztása'),
        createCheckboxItem('Járműtípus lista megjelenik', 1),
        createCheckboxItem('Választás befolyásolja az árakat', 1),
        createCheckboxItem('Szolgáltatások kiválasztása'),
        createCheckboxItem('Szolgáltatások listája megjelenik', 1),
        createCheckboxItem('Árak megjelennek a járműtípusnak megfelelően', 1),
        createCheckboxItem('Több szolgáltatás hozzáadható', 1),
        createCheckboxItem('Szolgáltatás törölhető', 1),
        createCheckboxItem('Sofőr neve (opcionális mező)'),
        createCheckboxItem('Megjegyzés (opcionális mező)'),
        createCheckboxItem('Összesítés - Összes ár helyesen számítódik'),
        createCheckboxItem('Mosás rögzítése gomb - Sikeres rögzítés visszajelzés'),

        createHeading('6.4 Rendszám Felismerés', 2),
        createCheckboxItem('Rendszám beírásánál korábbi mosás adatok megjelennek (ha volt már ilyen rendszám)'),
        createCheckboxItem('"Átvesz" gombbal az adatok automatikusan kitöltődnek:'),
        createCheckboxItem('Partner', 1),
        createCheckboxItem('Járműtípus', 1),
        createCheckboxItem('Pótkocsi rendszám', 1),
        createCheckboxItem('Sofőr neve', 1),
        createCheckboxItem('Gyakori szolgáltatások', 1),

        new Paragraph({ children: [new PageBreak()] }),

        // Section 7: Driver PWA Testing
        createHeading('7. Sofőr PWA Tesztelés', 1),
        createParagraph('URL: https://app.vemiax.com', { bold: true }),

        createHeading('7.1 Regisztráció', 2),
        createCheckboxItem('Regisztrációs form megjelenik'),
        createCheckboxItem('QR kódos regisztráció (partner meghívó QR kód)'),
        createCheckboxItem('QR kód szkennelése', 1),
        createCheckboxItem('Partner automatikusan kitöltődik', 1),
        createCheckboxItem('Személyes adatok megadása', 1),
        createCheckboxItem('Jármű adatok megadása', 1),
        createCheckboxItem('PIN kód beállítása', 1),
        createCheckboxItem('Sikeres regisztráció', 1),
        createCheckboxItem('Manuális regisztráció (ha engedélyezett)'),

        createHeading('7.2 Belépés', 2),
        createCheckboxItem('Belépés PIN kóddal'),
        createCheckboxItem('"Emlékezz rám" funkció'),
        createCheckboxItem('Hibás PIN kezelés'),

        createHeading('7.3 Dashboard', 2),
        createCheckboxItem('Felhasználó neve megjelenik'),
        createCheckboxItem('Járművek listája'),
        createCheckboxItem('Legutóbbi mosások'),
        createCheckboxItem('"Start New Wash" / "QR Scan" gombok'),

        createHeading('7.4 Új Mosás Indítás - QR Kóddal', 2),
        createInfoBox('A sofőr a telefonjával beolvassa a HELYSZÍN QR kódját!', 'danger'),
        createCheckboxItem('"QR Scan" / "Start New Wash" gomb megnyomása'),
        createCheckboxItem('Kamera engedélykérés'),
        createCheckboxItem('Engedélykérő ablak megjelenik', 1),
        createCheckboxItem('Engedély megadása után kamera aktiválódik', 1),
        createCheckboxItem('QR kód szkennelés felület'),
        createCheckboxItem('Kamera kép látható', 1),
        createCheckboxItem('Szkennelési keret megjelenik', 1),
        createCheckboxItem('"Enter Code Manually" opció elérhető', 1),
        createCheckboxItem('Helyszín QR kód beolvasása'),
        createCheckboxItem('A mosóhely QR kódjának beolvasása', 1),
        createCheckboxItem('Helyszín azonosítása sikeres', 1),
        createCheckboxItem('Helyszín adatok megjelennek', 1),
        createCheckboxItem('Manuális kód megadás (ha QR nem működik)'),
        createCheckboxItem('Kód beviteli mező', 1),
        createCheckboxItem('"Find Location" gomb', 1),
        createCheckboxItem('Helyszín megtalálása', 1),
        createCheckboxItem('Mosás folyamat indítása'),
        createCheckboxItem('Jármű kiválasztása', 1),
        createCheckboxItem('Szolgáltatások megtekintése', 1),
        createCheckboxItem('Mosás kérés elküldése', 1),

        createHeading('7.5 PWA Funkciók', 2),
        createCheckboxItem('Telepítés - "Telepítés" prompt megjelenik'),
        createCheckboxItem('Alkalmazás telepíthető'),
        createCheckboxItem('Ikon megjelenik a kezdőképernyőn'),
        createCheckboxItem('Offline működés - Alkalmazás betöltődik offline módban'),
        createCheckboxItem('Megfelelő hibaüzenet jelenik meg'),
        createCheckboxItem('Push értesítések (ha implementált)'),

        new Paragraph({ children: [new PageBreak()] }),

        // Section 8: Cross-functional Tests
        createHeading('8. Keresztfunkcionális Tesztek', 1),

        createHeading('8.1 Teljes Mosási Folyamat - QR Kóddal', 2),
        createInfoBox('End-to-end teszt - Minden szereplővel végig kell menni!', 'warning'),
        createCheckboxItem('1. Network Admin létrehoz egy helyszínt és kinyomtatja a QR kódot'),
        createCheckboxItem('2. Sofőr regisztrál a rendszerbe (partner meghívóval vagy manuálisan)'),
        createCheckboxItem('3. Network Admin jóváhagyja a sofőrt (ha szükséges)'),
        createCheckboxItem('4. Sofőr a helyszínre érkezik és beolvassa a helyszín QR kódját a telefonjával'),
        createCheckboxItem('5. Sofőr kiválasztja a járművet és mosás típust'),
        createCheckboxItem('6. Operátor látja a beérkező mosás kérést a Dashboard-on'),
        createCheckboxItem('7. Operátor elindítja és elvégzi a mosást'),
        createCheckboxItem('8. Operátor befejezi a mosást és rögzíti a fizetést'),
        createCheckboxItem('9. Sofőr látja a befejezett mosást az előzményekben'),
        createCheckboxItem('10. Partner látja a mosást a dashboard-on'),
        createCheckboxItem('11. Network Admin látja a mosást a riportokban'),

        createHeading('8.2 Teljes Mosási Folyamat - Manuális Rögzítés', 2),
        createInfoBox('Ha a sofőr nem használ appot, az operátor manuálisan rögzíti a mosást', 'info'),
        createCheckboxItem('1. Operátor megnyitja az "Új mosás" űrlapot'),
        createCheckboxItem('2. Operátor beírja a rendszámot'),
        createCheckboxItem('3. Operátor kiválasztja a partnert (vagy walk-in ügyfél)'),
        createCheckboxItem('4. Operátor kiválasztja a szolgáltatásokat'),
        createCheckboxItem('5. Operátor rögzíti a mosást'),
        createCheckboxItem('6. Partner látja a mosást a dashboard-on'),
        createCheckboxItem('7. Network Admin látja a mosást a riportokban'),

        createHeading('8.3 Árlista Folyamat', 2),
        createCheckboxItem('1. Network Admin feltölt egy árlistát'),
        createCheckboxItem('2. Operátor indít egy mosást - helyes ár jelenik meg'),
        createCheckboxItem('3. Partner specifikus ár esetén az módosul'),

        createHeading('8.4 Számlázási Folyamat', 2),
        createCheckboxItem('1. Mosások rögzítése'),
        createCheckboxItem('2. Network Admin generál számlát'),
        createCheckboxItem('3. Partner látja a számlát'),
        createCheckboxItem('4. Számla letölthető'),

        new Paragraph({ children: [new PageBreak()] }),

        // Section 9: Non-functional Tests
        createHeading('9. Nem-funkcionális Tesztek', 1),

        createHeading('9.1 Teljesítmény', 2),
        createCheckboxItem('Oldalak betöltési ideje < 3 másodperc'),
        createCheckboxItem('Listák görgetése smooth'),
        createCheckboxItem('Képek optimalizáltak'),

        createHeading('9.2 Reszponzivitás', 2),
        createParagraph('Minden portált tesztelni kell:'),
        createCheckboxItem('Desktop (1920x1080)'),
        createCheckboxItem('Laptop (1366x768)'),
        createCheckboxItem('Tablet (768x1024)'),
        createCheckboxItem('Mobil (375x667)'),

        createHeading('9.3 Biztonság', 2),
        createCheckboxItem('Nem bejelentkezett felhasználó nem fér hozzá védett oldalakhoz'),
        createCheckboxItem('Egy portál felhasználója nem fér hozzá másik portálhoz'),
        createCheckboxItem('Session lejár inaktivitás után'),
        createCheckboxItem('Jelszavak nem jelennek meg plaintext-ben'),

        createHeading('9.4 Használhatóság', 2),
        createCheckboxItem('Hibaüzenetek érthetők'),
        createCheckboxItem('Kötelező mezők jelölve vannak'),
        createCheckboxItem('Betöltés indikátorok megjelennek'),
        createCheckboxItem('Sikeres műveletek visszajelzése'),

        new Paragraph({ children: [new PageBreak()] }),

        // Section 10: Bug Reporting
        createHeading('10. Hibajelentés', 1),

        createHeading('10.1 Hiba Bejelentés Formátum', 2),
        createParagraph('Minden hibánál dokumentáld:'),

        createCodeBlock(`## Hiba azonosító: [PORTAL]-[SZÁM]
Példa: NETADMIN-001

## Súlyosság
- [ ] Kritikus (rendszer nem használható)
- [ ] Magas (fő funkció nem működik)
- [ ] Közepes (funkció részben működik)
- [ ] Alacsony (kozmetikai hiba)

## Leírás
[Mi történt?]

## Elvárt viselkedés
[Mi lett volna a helyes?]

## Lépések a reprodukáláshoz
1. [Első lépés]
2. [Második lépés]
3. [stb.]

## Környezet
- Böngésző: [Chrome/Firefox/Safari verzió]
- Eszköz: [Desktop/Mobil/Tablet]
- Képernyő méret: [pl. 1920x1080]

## Képernyőkép
[Csatold a képernyőképet]`),

        createHeading('10.2 Hiba Súlyosság Definíciók', 2),
        createTable(
          ['Súlyosság', 'Leírás', 'Példa'],
          [
            ['Kritikus', 'A rendszer vagy fő funkció teljesen használhatatlan', 'Belépés nem működik, adatvesztés'],
            ['Magas', 'Fő funkció nem működik, de van workaround', 'Mosás rögzítés hibás, de manuálisan megoldható'],
            ['Közepes', 'Funkció részben működik vagy nehézkes', 'Szűrés nem működik, de lista látható'],
            ['Alacsony', 'Kozmetikai hiba, nem befolyásolja a működést', 'Elírás, rossz igazítás'],
          ]
        ),

        new Paragraph({ children: [new PageBreak()] }),

        // Section 11: Testing Schedule
        createHeading('11. Tesztelési Ütemterv', 1),
        createTable(
          ['Fázis', 'Időtartam', 'Fókusz'],
          [
            ['1. nap', '4 óra', 'Platform Admin + Network Admin alapok'],
            ['2. nap', '4 óra', 'Partner Portal + Operator Portal'],
            ['3. nap', '4 óra', 'Sofőr PWA + Keresztfunkcionális tesztek'],
            ['4. nap', '2 óra', 'Regressziós tesztek + Hibajavítás ellenőrzés'],
          ]
        ),

        new Paragraph({ spacing: { before: 600 } }),

        // Section 12: Contact
        createHeading('12. Kapcsolat', 1),
        createParagraph('Kérdések és hibajelentések:'),
        createParagraph('• Fejlesztő: [Fejlesztő neve]'),
        createParagraph('• Email: [email cím]'),
        createParagraph('• Slack/Teams: [csatorna]'),

        new Paragraph({ spacing: { before: 400 } }),

        // Changelog
        createHeading('13. Changelog', 1),
        createTable(
          ['Dátum', 'Verzió', 'Változás'],
          [
            ['2026-01-19', '1.0', 'Első verzió'],
            ['2026-01-19', '1.1', 'QR kód folyamat javítása - pontosítva, hogy a SOFŐR olvassa be a HELYSZÍN QR kódját'],
          ]
        ),

        new Paragraph({ spacing: { before: 800 } }),
        new Paragraph({
          children: [
            new TextRun({
              text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
              color: COLORS.primary,
              size: 24,
            }),
          ],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: 'Sikeres tesztelést kívánunk!',
              bold: true,
              size: 28,
              color: COLORS.primary,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 200 },
        }),
      ],
    }],
  });

  // Generate and save the document
  const buffer = await Packer.toBuffer(doc);
  const outputPath = path.join(__dirname, '..', 'VSys_Tesztelesi_Utmutato.docx');
  fs.writeFileSync(outputPath, buffer);
  console.log(`✅ Word dokumentum létrehozva: ${outputPath}`);
}

generateDocument().catch(console.error);
