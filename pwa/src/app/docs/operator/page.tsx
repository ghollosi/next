'use client'

import Link from 'next/link'
import {
  WrenchScrewdriverIcon,
  QrCodeIcon,
  ClipboardDocumentCheckIcon,
  ChartBarIcon,
  CalendarDaysIcon,
  CurrencyDollarIcon,
  ClockIcon
} from '@heroicons/react/24/outline'
import { OperatorQueueMockup, WashFlowDiagram } from '@/components/docs/ScreenMockup'

const features = [
  {
    title: 'Mosás rögzítése',
    description: 'Új mosási esemény létrehozása rendszám alapján vagy sofőr által indított mosás kezelése.',
    icon: QrCodeIcon,
  },
  {
    title: 'Napi áttekintés',
    description: 'Mai mosások listája, státuszok, bevétel összesítő.',
    icon: ClipboardDocumentCheckIcon,
  },
  {
    title: 'Foglalások',
    description: 'Beérkező foglalások kezelése, időpontok jóváhagyása.',
    icon: CalendarDaysIcon,
  },
  {
    title: 'Statisztikák',
    description: 'Személyes teljesítmény, havi összesítők.',
    icon: ChartBarIcon,
  },
  {
    title: 'Számlázás',
    description: 'Alvállalkozói elszámolás megtekintése.',
    icon: CurrencyDollarIcon,
  },
]

const washSteps = [
  {
    step: 1,
    title: 'Rendszám megadása',
    description: 'Írd be a jármű rendszámát - a rendszer a korábbi mosások alapján javaslatot tesz a partner és járműadatokra.',
  },
  {
    step: 2,
    title: 'Ügyfél kiválasztása',
    description: 'Válaszd ki a partnert (szerződéses ügyfél) vagy add meg az ad-hoc ügyfél adatait.',
  },
  {
    step: 3,
    title: 'Szolgáltatás kiválasztása',
    description: 'Válaszd ki a kívánt mosási szolgáltatásokat és járműtípust.',
  },
  {
    step: 4,
    title: 'Mosás jóváhagyása',
    description: 'Hagyd jóvá a sorban várakozó mosást és indítsd el amikor sorra kerül.',
  },
  {
    step: 5,
    title: 'Mosás befejezése',
    description: 'Jelöld késznek a mosást - a rendszer automatikusan rögzíti az időpontot.',
  },
]

export default function OperatorDocsPage() {
  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 flex items-center justify-center">
            <WrenchScrewdriverIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Operátor Portál</h1>
            <p className="text-gray-400">Helyszíni mosó operátorok felülete</p>
          </div>
        </div>
      </div>

      {/* Access Info */}
      <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-orange-400 mb-2">Elérés</h2>
        <p className="text-gray-300 mb-3">
          Az Operátor Portál a <code className="px-2 py-1 bg-gray-800 rounded text-orange-400">app.vemiax.com/operator-portal</code> címen érhető el.
        </p>
        <p className="text-gray-400 text-sm">
          Bejelentkezés PIN kóddal történik, amelyet a hálózat admin állít be.
        </p>
      </div>

      {/* Screenshot */}
      <div className="bg-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Operátor Dashboard</h2>
        </div>
        <div className="p-4">
          <OperatorQueueMockup />
        </div>
      </div>

      {/* Wash Flow */}
      <div className="bg-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Mosási folyamat áttekintése</h2>
        </div>
        <div className="p-6">
          <WashFlowDiagram />
        </div>
      </div>

      {/* Description */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-4">Mire szolgál?</h2>
        <p className="text-gray-300 leading-relaxed">
          Az Operátor Portál a helyszínen dolgozó mosó operátorok számára készült egyszerűsített felület.
          A fő célja a mosási események gyors és hatékony rögzítése, a napi munka nyomon követése,
          és a foglalások kezelése. Mobilra optimalizált, könnyen kezelhető felület.
        </p>
      </div>

      {/* Features */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Főbb funkciók</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {features.map((feature) => (
            <div key={feature.title} className="bg-gray-800 rounded-xl p-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-5 h-5 text-orange-400" />
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

      {/* How to record a wash */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Mosás rögzítése - lépésről lépésre</h2>
        <div className="bg-gray-800 rounded-xl p-6">
          <div className="space-y-6">
            {washSteps.map((step, index) => (
              <div key={step.step} className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center text-white font-bold">
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

      {/* How it works */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Hogyan működik a rendszer?</h2>
        <div className="bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/30 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <QrCodeIcon className="w-12 h-12 text-orange-400 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Sofőr által indított mosás</h3>
              <p className="text-gray-300 text-sm mb-4">
                A sofőr a saját Vemiax alkalmazásával beolvassa a mosóhely QR kódját, majd kiválasztja
                a kívánt szolgáltatást. A mosási kérelem megjelenik az operátor képernyőjén, aki
                jóváhagyja és kezeli a sorrendet.
              </p>
              <h3 className="text-lg font-semibold text-white mb-2 mt-4">Operátor által rögzített mosás</h3>
              <p className="text-gray-300 text-sm mb-4">
                Az operátor közvetlenül is rögzíthet mosást: megadja a rendszámot, kiválasztja a partnert
                vagy ad-hoc ügyfelet, majd a szolgáltatásokat. A rendszer a korábbi mosások alapján
                javaslatot tesz az adatokra.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-black/20 rounded-full text-sm text-gray-300">Sofőr indítja</span>
                <span className="px-3 py-1 bg-black/20 rounded-full text-sm text-gray-300">Operátor rögzíti</span>
                <span className="px-3 py-1 bg-black/20 rounded-full text-sm text-gray-300">Rendszám alapú keresés</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Tippek és trükkök</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="bg-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <ClockIcon className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold text-white">Gyors műveletek</h3>
            </div>
            <p className="text-gray-400 text-sm">
              Használd a kezdőlapon lévő nagy "Új mosás" gombot a leggyorsabb rögzítéshez.
            </p>
          </div>
          <div className="bg-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <CalendarDaysIcon className="w-5 h-5 text-green-400" />
              <h3 className="font-semibold text-white">Foglalások</h3>
            </div>
            <p className="text-gray-400 text-sm">
              Ellenőrizd minden nap reggel a beérkező foglalásokat a zökkenőmentes munkavégzéshez.
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-8 border-t border-gray-800">
        <Link
          href="/docs/network-admin"
          className="text-gray-400 hover:text-white flex items-center gap-2"
        >
          ← Hálózat Admin
        </Link>
        <Link
          href="/docs/driver"
          className="text-orange-400 hover:text-orange-300 flex items-center gap-2"
        >
          Sofőr →
        </Link>
      </div>
    </div>
  )
}
