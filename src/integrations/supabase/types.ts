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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_activity_log: {
        Row: {
          action: string
          admin_user_id: string | null
          changes_json: Json | null
          created_at: string
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          admin_user_id?: string | null
          changes_json?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          admin_user_id?: string | null
          changes_json?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      column_templates: {
        Row: {
          created_at: string
          default_dimensions_json: Json
          default_material: string
          id: string
          is_active: boolean
          is_structural: boolean
          name: string
          shape: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_dimensions_json?: Json
          default_material?: string
          id?: string
          is_active?: boolean
          is_structural?: boolean
          name: string
          shape?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_dimensions_json?: Json
          default_material?: string
          id?: string
          is_active?: boolean
          is_structural?: boolean
          name?: string
          shape?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      curtain_models: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          model_url: string
          name: string
          sort_order: number
          thumbnail_url: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          model_url: string
          name: string
          sort_order?: number
          thumbnail_url?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          model_url?: string
          name?: string
          sort_order?: number
          thumbnail_url?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      fixture_templates: {
        Row: {
          category: string
          clearance_json: Json
          connection_templates_json: Json
          created_at: string
          dfu_value: number
          dimensions_json: Json
          gpm_cold: number
          gpm_hot: number
          icon: string
          id: string
          is_active: boolean
          model_url: string | null
          name: string
          requires_wall: boolean
          sort_order: number
          supply_height: number | null
          thumbnail_url: string | null
          trap_height: number | null
          type: string
          updated_at: string
          wall_offset: number
          wattage: number | null
        }
        Insert: {
          category: string
          clearance_json?: Json
          connection_templates_json?: Json
          created_at?: string
          dfu_value?: number
          dimensions_json?: Json
          gpm_cold?: number
          gpm_hot?: number
          icon?: string
          id?: string
          is_active?: boolean
          model_url?: string | null
          name: string
          requires_wall?: boolean
          sort_order?: number
          supply_height?: number | null
          thumbnail_url?: string | null
          trap_height?: number | null
          type: string
          updated_at?: string
          wall_offset?: number
          wattage?: number | null
        }
        Update: {
          category?: string
          clearance_json?: Json
          connection_templates_json?: Json
          created_at?: string
          dfu_value?: number
          dimensions_json?: Json
          gpm_cold?: number
          gpm_hot?: number
          icon?: string
          id?: string
          is_active?: boolean
          model_url?: string | null
          name?: string
          requires_wall?: boolean
          sort_order?: number
          supply_height?: number | null
          thumbnail_url?: string | null
          trap_height?: number | null
          type?: string
          updated_at?: string
          wall_offset?: number
          wattage?: number | null
        }
        Relationships: []
      }
      furniture_scrape_queue: {
        Row: {
          ai_confidence: number | null
          created_at: string
          error_message: string | null
          extracted_brand: string | null
          extracted_category: string | null
          extracted_currency: string | null
          extracted_description: string | null
          extracted_dimensions: Json | null
          extracted_images: string[] | null
          extracted_name: string | null
          extracted_price: number | null
          furniture_template_id: string | null
          id: string
          model_status: string
          model_url: string | null
          notes: string | null
          raw_markdown: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_url: string
          status: string
          updated_at: string
        }
        Insert: {
          ai_confidence?: number | null
          created_at?: string
          error_message?: string | null
          extracted_brand?: string | null
          extracted_category?: string | null
          extracted_currency?: string | null
          extracted_description?: string | null
          extracted_dimensions?: Json | null
          extracted_images?: string[] | null
          extracted_name?: string | null
          extracted_price?: number | null
          furniture_template_id?: string | null
          id?: string
          model_status?: string
          model_url?: string | null
          notes?: string | null
          raw_markdown?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_url: string
          status?: string
          updated_at?: string
        }
        Update: {
          ai_confidence?: number | null
          created_at?: string
          error_message?: string | null
          extracted_brand?: string | null
          extracted_category?: string | null
          extracted_currency?: string | null
          extracted_description?: string | null
          extracted_dimensions?: Json | null
          extracted_images?: string[] | null
          extracted_name?: string | null
          extracted_price?: number | null
          furniture_template_id?: string | null
          id?: string
          model_status?: string
          model_url?: string | null
          notes?: string | null
          raw_markdown?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_url?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "furniture_scrape_queue_furniture_template_id_fkey"
            columns: ["furniture_template_id"]
            isOneToOne: false
            referencedRelation: "furniture_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      furniture_templates: {
        Row: {
          category: string
          created_at: string
          currency: string | null
          default_color: string
          description: string | null
          dimensions_json: Json
          icon: string
          id: string
          is_active: boolean
          model_url: string | null
          name: string
          price: number | null
          sort_order: number
          thumbnail_url: string | null
          type: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          currency?: string | null
          default_color?: string
          description?: string | null
          dimensions_json?: Json
          icon?: string
          id?: string
          is_active?: boolean
          model_url?: string | null
          name: string
          price?: number | null
          sort_order?: number
          thumbnail_url?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          currency?: string | null
          default_color?: string
          description?: string | null
          dimensions_json?: Json
          icon?: string
          id?: string
          is_active?: boolean
          model_url?: string | null
          name?: string
          price?: number | null
          sort_order?: number
          thumbnail_url?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      grout_colors: {
        Row: {
          created_at: string
          hex_color: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          hex_color: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          hex_color?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      kitchen_models: {
        Row: {
          block_type: string
          created_at: string
          id: string
          is_active: boolean
          model_url: string
          name: string
          sort_order: number
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          block_type: string
          created_at?: string
          id?: string
          is_active?: boolean
          model_url: string
          name: string
          sort_order?: number
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          block_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          model_url?: string
          name?: string
          sort_order?: number
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      materials: {
        Row: {
          albedo_url: string | null
          ao_url: string | null
          arm_url: string | null
          created_at: string
          height_url: string | null
          id: string
          metallic_url: string | null
          name: string
          normal_url: string | null
          roughness_url: string | null
          updated_at: string
        }
        Insert: {
          albedo_url?: string | null
          ao_url?: string | null
          arm_url?: string | null
          created_at?: string
          height_url?: string | null
          id?: string
          metallic_url?: string | null
          name: string
          normal_url?: string | null
          roughness_url?: string | null
          updated_at?: string
        }
        Update: {
          albedo_url?: string | null
          ao_url?: string | null
          arm_url?: string | null
          created_at?: string
          height_url?: string | null
          id?: string
          metallic_url?: string | null
          name?: string
          normal_url?: string | null
          roughness_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          floor_plan_json: Json
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          floor_plan_json?: Json
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          floor_plan_json?: Json
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      site_profiles: {
        Row: {
          analyzed_at: string | null
          api_endpoint: string | null
          api_pattern: Json | null
          created_at: string | null
          css_selectors: Json | null
          default_currency: string | null
          dimension_patterns: Json | null
          domain: string
          extraction_fail_count: number | null
          extraction_success_count: number | null
          has_json_ld: boolean | null
          has_microdata: boolean | null
          has_open_graph: boolean | null
          id: string
          json_ld_paths: Json | null
          product_link_pattern: string | null
          product_link_selector: string | null
          sample_extraction: Json | null
          sample_url: string | null
          site_name: string | null
          updated_at: string | null
        }
        Insert: {
          analyzed_at?: string | null
          api_endpoint?: string | null
          api_pattern?: Json | null
          created_at?: string | null
          css_selectors?: Json | null
          default_currency?: string | null
          dimension_patterns?: Json | null
          domain: string
          extraction_fail_count?: number | null
          extraction_success_count?: number | null
          has_json_ld?: boolean | null
          has_microdata?: boolean | null
          has_open_graph?: boolean | null
          id?: string
          json_ld_paths?: Json | null
          product_link_pattern?: string | null
          product_link_selector?: string | null
          sample_extraction?: Json | null
          sample_url?: string | null
          site_name?: string | null
          updated_at?: string | null
        }
        Update: {
          analyzed_at?: string | null
          api_endpoint?: string | null
          api_pattern?: Json | null
          created_at?: string | null
          css_selectors?: Json | null
          default_currency?: string | null
          dimension_patterns?: Json | null
          domain?: string
          extraction_fail_count?: number | null
          extraction_success_count?: number | null
          has_json_ld?: boolean | null
          has_microdata?: boolean | null
          has_open_graph?: boolean | null
          id?: string
          json_ld_paths?: Json | null
          product_link_pattern?: string | null
          product_link_selector?: string | null
          sample_extraction?: Json | null
          sample_url?: string | null
          site_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      tile_templates: {
        Row: {
          created_at: string
          default_color: string
          dimensions_json: Json
          id: string
          is_active: boolean
          is_flexible: boolean
          material: string
          material_id: string | null
          min_curve_radius: number | null
          name: string
          price_per_unit: number
          sort_order: number
          texture_scale_cm: number | null
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_color?: string
          dimensions_json?: Json
          id?: string
          is_active?: boolean
          is_flexible?: boolean
          material?: string
          material_id?: string | null
          min_curve_radius?: number | null
          name: string
          price_per_unit?: number
          sort_order?: number
          texture_scale_cm?: number | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_color?: string
          dimensions_json?: Json
          id?: string
          is_active?: boolean
          is_flexible?: boolean
          material?: string
          material_id?: string | null
          min_curve_radius?: number | null
          name?: string
          price_per_unit?: number
          sort_order?: number
          texture_scale_cm?: number | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tile_templates_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
