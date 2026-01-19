/**
 * Centralized help texts for tooltips
 *
 * This file serves as a translation-ready text store.
 * For future i18n support, these can be converted to translation keys
 * and loaded from language files (e.g., hu.json, en.json).
 *
 * Structure: section.field.help
 */

export const helpTexts = {
  // Platform Admin Settings
  platformSettings: {
    // General section
    platformName: {
      help: 'A platform megjelenített neve, amely minden felületen és értesítésben megjelenik.',
    },
    supportEmail: {
      help: 'Az ügyfélszolgálati email cím, ahová a felhasználók kérdéseiket küldhetik.',
    },
    supportPhone: {
      help: 'Az ügyfélszolgálati telefonszám, amelyen a felhasználók elérhetik a támogatást.',
    },
    defaultLanguage: {
      help: 'Az alapértelmezett nyelv új felhasználók és az alapértelmezett felület számára.',
    },
    timezone: {
      help: 'Az időzóna, amelyet a rendszer dátumok és időpontok megjelenítéséhez használ.',
    },
    maintenanceMode: {
      help: 'Ha bekapcsolja, a platform karbantartási módba lép és a felhasználók nem férhetnek hozzá.',
    },

    // Company data section
    companyName: {
      help: 'A platform üzemeltető cég hivatalos neve a számlákon és jogi dokumentumokon.',
    },
    companyTaxNumber: {
      help: 'A cég adószáma (pl. 12345678-1-42), amely a számlákon megjelenik.',
    },
    companyAddress: {
      help: 'A cég hivatalos székhelyének címe.',
    },
    companyBankAccount: {
      help: 'A cég bankszámlaszáma átutalásos fizetésekhez.',
    },
    companyEmail: {
      help: 'A cég hivatalos email címe, amely a számlákon és szerződéseken szerepel.',
    },
    companyPhone: {
      help: 'A cég hivatalos telefonszáma.',
    },

    // Pricing section
    subscriptionPrice: {
      help: 'A havi előfizetési díj hálózatonként forintban.',
    },
    trialPeriodDays: {
      help: 'A próbaidőszak hossza napokban új hálózatok számára.',
    },
    gracePeriodDays: {
      help: 'A türelmi időszak hossza napokban a lejárat után, amely alatt az adatok még megtekinthetők.',
    },
    platformFeePercent: {
      help: 'A platform jutalék százaléka minden tranzakció után.',
    },

    // Email (Resend) section
    resendApiKey: {
      help: 'A Resend szolgáltatás API kulcsa email küldéshez. Regisztráljon a resend.com oldalon.',
    },
    emailFromAddress: {
      help: 'Az email küldő címe (pl. noreply@yourdomain.com). Ennek a domainnek verifikáltnak kell lennie a Resend-ben.',
    },
    emailFromName: {
      help: 'Az email küldő neve, amely a címzetteknél megjelenik.',
    },

    // SMS (Twilio) section
    twilioAccountSid: {
      help: 'A Twilio fiók SID azonosítója. A Twilio Console főoldalán található.',
    },
    twilioAuthToken: {
      help: 'A Twilio fiók Auth Token azonosítója. Tartsa titokban, ne ossza meg senkivel.',
    },
    twilioPhoneNumber: {
      help: 'A Twilio telefonszám, amelyről az SMS-ek kimennek (pl. +36701234567).',
    },

    // Stripe section
    stripePublishableKey: {
      help: 'A Stripe nyilvános (publishable) kulcsa. Ez a frontenden használható, biztonságosan megosztható.',
    },
    stripeSecretKey: {
      help: 'A Stripe titkos kulcsa. SOHA ne ossza meg és ne tegye nyilvánossá!',
    },
    stripeWebhookSecret: {
      help: 'A Stripe webhook titkosító kulcsa a webhook események hitelesítéséhez.',
    },

    // Invoice Provider section
    invoiceProvider: {
      help: 'Válassza ki a számlázási szolgáltatót. A Billingo és Számlázz.hu a két legelterjedtebb magyar megoldás.',
    },
    billingoApiKey: {
      help: 'A Billingo API kulcsa. A Billingo fiókjában a Beállítások > API menüpont alatt található.',
    },
    szamlazzhuApiKey: {
      help: 'A Számlázz.hu Agent kulcsa. A Számlázz.hu fiókjában a Beállítások menüpont alatt generálható.',
    },

    // Company Data Provider section
    companyDataProvider: {
      help: 'Válassza ki a cégadatlekérdezési szolgáltatót az automatikus cégadatkitöltéshez adószám alapján.',
    },
    bisnodeApiKey: {
      help: 'A Bisnode (Dun & Bradstreet) API kulcsa a cégadatok lekérdezéséhez.',
    },
    ecegApiKey: {
      help: 'Az e-Cégjegyzék API kulcsa a hivatalos magyar cégjegyzék adatainak eléréséhez.',
    },
  },

  // Network Admin Settings
  networkSettings: {
    networkName: {
      help: 'A mosóhálózat megjelenített neve, amely az operátorok és sofőrök számára látható.',
    },
    operatorCommission: {
      help: 'Az operátor jutalékának százaléka minden elvégzett mosás után.',
    },
    driverPaymentPercent: {
      help: 'A sofőrnek járó összeg százaléka a mosási díjból.',
    },
  },

  // Location Settings
  locationSettings: {
    locationName: {
      help: 'A mosóállomás neve, ahogy megjelenik a sofőrök alkalmazásában.',
    },
    address: {
      help: 'A mosóállomás pontos címe a navigációhoz és azonosításhoz.',
    },
    coordinates: {
      help: 'GPS koordináták (szélesség, hosszúság) a térképen való megjelenítéshez.',
    },
    openingHours: {
      help: 'A mosóállomás nyitvatartási ideje. Ezen kívül nem lehet mosást indítani.',
    },
    qrCode: {
      help: 'Az egyedi QR kód, amelyet a sofőrök beolvasnak a mosás indításához.',
    },
  },
} as const;

/**
 * Type-safe helper to get help text
 *
 * Usage:
 * const text = getHelpText('platformSettings', 'platformName');
 */
export function getHelpText<
  S extends keyof typeof helpTexts,
  F extends keyof (typeof helpTexts)[S]
>(section: S, field: F): string {
  const sectionData = helpTexts[section];
  const fieldData = sectionData[field] as { help: string };
  return fieldData.help;
}

/**
 * Type for all help text keys (useful for i18n)
 */
export type HelpTextKey = {
  [S in keyof typeof helpTexts]: {
    [F in keyof (typeof helpTexts)[S]]: `${S & string}.${F & string}.help`;
  }[keyof (typeof helpTexts)[S]];
}[keyof typeof helpTexts];
