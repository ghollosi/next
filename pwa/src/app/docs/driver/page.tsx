'use client'

import Link from 'next/link'
import {
  TruckIcon,
  QrCodeIcon,
  ClockIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  MapPinIcon,
  DevicePhoneMobileIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'
import { MobileAppMockup, WashFlowDiagram } from '@/components/docs/ScreenMockup'

const features = [
  {
    title: 'QR kód olvasó',
    description: 'Olvasd be a mosóhely QR kódját a szolgáltatás indításához.',
    icon: QrCodeIcon,
  },
  {
    title: 'Mosási előzmények',
    description: 'Korábbi mosások listája dátum, helyszín és összeg adatokkal.',
    icon: ClockIcon,
  },
  {
    title: 'Időpontfoglalás',
    description: 'Mosási időpont lefoglalása előre a várakozás elkerülésére.',
    icon: CalendarDaysIcon,
  },
  {
    title: 'Mosóhelyek',
    description: 'Elérhető mosóhelyek listája címmel és nyitvatartással.',
    icon: MapPinIcon,
  },
  {
    title: 'Számlák',
    description: 'Kiállított számlák megtekintése és letöltése.',
    icon: DocumentTextIcon,
  },
]

const registrationSteps = [
  {
    step: 1,
    title: 'Letöltés',
    description: 'Töltsd le a vSys Wash alkalmazást vagy nyisd meg a böngészőben.',
  },
  {
    step: 2,
    title: 'Regisztráció',
    description: 'Add meg az adataidat: név, telefonszám, email, rendszám.',
  },
  {
    step: 3,
    title: 'Partner kiválasztása',
    description: 'Ha céges sofőr vagy, válaszd ki a partneredet a listából.',
  },
  {
    step: 4,
    title: 'Jóváhagyás',
    description: 'Várd meg a hálózat admin jóváhagyását - értesítést kapsz.',
  },
  {
    step: 5,
    title: 'Használat',
    description: 'Bejelentkezés után szkenneld be a mosóhelyek QR kódját a szolgáltatás indításához.',
  },
]

export default function DriverDocsPage() {
  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 flex items-center justify-center">
            <TruckIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Sofőr Alkalmazás</h1>
            <p className="text-gray-400">Sofőrök mobil alkalmazása (PWA)</p>
          </div>
        </div>
      </div>

      {/* Access Info */}
      <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-purple-400 mb-2">Elérés</h2>
        <p className="text-gray-300 mb-3">
          A Sofőr alkalmazás a <code className="px-2 py-1 bg-gray-800 rounded text-purple-400">app.vemiax.com</code> címen érhető el.
        </p>
        <p className="text-gray-400 text-sm">
          PWA (Progressive Web App) - telepíthető a telefonra, de böngészőből is használható.
        </p>
      </div>

      {/* Screenshot */}
      <div className="bg-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Sofőr Dashboard</h2>
        </div>
        <div className="p-6">
          <MobileAppMockup />
        </div>
      </div>

      {/* Wash Flow */}
      <div className="bg-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Mosási folyamat</h2>
        </div>
        <div className="p-6">
          <WashFlowDiagram />
        </div>
      </div>

      {/* Description */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-4">Mire szolgál?</h2>
        <p className="text-gray-300 leading-relaxed">
          A Sofőr alkalmazás a kamion- és autósofőrök számára készült mobil felület. A fő célja,
          hogy a sofőr gyorsan és egyszerűen tudjon beolvasni a mosóhely QR kódját, kiválasztani
          a szolgáltatásokat, nyomon követni a korábbi mosásait, és szükség esetén időpontot foglalni.
        </p>
      </div>

      {/* Features */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Főbb funkciók</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {features.map((feature) => (
            <div key={feature.title} className="bg-gray-800 rounded-xl p-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">{feature.title}</h3>
                  <p className="text-gray-400 text-sm">{feature.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* QR Code Scanning */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Mosás indítása QR kóddal</h2>
        <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl p-6">
          <div className="flex flex-col md:flex-row gap-6 items-center">
            <div className="w-32 h-32 bg-white rounded-xl flex items-center justify-center flex-shrink-0">
              <QrCodeIcon className="w-24 h-24 text-gray-800" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Hogyan működik?</h3>
              <ol className="space-y-2 text-gray-300 text-sm">
                <li>1. Jelentkezz be a Vemiax alkalmazásba</li>
                <li>2. A mosóhelyen keresd meg a kihelyezett QR kódot</li>
                <li>3. Az alkalmazásban kattints a "QR kód beolvasása" gombra</li>
                <li>4. Szkenneld be a mosóhely QR kódját a telefonoddal</li>
                <li>5. Válaszd ki a kívánt szolgáltatásokat és járműtípust</li>
                <li>6. Küld el a mosási kérelmet - az operátor látni fogja</li>
                <li>7. Várd meg, amíg az operátor jóváhagyja és elvégzi a mosást</li>
              </ol>
              <p className="text-gray-400 text-sm mt-4">
                <strong>Tipp:</strong> A mosóhely QR kódja általában a bejáratnál vagy a recepciónál található.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Registration */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Regisztráció - lépésről lépésre</h2>
        <div className="bg-gray-800 rounded-xl p-6">
          <div className="space-y-6">
            {registrationSteps.map((step) => (
              <div key={step.step} className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                  {step.step}
                </div>
                <div className="flex-1 pb-6 border-b border-gray-700 last:border-0 last:pb-0">
                  <h3 className="text-white font-medium mb-1">{step.title}</h3>
                  <p className="text-gray-400 text-sm">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Driver Types */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Sofőr típusok</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="bg-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Céges (flotta) sofőr</h3>
            <p className="text-gray-400 text-sm mb-3">
              Partner céghez tartozó sofőr. A mosásokat a cég fizeti, a sofőrnek nem kell fizetnie.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">Céges számlázás</span>
              <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">Nem kell fizetni</span>
            </div>
          </div>
          <div className="bg-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Privát sofőr</h3>
            <p className="text-gray-400 text-sm mb-3">
              Egyéni sofőr, aki saját maga fizeti a mosásokat készpénzzel vagy kártyával.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm">Azonnali fizetés</span>
              <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm">Készpénz/kártya</span>
            </div>
          </div>
        </div>
      </div>

      {/* PWA Install */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Telepítés telefonra</h2>
        <div className="bg-gray-800 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <DevicePhoneMobileIcon className="w-10 h-10 text-purple-400 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">PWA telepítése</h3>
              <p className="text-gray-400 text-sm mb-4">
                Az alkalmazás telepíthető a telefon kezdőképernyőjére:
              </p>
              <ol className="space-y-2 text-gray-300 text-sm">
                <li><strong>iPhone:</strong> Safari → Megosztás → "Kezdőképernyőhöz adás"</li>
                <li><strong>Android:</strong> Chrome → Menü → "Alkalmazás telepítése"</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-8 border-t border-gray-800">
        <Link
          href="/docs/operator"
          className="text-gray-400 hover:text-white flex items-center gap-2"
        >
          ← Operátor
        </Link>
        <Link
          href="/docs/partner"
          className="text-purple-400 hover:text-purple-300 flex items-center gap-2"
        >
          Partner →
        </Link>
      </div>
    </div>
  )
}
