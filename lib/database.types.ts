/**
 * Unified Database Types — Model A
 *
 * Canonical tables: applicants → submissions → evaluations + integrity_events
 * This file MUST mirror db/schema.sql exactly.
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type ApplicantStatus = 'pending' | 'grading' | 'completed' | 'error'

export interface Database {
  public: {
    Tables: {
      applicants: {
        Row: {
          id: string
          user_id: string | null
          name: string
          email: string
          github_url: string
          language: string
          status: ApplicantStatus
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          name: string
          email: string
          github_url: string
          language: string
          status?: ApplicantStatus
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          name?: string
          email?: string
          github_url?: string
          language?: string
          status?: ApplicantStatus
          created_at?: string
        }
        Relationships: []
      }
      submissions: {
        Row: {
          id: string
          applicant_id: string
          repo_url: string
          raw_code_text: string | null
          submitted_at: string
        }
        Insert: {
          id?: string
          applicant_id: string
          repo_url: string
          raw_code_text?: string | null
          submitted_at?: string
        }
        Update: {
          id?: string
          applicant_id?: string
          repo_url?: string
          raw_code_text?: string | null
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'submissions_applicant_id_fkey'
            columns: ['applicant_id']
            isOneToOne: false
            referencedRelation: 'applicants'
            referencedColumns: ['id']
          }
        ]
      }
      evaluations: {
        Row: {
          id: string
          submission_id: string
          overall_score: number | null
          criteria_scores: Json
          ai_summary: string | null
          vulnerabilities: Json
          evaluated_at: string
        }
        Insert: {
          id?: string
          submission_id: string
          overall_score?: number | null
          criteria_scores?: Json
          ai_summary?: string | null
          vulnerabilities?: Json
          evaluated_at?: string
        }
        Update: {
          id?: string
          submission_id?: string
          overall_score?: number | null
          criteria_scores?: Json
          ai_summary?: string | null
          vulnerabilities?: Json
          evaluated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'evaluations_submission_id_fkey'
            columns: ['submission_id']
            isOneToOne: false
            referencedRelation: 'submissions'
            referencedColumns: ['id']
          }
        ]
      }
      integrity_events: {
        Row: {
          id: string
          user_id: string
          type: string
          payload: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          payload?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          payload?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      roster: {
        Row: {
          id: string
          usn: string
          name: string
          email: string
          batch: string | null
          is_active: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          usn: string
          name: string
          email: string
          batch?: string | null
          is_active?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          usn?: string
          name?: string
          email?: string
          batch?: string | null
          is_active?: boolean | null
          created_at?: string | null
        }
        Relationships: []
      }
      verification_codes: {
        Row: {
          id: string
          usn: string
          code_hash: string
          expires_at: string
          used_at: string | null
          attempt_count: number | null
          created_at: string | null
        }
        Insert: {
          id: string
          usn: string
          code_hash: string
          expires_at: string
          used_at?: string | null
          attempt_count?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          usn?: string
          code_hash?: string
          expires_at?: string
          used_at?: string | null
          attempt_count?: number | null
          created_at?: string | null
        }
        Relationships: []
      }
      applications: {
        Row: {
          id: string
          roster_id: string | null
          user_id: string | null
          status: string
          problem_version: string | null
          verified_at: string | null
          submitted_at: string | null
          withdrawn_at: string | null
          edit_deadline: string | null
          created_at: string | null
        }
        Insert: {
          id: string
          roster_id?: string | null
          user_id?: string | null
          status: string
          problem_version?: string | null
          verified_at?: string | null
          submitted_at?: string | null
          withdrawn_at?: string | null
          edit_deadline?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          roster_id?: string | null
          user_id?: string | null
          status?: string
          problem_version?: string | null
          verified_at?: string | null
          submitted_at?: string | null
          withdrawn_at?: string | null
          edit_deadline?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_roster_id_fkey"
            columns: ["roster_id"]
            isOneToOne: false
            referencedRelation: "roster"
            referencedColumns: ["id"]
          }
        ]
      }
      projects: {
        Row: {
          id: string
          application_id: string | null
          slot: number
          repo_url: string
          fetch_status: string | null
          fetch_error: string | null
          last_checked_at: string | null
        }
        Insert: {
          id: string
          application_id?: string | null
          slot: number
          repo_url: string
          fetch_status?: string | null
          fetch_error?: string | null
          last_checked_at?: string | null
        }
        Update: {
          id?: string
          application_id?: string | null
          slot?: number
          repo_url?: string
          fetch_status?: string | null
          fetch_error?: string | null
          last_checked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          }
        ]
      }
      audit_log: {
        Row: {
          id: string
          application_id: string | null
          actor_usn: string | null
          actor_user_id: string | null
          action: string
          payload: Json | null
          created_at: string | null
        }
        Insert: {
          id: string
          application_id?: string | null
          actor_usn?: string | null
          actor_user_id?: string | null
          action: string
          payload?: Json | null
          created_at?: string | null
        }
        Update: {
          id?: string
          application_id?: string | null
          actor_usn?: string | null
          actor_user_id?: string | null
          action?: string
          payload?: Json | null
          created_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      applicant_status: ApplicantStatus
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
