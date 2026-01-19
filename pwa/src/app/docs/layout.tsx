'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  HomeIcon,
  BuildingOffice2Icon,
  BuildingStorefrontIcon,
  WrenchScrewdriverIcon,
  TruckIcon,
  UserGroupIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowLeftOnRectangleIcon
} from '@heroicons/react/24/outline'
import { useState, useEffect } from 'react'
import {
  getAuthStatus,
  getSectionFromPath,
  getLoginPageForSection,
  filterNavigationForRole,
  type DocSection
} from '@/lib/docs-auth'

const allNavigation = [
  { name: 'Áttekintés', href: '/docs', icon: HomeIcon, section: 'overview' as DocSection },
  { name: 'Platform Admin', href: '/docs/platform-admin', icon: BuildingOffice2Icon, section: 'platform-admin' as DocSection },
  { name: 'Hálózat Admin', href: '/docs/network-admin', icon: BuildingStorefrontIcon, section: 'network-admin' as DocSection },
  { name: 'Operátor', href: '/docs/operator', icon: WrenchScrewdriverIcon, section: 'operator' as DocSection },
  { name: 'Sofőr', href: '/docs/driver', icon: TruckIcon, section: 'driver' as DocSection },
  { name: 'Partner', href: '/docs/partner', icon: UserGroupIcon, section: 'partner' as DocSection },
]

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [navigation, setNavigation] = useState(allNavigation)

  useEffect(() => {
    const checkAuth = () => {
      const authStatus = getAuthStatus()
      const currentSection = getSectionFromPath(pathname || '/docs')

      // Check if user is authenticated
      if (!authStatus.isAuthenticated) {
        const loginPage = getLoginPageForSection(currentSection || 'overview')
        router.push(loginPage)
        return
      }

      // Check if user can access this section
      if (currentSection && !authStatus.allowedSections.includes(currentSection)) {
        // Redirect to the first allowed section
        if (authStatus.allowedSections.length > 0) {
          const firstAllowed = authStatus.allowedSections[0]
          if (firstAllowed === 'overview') {
            router.push('/docs')
          } else {
            router.push(`/docs/${firstAllowed}`)
          }
        } else {
          router.push('/login')
        }
        return
      }

      // Filter navigation based on role
      const filteredNav = allNavigation.filter(item =>
        authStatus.allowedSections.includes(item.section)
      )
      setNavigation(filteredNav)
      setIsAuthorized(true)
      setIsLoading(false)
    }

    checkAuth()
  }, [pathname, router])

  // Get back link based on user role
  const getBackLink = () => {
    const authStatus = getAuthStatus()
    switch (authStatus.role) {
      case 'PLATFORM_OWNER':
      case 'PLATFORM_ADMIN':
        return '/platform-admin/dashboard'
      case 'NETWORK_OWNER':
      case 'NETWORK_ADMIN':
      case 'NETWORK_CONTROLLER':
      case 'NETWORK_ACCOUNTANT':
        return '/network-admin/dashboard'
      case 'OPERATOR':
        return '/operator-portal/dashboard'
      case 'PARTNER':
        return '/partner/dashboard'
      case 'DRIVER':
        return '/dashboard'
      default:
        return '/'
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    )
  }

  if (!isAuthorized) {
    return null // Will redirect
  }

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
              href={getBackLink()}
              className="text-gray-400 hover:text-white text-sm flex items-center gap-2"
            >
              <ArrowLeftOnRectangleIcon className="w-4 h-4" />
              Vissza az alkalmazásba
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
