'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  GitBranch,
  Mail,
  User,
  Code2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Cpu,
} from 'lucide-react';
import type { ProgrammingLanguage } from '@/lib/api/types';

const LANGUAGES: ProgrammingLanguage[] = ['TypeScript', 'Python', 'Rust', 'Go', 'C++', 'Java'];

export default function SubmitForm() {
  const router = useRouter();

  // State Management for inputs
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [language, setLanguage] = useState<ProgrammingLanguage>('TypeScript');

  // Loading, Error, and Success states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('Initializing submission...');
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    applicantId: string;
    evaluation: {
      overall_score: number;
      summary: string;
      vulnerabilitiesCount: number;
    };
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic frontend validation
    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!githubUrl.trim()) {
      setError('Please enter a public GitHub repository URL.');
      return;
    }

    const cleanedUrl = githubUrl.trim();
    if (!cleanedUrl.toLowerCase().includes('github.com/')) {
      setError('Invalid URL: Must be a valid GitHub repository URL (e.g. https://github.com/owner/repo).');
      return;
    }

    setIsSubmitting(true);
    setLoadingStep('Connecting to Supabase database...');

    try {
      // Step simulation for enhanced UX feedback during long AI grading cycle
      const stepTimer1 = setTimeout(() => {
        setLoadingStep('Fetching & parsing GitHub repository files...');
      }, 2500);

      const stepTimer2 = setTimeout(() => {
        setLoadingStep('Auditing code with Groq AI (Meta Llama 3)...');
      }, 7000);

      const stepTimer3 = setTimeout(() => {
        setLoadingStep('Evaluating 10 technical criteria & vulnerability scan...');
      }, 14000);

      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          applicantName: name.trim(),
          email: email.trim().toLowerCase(),
          githubUrl: cleanedUrl,
          language,
        }),
      });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to complete project grading submission.');
      }

      setSuccessResult({
        applicantId: data.applicantId,
        evaluation: {
          overall_score: data.evaluation?.overall_score ?? 0,
          summary: data.evaluation?.summary ?? 'Evaluation completed successfully.',
          vulnerabilitiesCount: Array.isArray(data.evaluation?.vulnerabilities)
            ? data.evaluation.vulnerabilities.length
            : 0,
        },
      });
    } catch (err: any) {
      console.error('[Submit Form Error]:', err);
      setError(err.message || 'An unexpected error occurred during submission. Please check your URL and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (successResult) {
    return (
      <Card className="border-emerald-500/30 bg-slate-900/90 text-slate-100 shadow-2xl backdrop-blur-sm">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <CardTitle className="text-2xl font-bold font-mono text-emerald-400">
            Evaluation Complete!
          </CardTitle>
          <CardDescription className="text-slate-400 font-mono text-xs">
            Applicant Record ID: <span className="text-slate-200">{successResult.applicantId}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-slate-400">Overall AI Score</span>
              <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-mono text-sm px-3 py-1 font-bold">
                {successResult.evaluation.overall_score} / 100
              </Badge>
            </div>
            <div className="border-t border-slate-800/80 pt-3">
              <p className="text-xs text-slate-300 leading-relaxed italic">
                "{successResult.evaluation.summary}"
              </p>
            </div>
            {successResult.evaluation.vulnerabilitiesCount > 0 && (
              <div className="flex items-center space-x-2 text-xs font-mono text-amber-400 pt-1">
                <AlertTriangle className="h-4 w-4" />
                <span>{successResult.evaluation.vulnerabilitiesCount} vulnerability finding(s) detected.</span>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button
            onClick={() => router.push(`/results/${successResult.applicantId}`)}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs h-10"
          >
            View Your Results <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setSuccessResult(null);
              setName('');
              setEmail('');
              setGithubUrl('');
            }}
            className="w-full border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 font-mono text-xs h-10"
          >
            Submit Another Project
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="border-slate-800 bg-slate-900/90 text-slate-100 shadow-2xl backdrop-blur-sm">
      <CardHeader className="space-y-1">
        <div className="flex items-center space-x-2">
          <Cpu className="h-5 w-5 text-indigo-400" />
          <CardTitle className="text-xl font-bold font-mono text-white">
            AI Automated Code Auditor
          </CardTitle>
        </div>
        <CardDescription className="text-slate-400 text-xs font-mono">
          Enter your applicant details and GitHub repository. Our Groq Meta Llama 3 engine will audit your code across 10 evaluation criteria.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {/* Applicant Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-medium text-slate-300 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-indigo-400" /> Full Name <span className="text-rose-400">*</span>
            </label>
            <Input
              type="text"
              required
              disabled={isSubmitting}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex Chen"
              className="bg-slate-950 border-slate-800 text-slate-100 focus:border-indigo-500 font-mono text-xs h-10"
            />
          </div>

          {/* Applicant Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-medium text-slate-300 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-indigo-400" /> Email Address <span className="text-rose-400">*</span>
            </label>
            <Input
              type="email"
              required
              disabled={isSubmitting}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex.chen@university.edu"
              className="bg-slate-950 border-slate-800 text-slate-100 focus:border-indigo-500 font-mono text-xs h-10"
            />
          </div>

          {/* GitHub Repository URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-medium text-slate-300 flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5 text-indigo-400" /> Public GitHub Repo URL <span className="text-rose-400">*</span>
            </label>
            <Input
              type="url"
              required
              disabled={isSubmitting}
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/username/project-repo"
              className="bg-slate-950 border-slate-800 text-slate-100 focus:border-indigo-500 font-mono text-xs h-10"
            />
          </div>

          {/* Programming Language Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-medium text-slate-300 flex items-center gap-1.5">
              <Code2 className="h-3.5 w-3.5 text-indigo-400" /> Primary Language <span className="text-rose-400">*</span>
            </label>
            <select
              disabled={isSubmitting}
              value={language}
              onChange={(e) => setLanguage(e.target.value as ProgrammingLanguage)}
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-mono text-slate-100 focus:border-indigo-500 focus:outline-none h-10"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 flex items-start space-x-2 text-xs font-mono text-rose-300">
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Loading Indicator */}
          {isSubmitting && (
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 space-y-3">
              <div className="flex items-center space-x-3">
                <Loader2 className="h-5 w-5 text-indigo-400 animate-spin shrink-0" />
                <div className="space-y-0.5">
                  <p className="text-xs font-mono font-bold text-indigo-300">
                    Grading Repository... Please wait
                  </p>
                  <p className="text-[11px] font-mono text-indigo-200/80">
                    {loadingStep}
                  </p>
                </div>
              </div>
              <div className="w-full bg-slate-950/60 rounded-full h-1.5 overflow-hidden">
                <div className="bg-indigo-500 h-full animate-pulse w-3/4 rounded-full"></div>
              </div>
              <p className="text-[10px] font-mono text-slate-400 text-center">
                AI evaluation typically takes 10–20 seconds to parse code & generate audit findings.
              </p>
            </div>
          )}
        </CardContent>

        <CardFooter className="pt-2">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs h-11 transition-all shadow-lg shadow-indigo-600/20"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Auditing Repository & Grading...
              </>
            ) : (
              <>
                Submit for AI Grading <Sparkles className="ml-2 h-4 w-4 text-indigo-300" />
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
