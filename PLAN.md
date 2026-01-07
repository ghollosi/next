# Sofőr Önregisztráció Email/SMS Validációval - Implementációs Terv

## Áttekintés

Sofőr önregisztráció rendszer email és/vagy telefonszám validációval, partner cég váltás lehetőséggel, és értesítési rendszerrel.

## Technikai Döntések

- **Email szolgáltató**: Resend (ingyenes: 100 email/nap, egyszerű API)
- **SMS szolgáltató**: Twilio
- **Partner cég váltás**: Azonnali, admin jóváhagyás nélkül

---

## 1. Adatbázis Változtatások

### 1.1 Új mezők a Driver modellhez
```prisma
model Driver {
  // ... meglévő mezők ...

  // Validációs mezők
  emailVerified     Boolean   @default(false) @map("email_verified")
  emailVerifiedAt   DateTime? @map("email_verified_at")
  phoneVerified     Boolean   @default(false) @map("phone_verified")
  phoneVerifiedAt   DateTime? @map("phone_verified_at")
}
```

### 1.2 Új tábla: VerificationToken
```prisma
model VerificationToken {
  id          String           @id @default(uuid())
  driverId    String           @map("driver_id")
  type        VerificationType // EMAIL vagy PHONE
  token       String           @unique
  destination String           // email cím vagy telefonszám
  expiresAt   DateTime         @map("expires_at")
  usedAt      DateTime?        @map("used_at")
  createdAt   DateTime         @default(now()) @map("created_at")

  driver      Driver           @relation(fields: [driverId], references: [id])

  @@index([driverId])
  @@index([token])
  @@map("verification_tokens")
}

enum VerificationType {
  EMAIL
  PHONE
}
```

### 1.3 Új tábla: DriverPartnerHistory (cég váltás előzmények)
```prisma
model DriverPartnerHistory {
  id               String   @id @default(uuid())
  driverId         String   @map("driver_id")
  fromCompanyId    String?  @map("from_company_id")
  toCompanyId      String   @map("to_company_id")
  changedAt        DateTime @default(now()) @map("changed_at")
  reason           String?

  driver           Driver         @relation(fields: [driverId], references: [id])
  fromCompany      PartnerCompany? @relation("FromCompany", fields: [fromCompanyId], references: [id])
  toCompany        PartnerCompany  @relation("ToCompany", fields: [toCompanyId], references: [id])

  @@index([driverId])
  @@map("driver_partner_history")
}
```

### 1.4 Új tábla: AdminUser (értesítések fogadásához)
```prisma
model AdminUser {
  id        String   @id @default(uuid())
  networkId String   @map("network_id")
  email     String
  name      String
  role      AdminRole @default(ADMIN)
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")

  network   Network  @relation(fields: [networkId], references: [id])

  @@index([networkId])
  @@map("admin_users")
}

enum AdminRole {
  ADMIN
  SUPER_ADMIN
}
```

---

## 2. Új Modulok

### 2.1 Email Modul (`src/modules/email/`)
```
src/modules/email/
├── email.module.ts
├── email.service.ts
├── providers/
│   └── resend.provider.ts
└── templates/
    ├── verification-email.template.ts
    ├── driver-registered.template.ts
    └── partner-change.template.ts
```

### 2.2 SMS Modul (`src/modules/sms/`)
```
src/modules/sms/
├── sms.module.ts
├── sms.service.ts
└── providers/
    └── twilio.provider.ts
```

### 2.3 Notification Modul (`src/modules/notification/`)
```
src/modules/notification/
├── notification.module.ts
└── notification.service.ts  // Koordinálja az email és SMS küldést
```

---

## 3. Környezeti Változók

```env
# Resend (Email)
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM_ADDRESS=noreply@vsys.hu
EMAIL_FROM_NAME=VSys Wash

# Twilio (SMS)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+36xxxxxxxxx

# Admin értesítés
ADMIN_NOTIFICATION_EMAIL=admin@vsys.hu

# Frontend URL (email linkekhez)
FRONTEND_URL=http://46.224.157.177:3001
```

---

## 4. API Végpontok

### 4.1 Regisztráció (módosított)
```
POST /pwa/register
Body: {
  partnerCompanyId: string,
  firstName: string,
  lastName: string,
  email?: string,        // Legalább egyik kötelező
  phone?: string,        // Legalább egyik kötelező
  pin: string,
  vehicles?: [...]
}
Response: {
  driverId: string,
  verificationRequired: 'EMAIL' | 'PHONE' | 'BOTH',
  message: string
}
```

### 4.2 Email validáció
```
POST /pwa/verify-email
Body: { token: string }
Response: { success: boolean, message: string }

GET /pwa/verify-email?token=xxx  // Link kattintáshoz
Redirect: /login?verified=true
```

### 4.3 SMS validáció
```
POST /pwa/verify-phone
Body: { driverId: string, code: string }
Response: { success: boolean, message: string }

POST /pwa/resend-verification
Body: { driverId: string, type: 'EMAIL' | 'PHONE' }
Response: { success: boolean, message: string }
```

### 4.4 Partner cég váltás
```
POST /pwa/change-partner
Headers: x-driver-session
Body: { newPartnerCompanyId: string, reason?: string }
Response: { success: boolean, message: string }
```

---

## 5. Frontend Változtatások

### 5.1 Regisztrációs oldal (`pwa/src/app/register/page.tsx`)
- Email VAGY telefon kötelező (legalább egyik)
- Validáció: email formátum, telefon formátum
- Lépések:
  1. Partner cég kiválasztása
  2. Személyes adatok (név, email, telefon)
  3. Járművek
  4. PIN beállítás
  5. **ÚJ**: Validációs kód bevitel oldal

### 5.2 Új oldal: Validáció (`pwa/src/app/verify/page.tsx`)
- Email: "Elküldtük a megerősítő linket"
- Telefon: 6 számjegyű kód bevitel
- Újraküldés gomb (60 mp várakozás)

### 5.3 Profil oldal: Partner váltás (`pwa/src/app/profile/page.tsx`)
- Partner cég megjelenítése
- "Cég váltás" gomb
- Cég választó dropdown
- Megerősítő dialógus

---

## 6. Validációs Logika

### 6.1 Token generálás
- **Email**: UUID alapú token (pl: `ev_a1b2c3d4-e5f6-...`)
- **SMS**: 6 számjegyű kód (pl: `123456`)

### 6.2 Lejárati idők
- **Email token**: 24 óra
- **SMS kód**: 10 perc

### 6.3 Újraküldési szabályok
- Maximum 3 újraküldés / óra
- 60 másodperc várakozás újraküldések között

---

## 7. Értesítési Flow

### 7.1 Új regisztrációnál
1. **Sofőrnek**: Validációs email/SMS
2. **Partner cégnek**: Email értesítés (ha van contact email)
3. **VSys adminnak**: Email értesítés

### 7.2 Validáció után
1. **Sofőrnek**: "Regisztráció sikeres" email
2. Status változás: PENDING (admin jóváhagyásra vár)

### 7.3 Partner váltásnál
1. **Régi cégnek**: Email értesítés (sofőr távozott)
2. **Új cégnek**: Email értesítés (új sofőr csatlakozott)
3. **Sofőrnek**: Megerősítő email

---

## 8. Implementációs Sorrend

### Fázis 1: Alap infrastruktúra
1. [ ] Prisma schema bővítése (verification_tokens, admin_users, driver_partner_history)
2. [ ] Migráció futtatása
3. [ ] Email modul létrehozása (Resend provider)
4. [ ] SMS modul létrehozása (Twilio provider)
5. [ ] Notification service létrehozása

### Fázis 2: Regisztrációs flow
6. [ ] Driver service bővítése (validációs mezők, token kezelés)
7. [ ] PWA controller: verify-email, verify-phone, resend-verification
8. [ ] Frontend: regisztrációs form módosítása
9. [ ] Frontend: validációs oldal

### Fázis 3: Értesítések
10. [ ] Email template-ek (validáció, regisztráció értesítés)
11. [ ] Partner cég értesítés regisztrációnál
12. [ ] Admin értesítés regisztrációnál

### Fázis 4: Partner váltás
13. [ ] Driver service: changePartnerCompany metódus
14. [ ] Partner history logging
15. [ ] PWA controller: change-partner végpont
16. [ ] Frontend: profil oldal partner váltással

### Fázis 5: Deploy
17. [ ] Környezeti változók beállítása (Resend, Twilio)
18. [ ] Docker rebuild
19. [ ] Tesztelés

---

## 9. Becslések

| Fázis | Komplexitás |
|-------|-------------|
| Fázis 1 | Közepes |
| Fázis 2 | Magas |
| Fázis 3 | Közepes |
| Fázis 4 | Alacsony |
| Fázis 5 | Alacsony |

---

## 10. Kockázatok és Megoldások

| Kockázat | Megoldás |
|----------|----------|
| Resend ingyenes limit (100/nap) | Monitorozás, szükség esetén fizetős plan |
| Twilio költségek | SMS csak ha telefon meg van adva |
| Spam regisztrációk | Rate limiting, CAPTCHA (később) |
| Email spam mappába kerül | SPF/DKIM beállítás a domainhez |
