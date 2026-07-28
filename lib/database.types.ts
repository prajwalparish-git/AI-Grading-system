export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string
          role: 'student' | 'admin'
          cohort: string | null
          created_at: string
        }
        Insert: {
          id: string
          email: string
          name: string
          role?: 'student' | 'admin'
          cohort?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          role?: 'student' | 'admin'
          cohort?: string | null
          created_at?: string
        }
        Relationships: []
      }
      submissions: {
        Row: {
          id: string
          user_id: string
          repo_url: string
          demo_url: string | null
          answers: Json
          status: 'draft' | 'submitted' | 'graded'
          submitted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          repo_url: string
          demo_url?: string | null
          answers?: Json
          status?: 'draft' | 'submitted' | 'graded'
          submitted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          repo_url?: string
          demo_url?: string | null
          answers?: Json
          status?: 'draft' | 'submitted' | 'graded'
          submitted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'submissions_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      grades: {
        Row: {
          id: string
          submission_id: string
          criterion: string
          score: number
          max: number
          rationale: string | null
          model: string | null
          graded_at: string
        }
        Insert: {
          id?: string
          submission_id: string
          criterion: string
          score: number
          max: number
          rationale?: string | null
          model?: string | null
          graded_at?: string
        }
        Update: {
          id?: string
          submission_id?: string
          criterion?: string
          score?: number
          max?: number
          rationale?: string | null
          model?: string | null
          graded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'grades_submission_id_fkey'
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
          type: 'paste' | 'copy' | 'cut' | 'blur' | 'fast_paste'
          payload: Json | null
          at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: 'paste' | 'copy' | 'cut' | 'blur' | 'fast_paste'
          payload?: Json | null
          at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: 'paste' | 'copy' | 'cut' | 'blur' | 'fast_paste'
          payload?: Json | null
          at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'integrity_events_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
