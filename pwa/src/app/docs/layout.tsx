'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
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
import { useState, useEffect, Suspense } from 'react'
import {
  getAuthStatus,
  getSectionFromPath,
  buildDocsUrl,
  type DocSection,
  type PortalSource
} from '@/lib/docs-auth'

const allNavigation = [
  { name: 'Áttekintés', section: 'overview' as DocSection, icon: HomeIcon },
  { name: 'Platform Admin', section: 'platform-admin' as DocSection, icon: BuildingOffice2Icon },
  { name: 'Hálózat Admin', section: 'network-admin' as DocSection, icon: BuildingStorefrontIcon },
  { name: 'Operátor', section: 'operator' as DocSection, icon: WrenchScrewdriverIcon },
  { name: 'Sofőr', section: 'driver' as DocSection, icon: TruckIcon },
  { name: 'Partner', section: 'partner' as DocSection, icon: UserGroupIcon },
]

// Portal access mapping (duplicated here for direct access)
const PORTAL_ACCESS: Record<string, DocSection[]> = {
  'platform': ['overview', 'platform-admin', 'network-admin', 'operator', 'driver', 'partner'],
  'network': ['overview', 'network-admin', 'operator', 'driver', 'partner'],
  'operator': ['operator'],
  'partner': ['partner'],
  'driver': ['driver'],
}

const BACK_LINKS: Record<string, string> = {
  'platform': '/platform-admin/dashboard',
  'network': '/network-admin/dashboard',
  'operator': '/operator-portal/dashboard',
  'partner': '/partner/dashboard',
  'driver': '/dashboard',
}

const LOGIN_PAGES: Record<string, string> = {
  'platform': '/platform-admin',
  'network': '/network-admin',
  'operator': '/operator-portal/login',
  'partner': '/partner/login',
  'driver': '/login',
}

// Inner component that handles the actual layout logic
function DocsLayoutInner({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [navigation, setNavigation] = useState<Array<{ name: string; section: DocSection; icon: typeof HomeIcon; href: string }>>([])
  const [portalSource, setPortalSource] = useState<PortalSource>(null)
  const [backLink, setBackLink] = useState('/')

  useEffect(() => {
    const checkAuth = () => {
      // CRITICAL: Get portal source DIRECTLY from URL search params
      // This is the ONLY source of truth - we use useSearchParams hook
      const fromParam = searchParams.get('from')

      // Validate the portal source
      const validPortals = ['platform', 'network', 'operator', 'partner', 'driver']
      const portal = (fromParam && validPortals.includes(fromParam)) ? fromParam as PortalSource : null

      setPortalSource(portal)

      // If no valid portal source in URL, redirect to login
      if (!portal) {
        router.push('/login')
        return
      }

      // Get allowed sections for this portal
      const allowedSections = PORTAL_ACCESS[portal] || []
      const currentSection = getSectionFromPath(pathname || '/docs')
      const portalBackLink = BACK_LINKS[portal] || '/'

      // Check if user has valid session for this portal
      const authStatus = getAuthStatus(portal)

      if (!authStatus.isAuthenticated) {
        const loginPage = LOGIN_PAGES[portal] || '/login'
        router.push(loginPage)
        return
      }

      // Set back link
      setBackLink(portalBackLink)

      // Check if user can access this section
      if (currentSection && !allowedSections.includes(currentSection)) {
        // Redirect to the first allowed section with portal param
        if (allowedSections.length > 0) {
          const firstAllowed = allowedSections[0]
          const redirectUrl = buildDocsUrl(firstAllowed, portal)
          router.push(redirectUrl)
        } else {
          router.push(portalBackLink)
        }
        return
      }

      // Filter navigation based on allowed sections and add hrefs with portal param
      const filteredNav = allNavigation
        .filter(item => allowedSections.includes(item.section))
        .map(item => ({
          ...item,
          href: buildDocsUrl(item.section, portal)
        }))

      setNavigation(filteredNav)
      setIsAuthorized(true)
      setIsLoading(false)
    }

    checkAuth()
  }, [pathname, router, searchParams])

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
              // Check if section matches (ignore query params)
              const currentSection = getSectionFromPath(pathname || '')
              const isActive = currentSection === item.section
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
            <button
              onClick={() => router.push(backLink)}
              className="text-gray-400 hover:text-white text-sm flex items-center gap-2 w-full"
            >
              <ArrowLeftOnRectangleIcon className="w-4 h-4" />
              Vissza az alkalmazásba
            </button>
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

// Wrapper component with Suspense for useSearchParams in getPortalSourceFromUrl
export default function DocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    }>
      <DocsLayoutInner>{children}</DocsLayoutInner>
    </Suspense>
  )
}
