import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Toaster } from "sonner";

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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 selection:bg-blue-200 selection:text-blue-900">
        <Toaster position="bottom-right" richColors />
        
        {/* Global Navigation Bar */}
        <Navbar />

        {/* Main Workspace Viewport */}
        <main className="flex-1 relative z-10 flex flex-col w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>

        {/* Minimal Footer */}
        <footer className="relative z-10 border-t border-slate-200 bg-white py-4 px-4 sm:px-6 lg:px-8 text-center text-sm text-slate-500">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
            <div>Coding Club Admissions System</div>
            <div className="flex items-center space-x-4">
              <span className="hover:text-slate-800 cursor-pointer">Help</span>
              <span>&middot;</span>
              <span className="hover:text-slate-800 cursor-pointer">Privacy</span>
            </div>
          </div>
        </footer>

      </body>
    </html>
  );
}
