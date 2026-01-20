# VSys Mosórendszer - Tesztelési Útmutató

**Verzió:** 1.1
**Dátum:** 2026-01-19
**Alkalmazás URL:** https://app.vemiax.com

---

## 1. Rendszer Bemutatás

### 1.1 Mi a VSys?

A VSys egy komplex, többszintű kamionmosó menedzsment rendszer, amely a következő szereplőket szolgálja ki:

| Szereplő | Leírás | Portál |
|----------|--------|--------|
| **Platform Admin** | A teljes rendszer üzemeltetője (Vemiax) | `/platform-admin` |
| **Network Admin** | Mosóhálózat tulajdonosa/üzemeltetője | `/network-admin` |
| **Partner** | Fuvarozó cég, amely sofőröket küld mosatni | `/partner` |
| **Operator** | Mosóállomás kezelője, aki a mosásokat végzi | `/operator-portal` |
| **Sofőr (Driver)** | Kamionsofőr, aki mosatni viszi a járművet | `/` (PWA főoldal) |

### 1.2 Rendszer Architektúra

```
┌─────────────────────────────────────────────────────────────┐
│                     PLATFORM ADMIN                           │
│         (Vemiax - teljes rendszer felügyelet)               │
└─────────────────────────┬───────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│   NETWORK 1   │ │   NETWORK 2   │ │   NETWORK N   │
│  (Mosóhálózat)│ │  (Mosóhálózat)│ │  (Mosóhálózat)│
└───────┬───────┘ └───────────────┘ └───────────────┘
        │
        ├──────────────┬──────────────┐
        ▼              ▼              ▼
┌───────────────┐ ┌──────────┐ ┌──────────┐
│   LOCATIONS   │ │ PARTNERS │ │  PRICES  │
│ (Mosóhelyek)  │ │(Partnerek)│ │ (Árak)   │
└───────┬───────┘ └────┬─────┘ └──────────┘
        │              │
        ▼              ▼
┌───────────────┐ ┌──────────┐
│   OPERATORS   │ │  DRIVERS │
│ (Operátorok)  │ │ (Sofőrök)│
└───────────────┘ └──────────┘
```

### 1.3 Fő Funkciók

- **Mosások kezelése**:
  - **QR kódos mód**: A SOFŐR beolvassa a HELYSZÍN QR kódját a telefonjával
  - **Manuális mód**: Az OPERÁTOR rendszám alapján rögzíti a mosást
- **Partner menedzsment**: Fuvarozó cégek, sofőrök, járművek kezelése
- **Árazás**: Helyszín és partner specifikus árak, kedvezmények
- **Számlázás**: Automatikus számlakiállítás (Számlázz.hu, Billingo integráció)
- **Riportok**: Forgalmi, pénzügyi kimutatások
- **Dokumentáció**: Szerepkör alapú súgó rendszer

### 1.4 QR Kód Használat - FONTOS!

> **KRITIKUS:** A rendszerben a **HELYSZÍNEKNEK** (mosóállomásoknak) van QR kódja, NEM a sofőröknek!

**Helyes folyamat:**
1. Minden mosóhelyszínhez egyedi QR kód tartozik
2. A QR kód ki van nyomtatva/kihelyezve a mosóhelyszínen
3. A **SOFŐR** a telefonjával beolvassa a helyszín QR kódját
4. Ez azonosítja a helyszínt és elindítja a mosás folyamatot

**Mi NEM történik:**
- Az operátor NEM szkennel QR kódot
- A sofőrnek NINCS QR kódja amit az operátor beolvasna

---

## 2. Tesztelési Környezet

### 2.1 Teszt Fiókok

| Szerep | Email | PIN/Jelszó | Megjegyzés |
|--------|-------|------------|------------|
| Platform Admin | `platform@test.com` | `Admin123!` | Teljes hozzáférés |
| Network Admin | `network@test.com` | `Admin123!` | Demo hálózat admin |
| Partner Admin | `partner@test.com` | `1234` | Teszt partner |
| Operator | `operator@test.com` | `1234` | Teszt mosóhely |
| Sofőr | `driver@test.com` | `1234` | Teszt sofőr |

> **FONTOS:** A teszt fiókokat a Platform Admin hozza létre a tesztelés előtt!

### 2.2 Böngésző Követelmények

- Chrome (ajánlott) - legújabb verzió
- Firefox - legújabb verzió
- Safari - legújabb verzió
- Edge - legújabb verzió

### 2.3 Mobil Tesztelés

- iOS Safari (iPhone 12 vagy újabb ajánlott)
- Android Chrome (Android 10 vagy újabb)
- PWA telepítés tesztelése mindkét platformon

---

## 3. Platform Admin Tesztelés

**URL:** https://app.vemiax.com/platform-admin

### 3.1 Belépés

- [ ] Belépés helyes email/jelszóval - sikeres
- [ ] Belépés hibás jelszóval - hibaüzenet megjelenik
- [ ] "Elfelejtett jelszó" funkció működik
- [ ] Jelszó visszaállítás email megérkezik
- [ ] Új jelszó beállítása sikeres

### 3.2 Dashboard

- [ ] Dashboard betöltődik hibamentesen
- [ ] Statisztikák megjelennek (hálózatok száma, mosások, bevétel)
- [ ] Grafikonok renderelődnek
- [ ] Adatok frissíthetők

### 3.3 Hálózatok Kezelése

- [ ] Hálózatok listája betöltődik
- [ ] Új hálózat létrehozása
  - [ ] Kötelező mezők validálása működik
  - [ ] Hálózat sikeresen létrejön
  - [ ] Admin felhasználó automatikusan létrejön
- [ ] Hálózat szerkesztése
  - [ ] Adatok módosíthatók
  - [ ] Mentés sikeres
- [ ] Hálózat részletek megtekintése
  - [ ] Helyszínek listája látható
  - [ ] Partnerek listája látható
  - [ ] Statisztikák helyesek

### 3.4 Beállítások

- [ ] Beállítások oldal betöltődik
- [ ] **HelpTooltip tesztelés**: Minden mezőnél a kérdőjel ikonra kattintva/ráhúzva megjelenik a súgó szöveg
- [ ] Platform beállítások módosíthatók
- [ ] Mentés sikeres

### 3.5 Adminisztrátorok

- [ ] Admin lista betöltődik
- [ ] Új admin hozzáadása
- [ ] Admin jogosultságok módosítása
- [ ] Admin törlése (saját magát nem törölheti)

### 3.6 Számlázás / Billing

- [ ] Hálózatok előfizetései láthatók
- [ ] Előfizetési szintek kezelhetők
- [ ] Számlák listája elérhető

### 3.7 Audit Log

- [ ] Audit napló betöltődik
- [ ] Szűrés működik (dátum, felhasználó, művelet)
- [ ] Részletek megtekinthetők

### 3.8 Dokumentáció

- [ ] Súgó link működik (kérdőjel ikon a fejlécben)
- [ ] Dokumentációs oldal betöltődik
- [ ] Platform Admin specifikus tartalom jelenik meg

---

## 4. Network Admin Tesztelés

**URL:** https://app.vemiax.com/network-admin

### 4.1 Belépés

- [ ] Belépés helyes email/jelszóval
- [ ] Session perzisztencia (oldal frissítés után is bejelentkezve marad)
- [ ] Kijelentkezés működik

### 4.2 Dashboard

- [ ] Mai mosások száma helyes
- [ ] Heti/havi statisztikák
- [ ] Bevételi adatok
- [ ] Legutóbbi mosások listája

### 4.3 Helyszínek (Locations)

- [ ] Helyszínek listája betöltődik
- [ ] **Új helyszín létrehozása**
  - [ ] Név megadása (kötelező)
  - [ ] Cím megadása
  - [ ] GPS koordináták (opcionális)
  - [ ] Operátor hozzárendelése
  - [ ] Mentés sikeres
- [ ] **Helyszín szerkesztése**
  - [ ] Adatok módosíthatók
  - [ ] Változások mentése
- [ ] **Helyszín részletek**
  - [ ] **QR kód megjelenik** (ezt a sofőrök fogják beolvasni!)
  - [ ] QR kód letölthető/nyomtatható
  - [ ] Mosási statisztikák láthatók

### 4.4 Partnerek (Partners)

- [ ] Partnerek listája
- [ ] **Új partner létrehozása**
  - [ ] Cégnév (kötelező)
  - [ ] Adószám
  - [ ] Kapcsolattartó adatok
  - [ ] Mentés sikeres
- [ ] **Partner szerkesztése**
- [ ] **Partner részletek**
  - [ ] Sofőrök listája
  - [ ] Járművek listája
  - [ ] Mosási előzmények

### 4.5 Sofőrök (Drivers)

- [ ] Sofőrök listája
- [ ] Szűrés partner szerint
- [ ] Sofőr jóváhagyások kezelése (ha van várakozó)
- [ ] Sofőr adatok megtekintése

### 4.6 Mosások (Wash Events)

- [ ] Mosások listája betöltődik
- [ ] Szűrés működik:
  - [ ] Dátum szerint
  - [ ] Helyszín szerint
  - [ ] Partner szerint
  - [ ] Státusz szerint
- [ ] Mosás részletek megtekintése
- [ ] **Manuális mosás rögzítése**
  - [ ] Sofőr kiválasztása
  - [ ] Jármű kiválasztása
  - [ ] Helyszín kiválasztása
  - [ ] Szolgáltatások kiválasztása
  - [ ] Ár megjelenik
  - [ ] Mentés sikeres

### 4.7 Árak (Prices)

- [ ] Árlisták megtekintése
- [ ] **Árlista feltöltés (Excel/CSV)**
  - [ ] Sablon letöltése
  - [ ] Fájl feltöltése
  - [ ] Előnézet megjelenik
  - [ ] Import sikeres
- [ ] **Manuális ár módosítás**
  - [ ] Szolgáltatás ár módosítása
  - [ ] Partner specifikus ár beállítása
  - [ ] Mentés sikeres

### 4.8 Beállítások (Settings)

> **KIEMELT TESZTELÉS: HelpTooltip funkció**

Minden tab-on ellenőrizd, hogy a kérdőjel ikonok működnek:

#### Cégadatok tab
- [ ] Cégnév - tooltip megjelenik
- [ ] Adószám - tooltip megjelenik
- [ ] EU ÁFA szám - tooltip megjelenik
- [ ] Ország - tooltip megjelenik
- [ ] Cím - tooltip megjelenik
- [ ] Bank neve - tooltip megjelenik
- [ ] Számlaszám - tooltip megjelenik
- [ ] IBAN - tooltip megjelenik
- [ ] Email - tooltip megjelenik
- [ ] Telefon - tooltip megjelenik

#### Regionális tab
- [ ] Ország - tooltip megjelenik
- [ ] Időzóna - tooltip megjelenik
- [ ] Alapértelmezett pénznem - tooltip megjelenik
- [ ] Nyelv - tooltip megjelenik

#### Számlázás tab
- [ ] Számlázó rendszer - tooltip megjelenik
- [ ] (Számlázz.hu választása esetén) Agent kulcs - tooltip megjelenik
- [ ] (Billingo választása esetén) API kulcs - tooltip megjelenik
- [ ] NAV felhasználónév - tooltip megjelenik
- [ ] Adószám (NAV) - tooltip megjelenik

#### Értesítések tab
- [ ] Email szolgáltató - tooltip megjelenik
- [ ] (SMTP esetén) Minden SMTP mező - tooltip megjelenik
- [ ] SMS szolgáltató - tooltip megjelenik
- [ ] (Twilio esetén) Account SID - tooltip megjelenik
- [ ] (Twilio esetén) Telefonszám - tooltip megjelenik

#### Üzleti szabályok tab
- [ ] Fizetési módok cím - tooltip megjelenik
- [ ] Készpénzes fizetés - tooltip megjelenik
- [ ] Bankkártyás fizetés - tooltip megjelenik
- [ ] Üzemanyagkártyás fizetés - tooltip megjelenik
- [ ] Regisztráció cím - tooltip megjelenik
- [ ] Önálló regisztráció - tooltip megjelenik
- [ ] Automatikus jóváhagyás - tooltip megjelenik
- [ ] Ellenőrzési követelmények cím - tooltip megjelenik
- [ ] Email megerősítés - tooltip megjelenik
- [ ] Telefonszám megerősítés - tooltip megjelenik

#### Beállítások mentése
- [ ] Változtatások mentése gomb működik
- [ ] Sikeres mentés üzenet megjelenik
- [ ] Oldal újratöltés után az adatok megmaradnak

### 4.9 Riportok

- [ ] Riportok oldal betöltődik
- [ ] Dátum szűrés működik
- [ ] Export funkció (ha van)

### 4.10 Dokumentáció

- [ ] Súgó link a fejlécben működik
- [ ] Network Admin dokumentáció jelenik meg
- [ ] Minden szekció olvasható

---

## 5. Partner Portal Tesztelés

**URL:** https://app.vemiax.com/partner

### 5.1 Belépés

- [ ] Belépés PIN kóddal
- [ ] Hibás PIN - hibaüzenet
- [ ] Elfelejtett PIN funkció

### 5.2 Dashboard

- [ ] Dashboard betöltődik
- [ ] Saját sofőrök mosásai láthatók
- [ ] Statisztikák helyesek
- [ ] Költségek összesítése

### 5.3 Számlák

- [ ] Számlák listája
- [ ] Számla részletek megtekintése
- [ ] Számla letöltése (PDF)

### 5.4 Dokumentáció

- [ ] Súgó link működik
- [ ] Partner specifikus dokumentáció jelenik meg

---

## 6. Operator Portal Tesztelés

**URL:** https://app.vemiax.com/operator-portal

### 6.1 Belépés

- [ ] Belépés PIN kóddal
- [ ] Session kezelés
- [ ] Kijelentkezés

### 6.2 Dashboard

- [ ] Mai mosások száma
- [ ] Aktív mosások
- [ ] Várakozó mosások

### 6.3 Manuális Mosás Rögzítés

> **FONTOS:** Az operátor NEM szkennel QR kódot! A mosásokat rendszám alapján rögzíti manuálisan.

- [ ] "Új mosás" / "Mosás rögzítése" gomb működik
- [ ] **Mosás rögzítési űrlap megjelenik**
  - [ ] Rendszám (vontató) mező - kötelező
  - [ ] Pótkocsi rendszám mező (opcionális, kamionmosónál)
  - [ ] Ügyfél típus választás (Szerződéses / Nem szerződéses)
- [ ] **Szerződéses ügyfél esetén**
  - [ ] Partner kiválasztás legördülő menüből
- [ ] **Nem szerződéses (walk-in) ügyfél esetén**
  - [ ] Fizetési mód választás (készpénz, kártya, üzemanyagkártya)
  - [ ] Számla kérés checkbox
  - [ ] Ha számlát kér: cégnév, adószám, email mezők
- [ ] **Járműtípus kiválasztása**
  - [ ] Járműtípus lista megjelenik
  - [ ] Választás befolyásolja az árakat
- [ ] **Szolgáltatások kiválasztása**
  - [ ] Szolgáltatások listája megjelenik
  - [ ] Árak megjelennek a járműtípusnak megfelelően
  - [ ] Több szolgáltatás hozzáadható
  - [ ] Szolgáltatás törölhető
- [ ] **Sofőr neve** (opcionális mező)
- [ ] **Megjegyzés** (opcionális mező)
- [ ] **Összesítés**
  - [ ] Összes ár helyesen számítódik
  - [ ] Szolgáltatások száma látható
- [ ] **Mosás rögzítése gomb**
  - [ ] Sikeres rögzítés visszajelzés
  - [ ] Hiba esetén hibaüzenet

### 6.4 Rendszám Felismerés

- [ ] Rendszám beírásánál korábbi mosás adatok megjelennek (ha volt már ilyen rendszám)
- [ ] "Átvesz" gombbal az adatok automatikusan kitöltődnek
  - [ ] Partner
  - [ ] Járműtípus
  - [ ] Pótkocsi rendszám
  - [ ] Sofőr neve
  - [ ] Gyakori szolgáltatások

### 6.5 Mosási Előzmények

- [ ] Lista betöltődik
- [ ] Szűrés dátum szerint
- [ ] Részletek megtekintése

### 6.6 Foglalások (Bookings)

- [ ] Foglalások listája
- [ ] Foglalás elfogadása
- [ ] Foglalás elutasítása

### 6.7 Számlázás

- [ ] Partner számla lista
- [ ] Számla generálás
- [ ] Számla letöltés

### 6.8 Dokumentáció

- [ ] Súgó link működik
- [ ] Operator specifikus dokumentáció

---

## 7. Sofőr PWA Tesztelés

**URL:** https://app.vemiax.com

### 7.1 Regisztráció

- [ ] Regisztrációs form megjelenik
- [ ] **QR kódos regisztráció** (partner meghívó QR kód)
  - [ ] QR kód szkennelése
  - [ ] Partner automatikusan kitöltődik
  - [ ] Személyes adatok megadása
  - [ ] Jármű adatok megadása
  - [ ] PIN kód beállítása
  - [ ] Sikeres regisztráció
- [ ] **Manuális regisztráció** (ha engedélyezett)
  - [ ] Partner kiválasztása
  - [ ] Adatok megadása
  - [ ] Jóváhagyásra várakozás

### 7.2 Belépés

- [ ] Belépés PIN kóddal
- [ ] "Emlékezz rám" funkció
- [ ] Hibás PIN kezelés

### 7.3 Dashboard

- [ ] Felhasználó neve megjelenik
- [ ] Járművek listája
- [ ] Legutóbbi mosások
- [ ] "Start New Wash" / "QR Scan" gombok

### 7.4 Új Mosás Indítás - QR Kóddal

> **KRITIKUS FUNKCIÓ:** A sofőr a telefonjával beolvassa a HELYSZÍN QR kódját!

- [ ] "QR Scan" / "Start New Wash" gomb megnyomása
- [ ] **Kamera engedélykérés**
  - [ ] Engedélykérő ablak megjelenik
  - [ ] Engedély megadása után kamera aktiválódik
- [ ] **QR kód szkennelés felület**
  - [ ] Kamera kép látható
  - [ ] Szkennelési keret megjelenik
  - [ ] "Enter Code Manually" opció elérhető
- [ ] **Helyszín QR kód beolvasása**
  - [ ] A mosóhely QR kódjának beolvasása
  - [ ] Helyszín azonosítása sikeres
  - [ ] Helyszín adatok megjelennek
- [ ] **Manuális kód megadás** (ha QR nem működik)
  - [ ] Kód beviteli mező
  - [ ] "Find Location" gomb
  - [ ] Helyszín megtalálása
- [ ] **Mosás folyamat indítása**
  - [ ] Jármű kiválasztása
  - [ ] Szolgáltatások megtekintése
  - [ ] Mosás kérés elküldése

### 7.5 Mosás Státusz Követés

- [ ] Aktív mosás státusza látható
- [ ] Értesítés mosás befejezésekor (ha van push)

### 7.6 Mosási Előzmények

- [ ] Előzmények listája
- [ ] Részletek megtekintése
- [ ] Szűrés működik

### 7.7 Járművek Kezelése

- [ ] Járművek listája
- [ ] Új jármű hozzáadása
- [ ] Jármű szerkesztése
- [ ] Jármű törlése

### 7.8 Beállítások

- [ ] Profil adatok szerkesztése
- [ ] PIN kód módosítása
- [ ] Értesítési beállítások

### 7.9 PWA Funkciók

- [ ] **Telepítés**
  - [ ] "Telepítés" prompt megjelenik
  - [ ] Alkalmazás telepíthető
  - [ ] Ikon megjelenik a kezdőképernyőn
- [ ] **Offline működés**
  - [ ] Alkalmazás betöltődik offline módban
  - [ ] Megfelelő hibaüzenet jelenik meg
- [ ] **Push értesítések** (ha implementált)
  - [ ] Engedélykérés
  - [ ] Értesítések megérkeznek

### 7.10 Dokumentáció

- [ ] Súgó link működik
- [ ] Sofőr dokumentáció jelenik meg

---

## 8. Keresztfunkcionális Tesztek

### 8.1 Teljes Mosási Folyamat - QR Kóddal

> **End-to-end teszt - Minden szereplővel végig kell menni!**

1. [ ] **Network Admin** létrehoz egy helyszínt és kinyomtatja a QR kódot
2. [ ] **Sofőr** regisztrál a rendszerbe (partner meghívóval vagy manuálisan)
3. [ ] **Network Admin** jóváhagyja a sofőrt (ha szükséges)
4. [ ] **Sofőr** a helyszínre érkezik és beolvassa a helyszín QR kódját a telefonjával
5. [ ] **Sofőr** kiválasztja a járművet és mosás típust
6. [ ] **Operátor** látja a beérkező mosás kérést a Dashboard-on
7. [ ] **Operátor** elindítja és elvégzi a mosást
8. [ ] **Operátor** befejezi a mosást és rögzíti a fizetést
9. [ ] **Sofőr** látja a befejezett mosást az előzményekben
10. [ ] **Partner** látja a mosást a dashboard-on
11. [ ] **Network Admin** látja a mosást a riportokban

### 8.2 Teljes Mosási Folyamat - Manuális Rögzítés

> **Ha a sofőr nem használ appot, az operátor manuálisan rögzíti a mosást**

1. [ ] **Operátor** megnyitja az "Új mosás" űrlapot
2. [ ] **Operátor** beírja a rendszámot
3. [ ] **Operátor** kiválasztja a partnert (vagy walk-in ügyfél)
4. [ ] **Operátor** kiválasztja a szolgáltatásokat
5. [ ] **Operátor** rögzíti a mosást
6. [ ] **Partner** látja a mosást a dashboard-on
7. [ ] **Network Admin** látja a mosást a riportokban

### 8.3 Árlista Folyamat

1. [ ] **Network Admin** feltölt egy árlistát
2. [ ] **Operátor** indít egy mosást - helyes ár jelenik meg
3. [ ] Partner specifikus ár esetén az módosul

### 8.4 Számlázási Folyamat

1. [ ] Mosások rögzítése
2. [ ] **Network Admin** generál számlát
3. [ ] **Partner** látja a számlát
4. [ ] Számla letölthető

---

## 9. Nem-funkcionális Tesztek

### 9.1 Teljesítmény

- [ ] Oldalak betöltési ideje < 3 másodperc
- [ ] Listák görgetése smooth
- [ ] Képek optimalizáltak

### 9.2 Reszponzivitás

Minden portált tesztelni kell:
- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobil (375x667)

### 9.3 Biztonság

- [ ] Nem bejelentkezett felhasználó nem fér hozzá védett oldalakhoz
- [ ] Egy portál felhasználója nem fér hozzá másik portálhoz
- [ ] Session lejár inaktivitás után
- [ ] Jelszavak nem jelennek meg plaintext-ben

### 9.4 Használhatóság

- [ ] Hibaüzenetek érthetők
- [ ] Kötelező mezők jelölve vannak
- [ ] Betöltés indikátorok megjelennek
- [ ] Sikeres műveletek visszajelzése

---

## 10. Hibajelentés

### 10.1 Hiba Bejelentés Formátum

Minden hibánál dokumentáld:

```
## Hiba azonosító: [PORTAL]-[SZÁM]
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
[Csatold a képernyőképet]

## Konzol hibák
[Ha van, másold be a böngésző konzol hibaüzeneteit]
```

### 10.2 Hiba Súlyosság Definíciók

| Súlyosság | Leírás | Példa |
|-----------|--------|-------|
| **Kritikus** | A rendszer vagy fő funkció teljesen használhatatlan | Belépés nem működik, adatvesztés |
| **Magas** | Fő funkció nem működik, de van workaround | Mosás rögzítés hibás, de manuálisan megoldható |
| **Közepes** | Funkció részben működik vagy nehézkes | Szűrés nem működik, de lista látható |
| **Alacsony** | Kozmetikai hiba, nem befolyásolja a működést | Elírás, rossz igazítás |

---

## 11. Tesztelési Ütemterv

| Fázis | Időtartam | Fókusz |
|-------|-----------|--------|
| 1. nap | 4 óra | Platform Admin + Network Admin alapok |
| 2. nap | 4 óra | Partner Portal + Operator Portal |
| 3. nap | 4 óra | Sofőr PWA + Keresztfunkcionális tesztek |
| 4. nap | 2 óra | Regressziós tesztek + Hibajavítás ellenőrzés |

---

## 12. Kapcsolat

Kérdések és hibajelentések:
- **Fejlesztő:** [Fejlesztő neve]
- **Email:** [email cím]
- **Slack/Teams:** [csatorna]

---

## 13. Changelog

| Dátum | Verzió | Változás |
|-------|--------|----------|
| 2026-01-19 | 1.0 | Első verzió |
| 2026-01-19 | 1.1 | QR kód folyamat javítása - pontosítva, hogy a SOFŐR olvassa be a HELYSZÍN QR kódját |

---

**Sikeres tesztelést kívánunk!**
