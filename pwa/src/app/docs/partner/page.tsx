'use client'

import Link from 'next/link'
import {
  UserGroupIcon,
  TruckIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon
} from '@heroicons/react/24/outline'
import { PartnerPortalMockup } from '@/components/docs/ScreenMockup'

const features = [
  {
    title: 'Sofőrök kezelése',
    description: 'Céges sofőrök hozzáadása, szerkesztése, hozzáférés kezelése.',
    icon: TruckIcon,
  },
  {
    title: 'Mosási előzmények',
    description: 'A cég összes sofőrének mosási eseményei egy helyen.',
    icon: ClipboardDocumentListIcon,
  },
  {
    title: 'Számlák',
    description: 'Havi összesített számlák megtekintése és letöltése.',
    icon: DocumentTextIcon,
  },
  {
    title: 'Költség áttekintés',
    description: 'Havi költés, sofőrönkénti bontás, trendek.',
    icon: CurrencyDollarIcon,
  },
  {
    title: 'Statisztikák',
    description: 'Mosási gyakoriság, kedvenc helyszínek, szolgáltatás típusok.',
    icon: ChartBarIcon,
  },
]

const driverManagement = [
  {
    action: 'Új sofőr hozzáadása',
    steps: ['Partner portál megnyitása', 'Sofőrök → Új sofőr', 'Adatok megadása', 'Mentés'],
  },
  {
    action: 'Sofőr meghívása',
    steps: ['Sofőr kiválasztása a listából', 'Meghívó küldése', 'Sofőr telepíti az appot', 'Bejelentkezik a kapott kóddal'],
  },
  {
    action: 'Sofőr inaktiválása',
    steps: ['Sofőr kiválasztása', 'Szerkesztés', 'Státusz: Inaktív', 'Mentés'],
  },
]

export default function PartnerDocsPage() {
  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-pink-500 to-pink-600 flex items-center justify-center">
            <UserGroupIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Partner Portál</h1>
            <p className="text-gray-400">Flotta partner cégek kezelőfelülete</p>
          </div>
        </div>
      </div>

      {/* Access Info */}
      <div className="bg-pink-500/10 border border-pink-500/20 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-pink-400 mb-2">Elérés</h2>
        <p className="text-gray-300 mb-3">
          A Partner Portál a <code className="px-2 py-1 bg-gray-800 rounded text-pink-400">app.vemiax.com/partner</code> címen érhető el.
        </p>
        <p className="text-gray-400 text-sm">
          Bejelentkezés PIN kóddal történik, amelyet a hálózat admin állít be a partner regisztrálásakor.
        </p>
      </div>

      {/* Screenshot */}
      <div className="bg-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Partner Dashboard</h2>
        </div>
        <div className="p-4">
          <PartnerPortalMockup />
        </div>
      </div>

      {/* Description */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-4">Mire szolgál?</h2>
        <p className="text-gray-300 leading-relaxed">
          A Partner Portál a flotta partner cégek (pl. fuvarozó vállalatok) adminisztrátorai számára készült.
          Itt kezelhetik a céges sofőrjeiket, nyomon követhetik a mosási költségeket, és hozzáférhetnek
          a havi számlákhoz. A partner nem fizet közvetlenül a mosásokért - havonta összesített számlát kap.
        </p>
      </div>

      {/* Features */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Főbb funkciók</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {features.map((feature) => (
            <div key={feature.title} className="bg-gray-800 rounded-xl p-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-pink-500/20 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-5 h-5 text-pink-400" />
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

      {/* Menu Structure */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Menüstruktúra</h2>
        <div className="bg-gray-800 rounded-xl p-6">
          <div className="flex flex-wrap gap-2">
            {['Dashboard', 'Sofőrök', 'Mosások', 'Számlák', 'Beállítások'].map((item) => (
              <span key={item} className="px-4 py-2 bg-gray-700 rounded-lg text-gray-300 text-sm">
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Driver Management */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Sofőrkezelés</h2>
        <div className="space-y-4">
          {driverManagement.map((item) => (
            <div key={item.action} className="bg-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-3">{item.action}</h3>
              <div className="flex flex-wrap gap-2">
                {item.steps.map((step, index) => (
                  <div key={step} className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-pink-500/20 text-pink-400 rounded-full text-sm">
                      {index + 1}. {step}
                    </span>
                    {index < item.steps.length - 1 && (
                      <span className="text-gray-600">→</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Billing Info */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Számlázás</h2>
        <div className="bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-500/30 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <CurrencyDollarIcon className="w-12 h-12 text-pink-400 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Hogyan működik a számlázás?</h3>
              <ul className="space-y-2 text-gray-300 text-sm">
                <li>• A partner cég sofőrei mosatnak a hálózat helyszínein</li>
                <li>• A mosásokat a rendszer automatikusan rögzíti a partner fiókjában</li>
                <li>• Hónap végén a rendszer összesített számlát generál</li>
                <li>• A számla automatikusan kiküldésre kerül a partner email címére</li>
                <li>• A partner a megadott fizetési határidőig utalással fizet</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Driver Onboarding */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Sofőr beállítása</h2>
        <div className="bg-gray-800 rounded-xl p-6">
          <p className="text-gray-300 mb-4">
            A partner admin felelős a céges sofőrök regisztrálásáért és hozzáférésük kezeléséért:
          </p>
          <ol className="space-y-3 text-gray-300 text-sm">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-pink-500 flex items-center justify-center text-white text-xs font-bold">1</span>
              <span>Add hozzá az új sofőrt a rendszerben (Sofőrök → Új sofőr)</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-pink-500 flex items-center justify-center text-white text-xs font-bold">2</span>
              <span>Küldj meghívót a sofőrnek email-ben vagy SMS-ben</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-pink-500 flex items-center justify-center text-white text-xs font-bold">3</span>
              <span>A sofőr letölti a Vemiax alkalmazást és bejelentkezik a meghívó kóddal</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-pink-500 flex items-center justify-center text-white text-xs font-bold">4</span>
              <span>A sofőr ezután a mosóhelyek QR kódjait szkennelve indíthat mosást</span>
            </li>
          </ol>
        </div>
      </div>

      {/* Tips */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Tippek partnereknek</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="bg-gray-800 rounded-xl p-5">
            <h3 className="font-semibold text-white mb-2">Rendszeres ellenőrzés</h3>
            <p className="text-gray-400 text-sm">
              Havonta ellenőrizd a mosási listát, hogy minden tétel valós-e.
            </p>
          </div>
          <div className="bg-gray-800 rounded-xl p-5">
            <h3 className="font-semibold text-white mb-2">Inaktív sofőrök</h3>
            <p className="text-gray-400 text-sm">
              Ha egy sofőr már nem dolgozik nálad, inaktiváld a fiókját a visszaélések megelőzésére.
            </p>
          </div>
          <div className="bg-gray-800 rounded-xl p-5">
            <h3 className="font-semibold text-white mb-2">Hozzáférés biztonság</h3>
            <p className="text-gray-400 text-sm">
              A sofőr bejelentkezési adatait bizalmasan kezeld. Kilépés esetén azonnal inaktiváld.
            </p>
          </div>
          <div className="bg-gray-800 rounded-xl p-5">
            <h3 className="font-semibold text-white mb-2">Költségkontroll</h3>
            <p className="text-gray-400 text-sm">
              Kövesd nyomon a havi költéseket sofőrönkénti bontásban a Dashboard-on.
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-8 border-t border-gray-800">
        <Link
          href="/docs/driver"
          className="text-gray-400 hover:text-white flex items-center gap-2"
        >
          ← Sofőr
        </Link>
        <Link
          href="/docs"
          className="text-pink-400 hover:text-pink-300 flex items-center gap-2"
        >
          Vissza az áttekintéshez →
        </Link>
      </div>
    </div>
  )
}
