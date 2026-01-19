'use client'

import Link from 'next/link'
import {
  BuildingStorefrontIcon,
  ChartBarIcon,
  MapPinIcon,
  TruckIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  Cog6ToothIcon,
  ClipboardDocumentListIcon
} from '@heroicons/react/24/outline'
import { DashboardMockup, SystemArchitectureDiagram } from '@/components/docs/ScreenMockup'

const features = [
  {
    title: 'Dashboard',
    description: 'Napi áttekintés: mosások száma, bevétel, aktív sofőrök, időjárás.',
    icon: ChartBarIcon,
  },
  {
    title: 'Helyszínek kezelése',
    description: 'Mosóhelyek létrehozása, szerkesztése, operátorok hozzárendelése.',
    icon: MapPinIcon,
  },
  {
    title: 'Sofőrök kezelése',
    description: 'Sofőr regisztrációk jóváhagyása, adatok kezelése, hozzáférések.',
    icon: TruckIcon,
  },
  {
    title: 'Partner cégek',
    description: 'Flotta partner cégek kezelése, szerződések, számlázási adatok.',
    icon: UserGroupIcon,
  },
  {
    title: 'Mosások áttekintése',
    description: 'Összes mosási esemény listázása, szűrése, exportálása.',
    icon: ClipboardDocumentListIcon,
  },
  {
    title: 'Számlázás',
    description: 'Számlák generálása, partner számlák kezelése, pénzügyi riportok.',
    icon: CurrencyDollarIcon,
  },
  {
    title: 'Árlista',
    description: 'Szolgáltatások árazása, akciók, partner kedvezmények.',
    icon: DocumentTextIcon,
  },
  {
    title: 'Foglalások',
    description: 'Időpontfoglalások kezelése, naptár nézet, kapacitás tervezés.',
    icon: CalendarDaysIcon,
  },
  {
    title: 'Riportok',
    description: 'Részletes statisztikák, grafikonok, exportálható jelentések.',
    icon: ChartBarIcon,
  },
  {
    title: 'Beállítások',
    description: 'Hálózat adatok, értesítések, integrációk konfigurálása.',
    icon: Cog6ToothIcon,
  },
]

const menuItems = [
  { name: 'Dashboard', path: '/network-admin/dashboard' },
  { name: 'Helyszínek', path: '/network-admin/locations' },
  { name: 'Sofőrök', path: '/network-admin/drivers' },
  { name: 'Partnerek', path: '/network-admin/partners' },
  { name: 'Mosások', path: '/network-admin/wash-events' },
  { name: 'Számlázás', path: '/network-admin/invoices' },
  { name: 'Árlista', path: '/network-admin/prices' },
  { name: 'Foglalások', path: '/network-admin/bookings' },
  { name: 'Riportok', path: '/network-admin/reports' },
  { name: 'Audit napló', path: '/network-admin/audit-logs' },
  { name: 'Beállítások', path: '/network-admin/settings' },
]

const userRoles = [
  {
    name: 'Network Owner',
    description: 'Hálózat tulajdonos, teljes hozzáférés a hálózat minden funkciójához.',
    permissions: ['Minden funkció', 'Adminok kezelése', 'Számlázás', 'Beállítások'],
    color: 'from-emerald-500 to-teal-600'
  },
  {
    name: 'Network Admin',
    description: 'Hálózat adminisztrátor, napi operatív feladatok kezelése.',
    permissions: ['Helyszínek kezelése', 'Sofőrök jóváhagyása', 'Mosások áttekintése', 'Riportok'],
    color: 'from-blue-500 to-cyan-600'
  },
  {
    name: 'Network Controller',
    description: 'Pénzügyi vezető, számlázás és pénzügyi riportok.',
    permissions: ['Számlázás', 'Pénzügyi riportok', 'Partner számlák', 'Export'],
    color: 'from-purple-500 to-pink-600'
  },
  {
    name: 'Network Accountant',
    description: 'Könyvelő, csak olvasási jog a pénzügyi adatokhoz.',
    permissions: ['Számlák megtekintése', 'Riportok olvasása', 'Export'],
    color: 'from-orange-500 to-amber-600'
  },
]

export default function NetworkAdminDocsPage() {
  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 flex items-center justify-center">
            <BuildingStorefrontIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Network Admin Panel</h1>
            <p className="text-gray-400">Hálózat adminisztrátorok kezelőfelülete</p>
          </div>
        </div>
      </div>

      {/* Access Info */}
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-emerald-400 mb-2">Elérés</h2>
        <p className="text-gray-300 mb-3">
          A Network Admin panel a <code className="px-2 py-1 bg-gray-800 rounded text-emerald-400">app.vemiax.com/network-admin</code> címen érhető el.
        </p>
        <p className="text-gray-400 text-sm">
          Bejelentkezéshez Network Owner, Admin, Controller vagy Accountant jogosultság szükséges.
        </p>
      </div>

      {/* Screenshot */}
      <div className="bg-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Dashboard képernyő</h2>
        </div>
        <div className="p-4">
          <DashboardMockup variant="network" />
        </div>
      </div>

      {/* System Architecture */}
      <div className="bg-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Rendszer felépítése</h2>
        </div>
        <div className="p-6">
          <SystemArchitectureDiagram />
        </div>
      </div>

      {/* Description */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-4">Mire szolgál?</h2>
        <p className="text-gray-300 leading-relaxed">
          A Network Admin Panel a hálózat tulajdonosok és adminisztrátorok fő kezelőfelülete.
          Itt kezelhetők a helyszínek, sofőrök, partner cégek, és itt követhetők nyomon a
          mosási események és a pénzügyi adatok. Ez a leggyakrabban használt admin felület a rendszerben.
        </p>
      </div>

      {/* Features */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Főbb funkciók</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {features.map((feature) => (
            <div key={feature.title} className="bg-gray-800 rounded-xl p-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-5 h-5 text-emerald-400" />
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
            {menuItems.map((item) => (
              <span key={item.name} className="px-4 py-2 bg-gray-700 rounded-lg text-gray-300 text-sm">
                {item.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* User Roles */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Felhasználói szerepkörök</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {userRoles.map((role) => (
            <div key={role.name} className={`bg-gradient-to-br ${role.color} bg-opacity-20 border border-white/10 rounded-xl p-6`}>
              <h3 className="text-lg font-semibold text-white mb-2">{role.name}</h3>
              <p className="text-gray-300 text-sm mb-3">{role.description}</p>
              <div className="flex flex-wrap gap-1">
                {role.permissions.map((perm) => (
                  <span key={perm} className="px-2 py-1 bg-black/20 rounded text-xs text-gray-200">
                    {perm}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Common Tasks */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Gyakori műveletek</h2>
        <div className="space-y-4">
          <div className="bg-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-3">Új helyszín létrehozása</h3>
            <ol className="space-y-2 text-gray-300 text-sm">
              <li>1. Navigálj a Helyszínek menüpontra</li>
              <li>2. Kattints az "Új helyszín" gombra</li>
              <li>3. Add meg a helyszín nevét, címét és kapacitását</li>
              <li>4. Rendeld hozzá az operátorokat</li>
              <li>5. Állítsd be a nyitvatartást</li>
              <li>6. Mentsd el a helyszínt</li>
            </ol>
          </div>

          <div className="bg-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-3">Sofőr jóváhagyása</h3>
            <ol className="space-y-2 text-gray-300 text-sm">
              <li>1. Navigálj a Sofőrök → Jóváhagyásra vár menüpontra</li>
              <li>2. Ellenőrizd a sofőr adatait és dokumentumait</li>
              <li>3. Kattints a "Jóváhagyás" gombra vagy utasítsd el indoklással</li>
              <li>4. A sofőr automatikusan értesítést kap</li>
            </ol>
          </div>

          <div className="bg-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-3">Számla generálása</h3>
            <ol className="space-y-2 text-gray-300 text-sm">
              <li>1. Navigálj a Számlázás menüpontra</li>
              <li>2. Válaszd ki az időszakot és a partnert</li>
              <li>3. Ellenőrizd a tételeket és az összeget</li>
              <li>4. Kattints a "Számla generálása" gombra</li>
              <li>5. A számla automatikusan kiküldésre kerül</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-8 border-t border-gray-800">
        <Link
          href="/docs/platform-admin"
          className="text-gray-400 hover:text-white flex items-center gap-2"
        >
          ← Platform Admin
        </Link>
        <Link
          href="/docs/operator"
          className="text-emerald-400 hover:text-emerald-300 flex items-center gap-2"
        >
          Operátor →
        </Link>
      </div>
    </div>
  )
}
