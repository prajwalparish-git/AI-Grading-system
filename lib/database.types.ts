/**
 * Unified Database Types — Model A
 *
 * Canonical tables: applicants → submissions → evaluations
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
          name: string
          email: string
          github_url: string
          language: string
          status: ApplicantStatus
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          github_url: string
          language: string
          status?: ApplicantStatus
          created_at?: string
        }
        Update: {
          id?: string
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
          applicant_id: string
          type: string
          payload: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          applicant_id: string
          type: string
          payload?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          applicant_id?: string
          type?: string
          payload?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'integrity_events_applicant_id_fkey'
            columns: ['applicant_id']
            isOneToOne: false
            referencedRelation: 'applicants'
            referencedColumns: ['id']
          }
        ]
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
