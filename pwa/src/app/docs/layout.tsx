'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  HomeIcon,
  BuildingOffice2Icon,
  BuildingStorefrontIcon,
  WrenchScrewdriverIcon,
  TruckIcon,
  UserGroupIcon,
  Bars3Icon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { useState } from 'react'

const navigation = [
  { name: 'Áttekintés', href: '/docs', icon: HomeIcon },
  { name: 'Platform Admin', href: '/docs/platform-admin', icon: BuildingOffice2Icon },
  { name: 'Hálózat Admin', href: '/docs/network-admin', icon: BuildingStorefrontIcon },
  { name: 'Operátor', href: '/docs/operator', icon: WrenchScrewdriverIcon },
  { name: 'Sofőr', href: '/docs/driver', icon: TruckIcon },
  { name: 'Partner', href: '/docs/partner', icon: UserGroupIcon },
]

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Mobile sidebar toggle */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700"
        >
          {sidebarOpen ? (
            <XMarkIcon className="w-6 h-6" />
          ) : (
            <Bars3Icon className="w-6 h-6" />
          )}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-72 bg-gray-800 transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-6 border-b border-gray-700">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg">V</span>
            </div>
            <div>
              <h1 className="text-white font-bold text-lg">vSys Wash</h1>
              <p className="text-gray-400 text-sm">Dokumentáció</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== '/docs' && pathname?.startsWith(item.href))
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
                    ${isActive
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'}
                  `}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-700">
            <Link
              href="/"
              className="text-gray-400 hover:text-white text-sm flex items-center gap-2"
            >
              ← Vissza az alkalmazásba
            </Link>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="lg:pl-72">
        <div className="max-w-4xl mx-auto px-6 py-12 lg:py-16">
          {children}
        </div>
      </main>
    </div>
  )
}
