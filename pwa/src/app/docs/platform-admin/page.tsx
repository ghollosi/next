'use client'

import Link from 'next/link'
import {
  BuildingOffice2Icon,
  ChartBarIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  ClipboardDocumentListIcon,
  PlusCircleIcon
} from '@heroicons/react/24/outline'
import { DashboardMockup, SystemArchitectureDiagram } from '@/components/docs/ScreenMockup'

const features = [
  {
    title: 'Dashboard',
    description: 'Áttekintés az összes hálózatról, statisztikák, bevételi adatok és hamarosan lejáró trial-ok.',
    icon: ChartBarIcon,
  },
  {
    title: 'Hálózatok kezelése',
    description: 'Új hálózatok létrehozása, meglévők szerkesztése, trial időszak kezelése.',
    icon: BuildingOffice2Icon,
  },
  {
    title: 'Platform beállítások',
    description: 'Árazás, email sablonok, SMS beállítások és egyéb rendszer-szintű konfigurációk.',
    icon: Cog6ToothIcon,
  },
  {
    title: 'Adminok kezelése',
    description: 'Platform adminisztrátorok hozzáadása és jogosultságkezelés.',
    icon: UserGroupIcon,
  },
  {
    title: 'Számlázás',
    description: 'Havi platform díjak kezelése, számlák generálása és nyomon követése.',
    icon: CurrencyDollarIcon,
  },
  {
    title: 'Audit napló',
    description: 'Minden rendszer-szintű művelet naplózása és visszakövetése.',
    icon: ClipboardDocumentListIcon,
  },
  {
    title: 'Riportok',
    description: 'Platform-szintű statisztikák és jelentések generálása.',
    icon: DocumentTextIcon,
  },
]

const menuItems = [
  { name: 'Dashboard', path: '/platform-admin/dashboard', description: 'Főoldal áttekintéssel' },
  { name: 'Hálózatok', path: '/platform-admin/networks', description: 'Hálózatok listája és kezelése' },
  { name: 'Számlázás', path: '/platform-admin/billing', description: 'Platform díjak számlázása' },
  { name: 'Audit napló', path: '/platform-admin/audit-logs', description: 'Rendszeresemények naplója' },
  { name: 'Adminok', path: '/platform-admin/admins', description: 'Platform adminisztrátorok' },
  { name: 'Beállítások', path: '/platform-admin/settings', description: 'Platform konfigurációk' },
]

export default function PlatformAdminDocsPage() {
  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center">
            <BuildingOffice2Icon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Platform Admin Panel</h1>
            <p className="text-gray-400">A legfelsőbb szintű kezelőfelület</p>
          </div>
        </div>
      </div>

      {/* Access Info */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-blue-400 mb-2">Elérés</h2>
        <p className="text-gray-300 mb-3">
          A Platform Admin panel a <code className="px-2 py-1 bg-gray-800 rounded text-blue-400">app.vemiax.com/platform-admin</code> címen érhető el.
        </p>
        <p className="text-gray-400 text-sm">
          Bejelentkezéshez Platform Owner vagy Platform Admin jogosultság szükséges.
        </p>
      </div>

      {/* Screenshot */}
      <div className="bg-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Dashboard képernyő</h2>
        </div>
        <div className="p-4">
          <DashboardMockup variant="platform" />
        </div>
      </div>

      {/* System Architecture */}
      <div className="bg-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Platform felépítése</h2>
        </div>
        <div className="p-6">
          <SystemArchitectureDiagram />
        </div>
      </div>

      {/* Description */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-4">Mire szolgál?</h2>
        <p className="text-gray-300 leading-relaxed">
          A Platform Admin Panel a vSys Wash rendszer legfelső szintű kezelőfelülete. Innen felügyelhetők
          az összes hálózat, kezelhetők a platform-szintű beállítások, és nyomon követhetők a bevételek.
          Ez a felület kizárólag a Platform Owner és Platform Admin felhasználók számára érhető el.
        </p>
      </div>

      {/* Features */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Főbb funkciók</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {features.map((feature) => (
            <div key={feature.title} className="bg-gray-800 rounded-xl p-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-5 h-5 text-blue-400" />
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
        <div className="bg-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-400">Menüpont</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-400">Leírás</th>
              </tr>
            </thead>
            <tbody>
              {menuItems.map((item, index) => (
                <tr key={item.name} className={index !== menuItems.length - 1 ? 'border-b border-gray-700' : ''}>
                  <td className="px-6 py-4">
                    <span className="text-white font-medium">{item.name}</span>
                  </td>
                  <td className="px-6 py-4 text-gray-400">{item.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* How to create network */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Új hálózat létrehozása</h2>
        <div className="bg-gray-800 rounded-xl p-6">
          <ol className="space-y-4">
            <li className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">1</span>
              <div>
                <p className="text-white font-medium">Kattints az "Új hálózat" gombra</p>
                <p className="text-gray-400 text-sm mt-1">A Dashboard vagy a Hálózatok oldalon található.</p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">2</span>
              <div>
                <p className="text-white font-medium">Add meg a hálózat adatait</p>
                <p className="text-gray-400 text-sm mt-1">Név, slug (URL azonosító), tulajdonos email címe.</p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">3</span>
              <div>
                <p className="text-white font-medium">Állítsd be a trial időszakot</p>
                <p className="text-gray-400 text-sm mt-1">Alapértelmezetten 14 nap, de módosítható.</p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">4</span>
              <div>
                <p className="text-white font-medium">Mentsd el a hálózatot</p>
                <p className="text-gray-400 text-sm mt-1">A rendszer automatikusan meghívót küld a tulajdonosnak.</p>
              </div>
            </li>
          </ol>
        </div>
      </div>

      {/* User Roles */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Felhasználói szerepkörök</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Platform Owner</h3>
            <p className="text-gray-300 text-sm mb-3">
              A rendszer tulajdonosa, teljes hozzáférés minden funkcióhoz.
            </p>
            <ul className="space-y-1 text-sm text-gray-400">
              <li>• Új hálózatok létrehozása</li>
              <li>• Platform beállítások módosítása</li>
              <li>• Adminok kezelése</li>
              <li>• Számlázás és pénzügyek</li>
            </ul>
          </div>
          <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Platform Admin</h3>
            <p className="text-gray-300 text-sm mb-3">
              Adminisztrátor, korlátozott platform-szintű hozzáférés.
            </p>
            <ul className="space-y-1 text-sm text-gray-400">
              <li>• Hálózatok megtekintése</li>
              <li>• Riportok és statisztikák</li>
              <li>• Audit napló megtekintése</li>
              <li>• Support feladatok</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-8 border-t border-gray-800">
        <Link
          href="/docs"
          className="text-gray-400 hover:text-white flex items-center gap-2"
        >
          ← Vissza az áttekintéshez
        </Link>
        <Link
          href="/docs/network-admin"
          className="text-blue-400 hover:text-blue-300 flex items-center gap-2"
        >
          Hálózat Admin →
        </Link>
      </div>
    </div>
  )
}
