import Image from 'next/image'
import Link from 'next/link'
import {
  BuildingOffice2Icon,
  BuildingStorefrontIcon,
  WrenchScrewdriverIcon,
  TruckIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline'

const features = [
  {
    title: 'Platform Admin',
    description: 'A legfelsőbb szintű kezelőfelület a teljes rendszer felügyeletéhez.',
    href: '/docs/platform-admin',
    icon: BuildingOffice2Icon,
    color: 'from-blue-500 to-blue-600'
  },
  {
    title: 'Hálózat Admin',
    description: 'Hálózat tulajdonosok és adminisztrátorok kezelőfelülete.',
    href: '/docs/network-admin',
    icon: BuildingStorefrontIcon,
    color: 'from-emerald-500 to-emerald-600'
  },
  {
    title: 'Operátor',
    description: 'Helyszíni mosó operátorok napi munkavégzéséhez.',
    href: '/docs/operator',
    icon: WrenchScrewdriverIcon,
    color: 'from-orange-500 to-orange-600'
  },
  {
    title: 'Sofőr',
    description: 'Sofőrök számára mosás indítás és előzmények.',
    href: '/docs/driver',
    icon: TruckIcon,
    color: 'from-purple-500 to-purple-600'
  },
  {
    title: 'Partner',
    description: 'Partner cégek sofőr- és számla kezelése.',
    href: '/docs/partner',
    icon: UserGroupIcon,
    color: 'from-pink-500 to-pink-600'
  },
]

const systemLevels = [
  {
    level: 'Platform szint',
    description: 'A legfelső szint, ahol a Platform Owner/Admin felügyeli az összes hálózatot és a teljes rendszert.',
    items: ['Platform Owner', 'Platform Admin']
  },
  {
    level: 'Hálózat szint',
    description: 'Minden hálózat (Network) egy önálló mosóvállalkozás, saját helyszínekkel, partnerekkel és sofőrökkel.',
    items: ['Network Owner', 'Network Admin', 'Network Controller', 'Network Accountant']
  },
  {
    level: 'Helyszín szint',
    description: 'A konkrét mosóállomások (Locations), ahol az operátorok dolgoznak és a mosási események történnek.',
    items: ['Location Operator', 'Driver', 'Partner Admin']
  },
]

const benefits = [
  'Teljes körű mosási nyilvántartás',
  'Automatizált számlázás',
  'Valós idejű statisztikák',
  'Többszintű jogosultságkezelés',
  'Mobilbarát felület',
  'QR-kódos azonosítás',
]

export default function DocsOverviewPage() {
  return (
    <div className="space-y-16">
      {/* Hero */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 text-blue-400 text-sm font-medium mb-6">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
          Dokumentáció
        </div>
        <h1 className="text-4xl lg:text-5xl font-bold text-white mb-6">
          vSys Wash Platform
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          Modern, felhő alapú szoftverplatform kamion- és autómosó hálózatok teljes körű kezelésére.
        </p>
      </div>

      {/* System Architecture Image */}
      <div className="bg-gray-800 rounded-2xl p-6 lg:p-8">
        <h2 className="text-2xl font-bold text-white mb-6">Rendszer áttekintés</h2>
        <div className="relative aspect-video bg-gray-900 rounded-xl overflow-hidden">
          {/* Placeholder - ide jön majd a rendszer architektúra kép */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <BuildingOffice2Icon className="w-12 h-12 text-white" />
              </div>
              <p className="text-gray-400">Rendszer architektúra</p>
            </div>
          </div>
        </div>
      </div>

      {/* What is vSys */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Mi a vSys?</h2>
        <div className="prose prose-invert max-w-none">
          <p className="text-gray-300 text-lg leading-relaxed">
            A vSys Wash egy modern, felhő alapú szoftverplatform kamion- és autómosó hálózatok
            teljes körű kezelésére. A rendszer lehetővé teszi a mosási műveletek digitális
            nyilvántartását, az ügyfelek és sofőrök kezelését, az időpontfoglalást, valamint
            az automatizált számlázást.
          </p>
        </div>
      </div>

      {/* System Levels */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">A rendszer felépítése</h2>
        <p className="text-gray-400 mb-8">
          A vSys egy többszintű, multi-tenant SaaS platform, amely hierarchikus jogosultsági rendszert alkalmaz.
        </p>
        <div className="space-y-4">
          {systemLevels.map((level, index) => (
            <div key={level.level} className="bg-gray-800 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">{level.level}</h3>
                  <p className="text-gray-400 mb-3">{level.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {level.items.map((item) => (
                      <span key={item} className="px-3 py-1 bg-gray-700 rounded-full text-sm text-gray-300">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Portal Cards */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Főbb portálok és felületek</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {features.map((feature) => (
            <Link
              key={feature.title}
              href={feature.href}
              className="group bg-gray-800 rounded-xl p-6 hover:bg-gray-750 transition-all hover:scale-[1.02]"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${feature.color} flex items-center justify-center mb-4`}>
                <feature.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                {feature.title}
                <ArrowRightIcon className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </h3>
              <p className="text-gray-400 text-sm">{feature.description}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Benefits */}
      <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-2xl p-8">
        <h2 className="text-2xl font-bold text-white mb-6">A rendszer előnyei</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {benefits.map((benefit) => (
            <div key={benefit} className="flex items-center gap-3">
              <CheckCircleIcon className="w-5 h-5 text-green-400 flex-shrink-0" />
              <span className="text-gray-300">{benefit}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="text-center py-8">
        <p className="text-gray-400 mb-4">
          Válaszd ki a felhasználói típusodat a bal oldali menüből a részletes dokumentációért.
        </p>
        <Link
          href="/docs/platform-admin"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-xl hover:from-blue-500 hover:to-purple-500 transition-all"
        >
          Kezdés a Platform Admin-nal
          <ArrowRightIcon className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}
