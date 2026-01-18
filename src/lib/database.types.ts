export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      bank_transactions: {
        Row: {
          account_last_four: string | null
          amount: number
          balance: number | null
          bank_name: string | null
          created_at: string | null
          description: string
          id: string
          import_batch_id: string | null
          is_reconciled: boolean | null
          reconciled_expense_id: string | null
          reconciled_invoice_id: string | null
          reference: string | null
          transaction_date: string
          transaction_type: string | null
          user_id: string
        }
        Insert: {
          account_last_four?: string | null
          amount: number
          balance?: number | null
          bank_name?: string | null
          created_at?: string | null
          description: string
          id?: string
          import_batch_id?: string | null
          is_reconciled?: boolean | null
          reconciled_expense_id?: string | null
          reconciled_invoice_id?: string | null
          reference?: string | null
          transaction_date: string
          transaction_type?: string | null
          user_id: string
        }
        Update: {
          account_last_four?: string | null
          amount?: number
          balance?: number | null
          bank_name?: string | null
          created_at?: string | null
          description?: string
          id?: string
          import_batch_id?: string | null
          is_reconciled?: boolean | null
          reconciled_expense_id?: string | null
          reconciled_invoice_id?: string | null
          reference?: string | null
          transaction_date?: string
          transaction_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_reconciled_expense_id_fkey"
            columns: ["reconciled_expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_reconciled_invoice_id_fkey"
            columns: ["reconciled_invoice_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          company: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          company?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          company?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          color: string | null
          created_at: string | null
          display_order: number | null
          icon: string | null
          id: string
          is_default: boolean | null
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string | null
          created_at: string | null
          description: string | null
          expense_date: string
          id: string
          is_reconciled: boolean | null
          job_pack_id: string | null
          payment_method: string | null
          receipt_extracted_text: string | null
          receipt_storage_path: string | null
          reconciled_transaction_id: string | null
          updated_at: string | null
          user_id: string
          vat_amount: number | null
          vendor: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          is_reconciled?: boolean | null
          job_pack_id?: string | null
          payment_method?: string | null
          receipt_extracted_text?: string | null
          receipt_storage_path?: string | null
          reconciled_transaction_id?: string | null
          updated_at?: string | null
          user_id: string
          vat_amount?: number | null
          vendor: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          is_reconciled?: boolean | null
          job_pack_id?: string | null
          payment_method?: string | null
          receipt_extracted_text?: string | null
          receipt_storage_path?: string | null
          reconciled_transaction_id?: string | null
          updated_at?: string | null
          user_id?: string
          vat_amount?: number | null
          vendor?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_job_pack_id_fkey"
            columns: ["job_pack_id"]
            isOneToOne: false
            referencedRelation: "job_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      filed_documents: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          document_date: string | null
          expense_id: string | null
          expiry_date: string | null
          extracted_text: string | null
          file_size: number | null
          file_type: string | null
          id: string
          job_pack_id: string | null
          name: string
          payable_id: string | null
          storage_path: string
          tags: string[] | null
          tax_year: string | null
          updated_at: string | null
          user_id: string
          vendor_name: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          document_date?: string | null
          expense_id?: string | null
          expiry_date?: string | null
          extracted_text?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          job_pack_id?: string | null
          name: string
          payable_id?: string | null
          storage_path: string
          tags?: string[] | null
          tax_year?: string | null
          updated_at?: string | null
          user_id: string
          vendor_name?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          document_date?: string | null
          expense_id?: string | null
          expiry_date?: string | null
          extracted_text?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          job_pack_id?: string | null
          name?: string
          payable_id?: string | null
          storage_path?: string
          tags?: string[] | null
          tax_year?: string | null
          updated_at?: string | null
          user_id?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "filed_documents_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filed_documents_job_pack_id_fkey"
            columns: ["job_pack_id"]
            isOneToOne: false
            referencedRelation: "job_packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filed_documents_payable_id_fkey"
            columns: ["payable_id"]
            isOneToOne: false
            referencedRelation: "payables"
            referencedColumns: ["id"]
          },
        ]
      }
      job_packs: {
        Row: {
          created_at: string | null
          customer_id: string | null
          id: string
          notepad: string | null
          status: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          id?: string
          notepad?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          id?: string
          notepad?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_packs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      materials_import_history: {
        Row: {
          filename: string | null
          id: string
          imported_at: string | null
          items_failed: number | null
          items_imported: number | null
          items_updated: number | null
          supplier: string | null
          user_id: string
        }
        Insert: {
          filename?: string | null
          id?: string
          imported_at?: string | null
          items_failed?: number | null
          items_imported?: number | null
          items_updated?: number | null
          supplier?: string | null
          user_id: string
        }
        Update: {
          filename?: string | null
          id?: string
          imported_at?: string | null
          items_failed?: number | null
          items_imported?: number | null
          items_updated?: number | null
          supplier?: string | null
          user_id?: string
        }
        Relationships: []
      }
      materials_library: {
        Row: {
          category: string | null
          cost_price: number | null
          created_at: string | null
          description: string | null
          id: string
          is_favourite: boolean | null
          last_updated: string | null
          name: string
          product_code: string | null
          sell_price: number | null
          supplier: string | null
          unit: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_favourite?: boolean | null
          last_updated?: string | null
          name: string
          product_code?: string | null
          sell_price?: number | null
          supplier?: string | null
          unit?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_favourite?: boolean | null
          last_updated?: string | null
          name?: string
          product_code?: string | null
          sell_price?: number | null
          supplier?: string | null
          unit?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payables: {
        Row: {
          amount: number
          amount_paid: number | null
          category: string | null
          created_at: string | null
          description: string | null
          document_path: string | null
          due_date: string | null
          id: string
          invoice_date: string
          invoice_number: string | null
          is_reconciled: boolean | null
          job_pack_id: string | null
          notes: string | null
          paid_date: string | null
          reconciled_transaction_id: string | null
          status: string | null
          updated_at: string | null
          user_id: string
          vat_amount: number | null
          vendor_id: string | null
          vendor_name: string
        }
        Insert: {
          amount: number
          amount_paid?: number | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          document_path?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string | null
          is_reconciled?: boolean | null
          job_pack_id?: string | null
          notes?: string | null
          paid_date?: string | null
          reconciled_transaction_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
          vat_amount?: number | null
          vendor_id?: string | null
          vendor_name: string
        }
        Update: {
          amount?: number
          amount_paid?: number | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          document_path?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string | null
          is_reconciled?: boolean | null
          job_pack_id?: string | null
          notes?: string | null
          paid_date?: string | null
          reconciled_transaction_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
          vat_amount?: number | null
          vendor_id?: string | null
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "payables_job_pack_id_fkey"
            columns: ["job_pack_id"]
            isOneToOne: false
            referencedRelation: "job_packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_reconciled_transaction_id_fkey"
            columns: ["reconciled_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_reconciled_transaction_id_fkey"
            columns: ["reconciled_transaction_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_summary"
            referencedColumns: ["transaction_id"]
          },
          {
            foreignKeyName: "payables_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      project_materials: {
        Row: {
          created_at: string | null
          delivered_qty: number | null
          id: string
          job_pack_id: string
          name: string
          ordered_qty: number | null
          quoted_qty: number | null
          status: string | null
          unit: string | null
          updated_at: string | null
          used_qty: number | null
        }
        Insert: {
          created_at?: string | null
          delivered_qty?: number | null
          id?: string
          job_pack_id: string
          name: string
          ordered_qty?: number | null
          quoted_qty?: number | null
          status?: string | null
          unit?: string | null
          updated_at?: string | null
          used_qty?: number | null
        }
        Update: {
          created_at?: string | null
          delivered_qty?: number | null
          id?: string
          job_pack_id?: string
          name?: string
          ordered_qty?: number | null
          quoted_qty?: number | null
          status?: string | null
          unit?: string | null
          updated_at?: string | null
          used_qty?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_materials_job_pack_id_fkey"
            columns: ["job_pack_id"]
            isOneToOne: false
            referencedRelation: "job_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          amount_paid: number | null
          cis_percent: number | null
          created_at: string | null
          customer_id: string | null
          date: string | null
          discount_description: string | null
          discount_type: string | null
          discount_value: number | null
          display_options: Json | null
          due_date: string | null
          id: string
          job_address: string | null
          job_pack_id: string | null
          labour_rate: number | null
          markup_percent: number | null
          notes: string | null
          parent_quote_id: string | null
          part_payment_enabled: boolean | null
          part_payment_label: string | null
          part_payment_type: string | null
          part_payment_value: number | null
          payment_date: string | null
          payment_method: string | null
          reference_number: number | null
          sections: Json | null
          status: string | null
          tax_percent: number | null
          title: string
          type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount_paid?: number | null
          cis_percent?: number | null
          created_at?: string | null
          customer_id?: string | null
          date?: string | null
          discount_description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          display_options?: Json | null
          due_date?: string | null
          id?: string
          job_address?: string | null
          job_pack_id?: string | null
          labour_rate?: number | null
          markup_percent?: number | null
          notes?: string | null
          parent_quote_id?: string | null
          part_payment_enabled?: boolean | null
          part_payment_label?: string | null
          part_payment_type?: string | null
          part_payment_value?: number | null
          payment_date?: string | null
          payment_method?: string | null
          reference_number?: number | null
          sections?: Json | null
          status?: string | null
          tax_percent?: number | null
          title: string
          type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount_paid?: number | null
          cis_percent?: number | null
          created_at?: string | null
          customer_id?: string | null
          date?: string | null
          discount_description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          display_options?: Json | null
          due_date?: string | null
          id?: string
          job_address?: string | null
          job_pack_id?: string | null
          labour_rate?: number | null
          markup_percent?: number | null
          notes?: string | null
          parent_quote_id?: string | null
          part_payment_enabled?: boolean | null
          part_payment_label?: string | null
          part_payment_type?: string | null
          part_payment_value?: number | null
          payment_date?: string | null
          payment_method?: string | null
          reference_number?: number | null
          sections?: Json | null
          status?: string | null
          tax_percent?: number | null
          title?: string
          type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_job_pack_id_fkey"
            columns: ["job_pack_id"]
            isOneToOne: false
            referencedRelation: "job_packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_parent_quote_id_fkey"
            columns: ["parent_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_links: {
        Row: {
          amount_matched: number | null
          bank_transaction_id: string
          created_at: string | null
          expense_id: string | null
          id: string
          invoice_id: string | null
          user_id: string
        }
        Insert: {
          amount_matched?: number | null
          bank_transaction_id: string
          created_at?: string | null
          expense_id?: string | null
          id?: string
          invoice_id?: string | null
          user_id: string
        }
        Update: {
          amount_matched?: number | null
          bank_transaction_id?: string
          created_at?: string | null
          expense_id?: string | null
          id?: string
          invoice_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_links_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_links_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_summary"
            referencedColumns: ["transaction_id"]
          },
          {
            foreignKeyName: "reconciliation_links_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_links_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_entries: {
        Row: {
          created_at: string | null
          customer_id: string | null
          description: string | null
          end_time: string
          id: string
          job_pack_id: string | null
          location: string | null
          start_time: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          description?: string | null
          end_time: string
          id?: string
          job_pack_id?: string | null
          location?: string | null
          start_time: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          description?: string | null
          end_time?: string
          id?: string
          job_pack_id?: string | null
          location?: string | null
          start_time?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_entries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_entries_job_pack_id_fkey"
            columns: ["job_pack_id"]
            isOneToOne: false
            referencedRelation: "job_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      site_documents: {
        Row: {
          created_at: string | null
          file_type: string | null
          id: string
          job_pack_id: string
          name: string
          storage_path: string
          summary: string | null
        }
        Insert: {
          created_at?: string | null
          file_type?: string | null
          id?: string
          job_pack_id: string
          name: string
          storage_path: string
          summary?: string | null
        }
        Update: {
          created_at?: string | null
          file_type?: string | null
          id?: string
          job_pack_id?: string
          name?: string
          storage_path?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_documents_job_pack_id_fkey"
            columns: ["job_pack_id"]
            isOneToOne: false
            referencedRelation: "job_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      site_notes: {
        Row: {
          created_at: string | null
          id: string
          is_voice: boolean | null
          job_pack_id: string
          text: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_voice?: boolean | null
          job_pack_id: string
          text: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_voice?: boolean | null
          job_pack_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_notes_job_pack_id_fkey"
            columns: ["job_pack_id"]
            isOneToOne: false
            referencedRelation: "job_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      site_photos: {
        Row: {
          caption: string | null
          created_at: string | null
          id: string
          is_drawing: boolean | null
          job_pack_id: string
          storage_path: string
          tags: string[] | null
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          id?: string
          is_drawing?: boolean | null
          job_pack_id: string
          storage_path: string
          tags?: string[] | null
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          id?: string
          is_drawing?: boolean | null
          job_pack_id?: string
          storage_path?: string
          tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "site_photos_job_pack_id_fkey"
            columns: ["job_pack_id"]
            isOneToOne: false
            referencedRelation: "job_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      support_requests: {
        Row: {
          admin_notes: string | null
          created_at: string | null
          id: string
          message: string
          resolved_at: string | null
          status: string
          title: string
          updated_at: string | null
          user_email: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string | null
          id?: string
          message: string
          resolved_at?: string | null
          status?: string
          title: string
          updated_at?: string | null
          user_email?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string | null
          id?: string
          message?: string
          resolved_at?: string | null
          status?: string
          title?: string
          updated_at?: string | null
          user_email?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          company_address: string | null
          company_logo_path: string | null
          company_name: string | null
          converted: boolean | null
          converted_at: string | null
          cost_box_color: string | null
          created_at: string | null
          default_cis_rate: number | null
          default_display_options: Json | null
          default_invoice_notes: string | null
          default_labour_rate: number | null
          default_quote_notes: string | null
          default_tax_rate: number | null
          document_template: string | null
          enable_cis: boolean | null
          enable_vat: boolean | null
          footer_logos: string[] | null
          id: string
          invoice_prefix: string | null
          is_vat_registered: boolean | null
          quote_prefix: string | null
          referral_code: string | null
          show_breakdown: boolean | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_end: string | null
          subscription_period_end: string | null
          subscription_start: string | null
          subscription_status:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          subscription_tier:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          tax_year_start_day: number | null
          tax_year_start_month: number | null
          trial_end: string | null
          trial_start: string | null
          updated_at: string | null
          usage_limits: Json | null
          user_id: string
          vat_number: string | null
        }
        Insert: {
          company_address?: string | null
          company_logo_path?: string | null
          company_name?: string | null
          converted?: boolean | null
          converted_at?: string | null
          cost_box_color?: string | null
          created_at?: string | null
          default_cis_rate?: number | null
          default_display_options?: Json | null
          default_invoice_notes?: string | null
          default_labour_rate?: number | null
          default_quote_notes?: string | null
          default_tax_rate?: number | null
          document_template?: string | null
          enable_cis?: boolean | null
          enable_vat?: boolean | null
          footer_logos?: string[] | null
          id?: string
          invoice_prefix?: string | null
          is_vat_registered?: boolean | null
          quote_prefix?: string | null
          referral_code?: string | null
          show_breakdown?: boolean | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_end?: string | null
          subscription_period_end?: string | null
          subscription_start?: string | null
          subscription_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          subscription_tier?:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          tax_year_start_day?: number | null
          tax_year_start_month?: number | null
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string | null
          usage_limits?: Json | null
          user_id: string
          vat_number?: string | null
        }
        Update: {
          company_address?: string | null
          company_logo_path?: string | null
          company_name?: string | null
          converted?: boolean | null
          converted_at?: string | null
          cost_box_color?: string | null
          created_at?: string | null
          default_cis_rate?: number | null
          default_display_options?: Json | null
          default_invoice_notes?: string | null
          default_labour_rate?: number | null
          default_quote_notes?: string | null
          default_tax_rate?: number | null
          document_template?: string | null
          enable_cis?: boolean | null
          enable_vat?: boolean | null
          footer_logos?: string[] | null
          id?: string
          invoice_prefix?: string | null
          is_vat_registered?: boolean | null
          quote_prefix?: string | null
          referral_code?: string | null
          show_breakdown?: boolean | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_end?: string | null
          subscription_period_end?: string | null
          subscription_start?: string | null
          subscription_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          subscription_tier?:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          tax_year_start_day?: number | null
          tax_year_start_month?: number | null
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string | null
          usage_limits?: Json | null
          user_id?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      vendor_keywords: {
        Row: {
          category_id: string
          created_at: string | null
          id: string
          keyword: string
          match_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string | null
          id?: string
          keyword: string
          match_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string | null
          id?: string
          keyword?: string
          match_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_keywords_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          created_at: string | null
          default_category: string | null
          default_payment_method: string | null
          expense_count: number | null
          id: string
          last_expense_date: string | null
          name: string
          notes: string | null
          total_spent: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          default_category?: string | null
          default_payment_method?: string | null
          expense_count?: number | null
          id?: string
          last_expense_date?: string | null
          name: string
          notes?: string | null
          total_spent?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          default_category?: string | null
          default_payment_method?: string | null
          expense_count?: number | null
          id?: string
          last_expense_date?: string | null
          name?: string
          notes?: string | null
          total_spent?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      wholesalers: {
        Row: {
          active: boolean | null
          commission_paid: number | null
          commission_per_conversion: number | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          id: string
          last_payment_date: string | null
          name: string
          notes: string | null
          referral_code: string
        }
        Insert: {
          active?: boolean | null
          commission_paid?: number | null
          commission_per_conversion?: number | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          last_payment_date?: string | null
          name: string
          notes?: string | null
          referral_code: string
        }
        Update: {
          active?: boolean | null
          commission_paid?: number | null
          commission_per_conversion?: number | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          last_payment_date?: string | null
          name?: string
          notes?: string | null
          referral_code?: string
        }
        Relationships: []
      }
    }
    Views: {
      expiring_documents: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          document_date: string | null
          expense_id: string | null
          expiry_date: string | null
          extracted_text: string | null
          file_size: number | null
          file_type: string | null
          id: string | null
          job_pack_id: string | null
          name: string | null
          payable_id: string | null
          storage_path: string | null
          tags: string[] | null
          tax_year: string | null
          updated_at: string | null
          user_id: string | null
          vendor_name: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          document_date?: string | null
          expense_id?: string | null
          expiry_date?: string | null
          extracted_text?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string | null
          job_pack_id?: string | null
          name?: string | null
          payable_id?: string | null
          storage_path?: string | null
          tags?: string[] | null
          tax_year?: string | null
          updated_at?: string | null
          user_id?: string | null
          vendor_name?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          document_date?: string | null
          expense_id?: string | null
          expiry_date?: string | null
          extracted_text?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string | null
          job_pack_id?: string | null
          name?: string | null
          payable_id?: string | null
          storage_path?: string | null
          tags?: string[] | null
          tax_year?: string | null
          updated_at?: string | null
          user_id?: string | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "filed_documents_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filed_documents_job_pack_id_fkey"
            columns: ["job_pack_id"]
            isOneToOne: false
            referencedRelation: "job_packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filed_documents_payable_id_fkey"
            columns: ["payable_id"]
            isOneToOne: false
            referencedRelation: "payables"
            referencedColumns: ["id"]
          },
        ]
      }
      filing_summary: {
        Row: {
          category: string | null
          document_count: number | null
          last_upload: string | null
          total_size: number | null
          user_id: string | null
        }
        Relationships: []
      }
      payables_summary: {
        Row: {
          due_this_week: number | null
          overdue_count: number | null
          paid_count: number | null
          partial_count: number | null
          total_outstanding: number | null
          total_overdue: number | null
          unpaid_count: number | null
          user_id: string | null
        }
        Relationships: []
      }
      reconciliation_summary: {
        Row: {
          description: string | null
          is_reconciled: boolean | null
          link_count: number | null
          linked_items: string[] | null
          total_matched: number | null
          transaction_amount: number | null
          transaction_date: string | null
          transaction_id: string | null
          unmatched_amount: number | null
          user_id: string | null
        }
        Relationships: []
      }
      user_subscription_status: {
        Row: {
          is_active: boolean | null
          referral_code: string | null
          subscription_end: string | null
          subscription_start: string | null
          subscription_status:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          subscription_tier:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          trial_days_remaining: number | null
          trial_end: string | null
          trial_start: string | null
          usage_limits: Json | null
          user_id: string | null
        }
        Insert: {
          is_active?: never
          referral_code?: string | null
          subscription_end?: string | null
          subscription_start?: string | null
          subscription_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          subscription_tier?:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          trial_days_remaining?: never
          trial_end?: string | null
          trial_start?: string | null
          usage_limits?: Json | null
          user_id?: string | null
        }
        Update: {
          is_active?: never
          referral_code?: string | null
          subscription_end?: string | null
          subscription_start?: string | null
          subscription_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          subscription_tier?:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          trial_days_remaining?: never
          trial_end?: string | null
          trial_start?: string | null
          usage_limits?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      vat_summary: {
        Row: {
          input_vat: number | null
          output_vat: number | null
          quarter: string | null
          user_id: string | null
        }
        Relationships: []
      }
      wholesaler_stats: {
        Row: {
          active: boolean | null
          commission_owed: number | null
          commission_paid: number | null
          commission_per_conversion: number | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          id: string | null
          last_payment_date: string | null
          name: string | null
          notes: string | null
          referral_code: string | null
          total_conversions: number | null
          total_signups: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_next_reference_number: {
        Args: { p_type: string; p_user_id: string }
        Returns: number
      }
      has_subscription_access: {
        Args: {
          required_tier: Database["public"]["Enums"]["subscription_tier"]
          user_uuid: string
        }
        Returns: boolean
      }
      is_trial_active: { Args: { user_uuid: string }; Returns: boolean }
      mark_payable_paid: {
        Args: {
          p_paid_date?: string
          p_payable_id: string
          p_transaction_id?: string
        }
        Returns: undefined
      }
      reconcile_transaction_multi: {
        Args: {
          p_expense_ids: string[]
          p_invoice_ids: string[]
          p_transaction_id: string
        }
        Returns: undefined
      }
      search_filed_documents: {
        Args: {
          p_category?: string
          p_query: string
          p_tax_year?: string
          p_user_id: string
        }
        Returns: {
          category: string
          description: string
          document_date: string
          id: string
          name: string
          rank: number
          storage_path: string
        }[]
      }
      unreconcile_transaction: {
        Args: { p_transaction_id: string }
        Returns: undefined
      }
    }
    Enums: {
      subscription_status:
        | "trialing"
        | "active"
        | "cancelled"
        | "past_due"
        | "expired"
      subscription_tier: "free" | "professional" | "business"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      subscription_status: [
        "trialing",
        "active",
        "cancelled",
        "past_due",
        "expired",
      ],
      subscription_tier: ["free", "professional", "business"],
    },
  },
} as const
