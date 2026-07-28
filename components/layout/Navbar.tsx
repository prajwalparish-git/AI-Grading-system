'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  Terminal, 
  Code2, 
  FileCheck2, 
  LayoutDashboard, 
  Cpu, 
  Sparkles, 
  Search, 
  Menu, 
  X, 
  Activity,
  User,
  ExternalLink,
  ChevronDown
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const NAV_ITEMS = [
  {
    name: 'Submit Code',
    href: '/submit',
    icon: Code2,
    badge: undefined,
  },
  {
    name: 'Results',
    href: '/results',
    icon: FileCheck2,
    badge: 'Live',
  },
  {
    name: 'Admin Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
    badge: undefined,
  },
]

export function Navbar() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full glass-nav backdrop-blur-xl border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Brand & System Status */}
          <div className="flex items-center space-x-6">
            <Link 
              href="/submit" 
              className="flex items-center space-x-3 group transition-transform active:scale-95"
            >
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 p-0.5 shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-all">
                <div className="h-full w-full bg-slate-950 rounded-[7px] flex items-center justify-center">
                  <Terminal className="h-4 w-4 text-blue-400 group-hover:text-blue-300 transition-colors" />
                </div>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-bold text-sm tracking-tight text-white group-hover:text-blue-400 transition-colors">
                    AI-GRADING<span className="text-blue-500">//</span>OS
                  </span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono border-blue-500/30 text-blue-400 bg-blue-500/10">
                    v1.0
                  </Badge>
                </div>
                <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  System Ready
                </span>
              </div>
            </Link>

            {/* Nav Divider */}
            <div className="hidden lg:block h-5 w-[1px] bg-slate-800" />

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center space-x-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon
                const isActive = pathname?.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-inner'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                    <span>{item.name}</span>
                    {item.badge && (
                      <Badge variant="success" className="text-[9px] px-1 py-0 h-4 font-mono">
                        {item.badge}
                      </Badge>
                    )}
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* Right Header Utilities: Telemetry, Quick Action, Profile */}
          <div className="hidden md:flex items-center space-x-3">
            
            {/* AI Engine Status Pill */}
            <div className="hidden lg:flex items-center space-x-2 px-2.5 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-[11px] font-mono text-slate-400">
              <Cpu className="h-3.5 w-3.5 text-indigo-400" />
              <span>Engine: <strong className="text-slate-200 font-semibold">Groq Llama-3.3</strong></span>
              <span className="text-slate-600">•</span>
              <Activity className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400 font-mono">142ms</span>
            </div>

            {/* Command Trigger Visual */}
            <button 
              className="flex items-center space-x-2 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-400 text-xs hover:border-slate-700 hover:text-slate-200 transition-all cursor-pointer"
              onClick={() => alert('Command palette (⌘K) trigger ready.')}
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden xl:inline text-[11px]">Quick Search</span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 border border-slate-700 text-slate-300 rounded shadow-sm">
                ⌘K
              </kbd>
            </button>

            {/* User Profile / Status */}
            <div className="flex items-center space-x-2 pl-2 border-l border-slate-800">
              <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-slate-800 to-slate-700 border border-slate-700 flex items-center justify-center text-slate-300">
                <User className="h-4 w-4" />
              </div>
              <div className="hidden xl:flex flex-col text-left">
                <span className="text-xs font-medium text-slate-200 leading-tight">Developer</span>
                <span className="text-[10px] font-mono text-slate-400 leading-tight">Student / Admin</span>
              </div>
            </div>

          </div>

          {/* Mobile Menu Trigger */}
          <div className="flex md:hidden items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-slate-400 hover:text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>

        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-800 bg-slate-950/95 backdrop-blur-2xl px-4 pt-2 pb-4 space-y-2">
          <div className="py-2 border-b border-slate-900">
            <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono">
              <Cpu className="h-3.5 w-3.5 text-indigo-400" />
              <span>Engine: Groq Llama-3.3 70B</span>
            </div>
          </div>
          <div className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive = pathname?.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium ${
                    isActive
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                      : 'text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className="h-4 w-4" />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <Badge variant="success" className="text-[10px] font-mono">
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </header>
  )
}
