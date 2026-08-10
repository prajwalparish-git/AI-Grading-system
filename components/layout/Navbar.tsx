'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

const NAV_ITEMS = [
  {
    name: 'Login',
    href: '/login',
  },
  {
    name: 'Apply for the Program',
    href: '/apply',
  },
]

export function Navbar() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Brand */}
          <div className="flex items-center">
            <Link 
              href="/" 
              className="flex items-center space-x-2 text-slate-900 hover:text-slate-600 transition-colors"
            >
              <div className="font-semibold text-lg tracking-tight">
                Coding Club
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-6">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname?.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-blue-600'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* Mobile Menu Trigger */}
          <div className="flex md:hidden items-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-slate-600 hover:text-slate-900"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>

        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 bg-white px-4 py-4 space-y-3">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname?.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{item.name}</span>
                <ArrowRight className="h-4 w-4 opacity-50" />
              </Link>
            )
          })}
        </div>
      )}
    </header>
  )
}
