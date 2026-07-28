import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Grading System // Automated Code & Assessment Evaluation",
  description: "Developer-centric AI automated code grading platform powered by LLM evaluation pipelines.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={{ colorScheme: 'dark' }}
    >
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 selection:bg-blue-600/30 selection:text-blue-200">
        
        {/* Background ambient lighting and grid pattern */}
        <div className="fixed inset-0 bg-grid-pattern opacity-40 pointer-events-none z-0" />
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[400px] bg-radial-gradient pointer-events-none z-0" />

        {/* Global Developer Top Navigation Bar */}
        <Navbar />

        {/* Main Workspace Viewport */}
        <main className="flex-1 relative z-10 flex flex-col w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>

        {/* Minimal Footer */}
        <footer className="relative z-10 border-t border-slate-900 bg-slate-950/80 py-4 px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500 font-mono">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
            <div>AI Grading System Engine • Enterprise Pipeline</div>
            <div className="flex items-center space-x-4 text-[11px]">
              <span className="hover:text-slate-400 cursor-pointer">System Logs</span>
              <span>•</span>
              <span className="hover:text-slate-400 cursor-pointer">API Specs</span>
              <span>•</span>
              <span className="hover:text-slate-400 cursor-pointer">Security Protocol</span>
            </div>
          </div>
        </footer>

      </body>
    </html>
  );
}
