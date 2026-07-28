import React from 'react';
import SubmitForm from './SubmitForm';
import { Cpu, Terminal } from 'lucide-react';

export const metadata = {
  title: 'Submit Project — AI Grading System',
  description: 'Submit your coding project repository for automated AI evaluation and multi-criteria scoring.',
};

export default function SubmitPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 flex flex-col justify-center items-center relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="w-full max-w-xl mx-auto space-y-6 relative z-10">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-indigo-400 font-mono text-xs mb-2">
            <Terminal className="h-3.5 w-3.5" />
            <span>AI Automated Grading System // Phase 3</span>
          </div>
          <h1 className="text-3xl font-extrabold font-mono tracking-tight text-white flex items-center justify-center gap-2">
            Applicant Portal <Cpu className="h-6 w-6 text-indigo-400" />
          </h1>
          <p className="text-slate-400 text-xs font-mono max-w-md mx-auto">
            Submit your GitHub repository URL below. The AI auditor will clone, parse, and evaluate your code across 10 specific technical criteria.
          </p>
        </div>

        {/* Client Submission Form */}
        <SubmitForm />
      </div>
    </main>
  );
}
