import { supabase } from '@/integrations/supabase/client';

export interface SiteProfile {
  id: string;
  domain: string;
  site_name: string | null;
  has_json_ld: boolean;
  has_open_graph: boolean;
  has_microdata: boolean;
  json_ld_paths: Record<string, string>;
  css_selectors: Record<string, string>;
  dimension_patterns: {
    labels: string[];
    format: string;
    selector?: string;
  };
  default_currency: string;
  product_link_selector: string | null;
  product_link_pattern: string | null;
  sample_url: string | null;
  sample_extraction: Record<string, any> | null;
  extraction_success_count: number;
  extraction_fail_count: number;
  analyzed_at: string;
  created_at: string;
  updated_at: string;
}

export interface AnalyzeResult {
  success: boolean;
  profile?: Partial<SiteProfile>;
  message?: string;
  error?: string;
}

export const siteProfilesApi = {
  /**
   * Analyze a site's structure and create/update a profile
   */
  async analyze(url: string): Promise<AnalyzeResult> {
    const { data, error } = await supabase.functions.invoke('analyze-site', {
      body: { url },
    });

    if (error) {
      console.error('Analyze function error:', error);
      return { success: false, error: error.message };
    }

    return data;
  },

  /**
   * Get profile for a specific domain
   */
  async getByDomain(domain: string): Promise<SiteProfile | null> {
    // Normalize domain
    const normalizedDomain = domain.replace('www.', '').toLowerCase();
    
    const { data, error } = await supabase
      .from('site_profiles')
      .select('*')
      .eq('domain', normalizedDomain)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null;
      }
      console.error('Get profile error:', error);
      return null;
    }

    return data as unknown as SiteProfile;
  },

  /**
   * Get all site profiles
   */
  async getAll(): Promise<SiteProfile[]> {
    const { data, error } = await supabase
      .from('site_profiles')
      .select('*')
      .order('analyzed_at', { ascending: false });

    if (error) {
      console.error('Get profiles error:', error);
      return [];
    }

    return (data || []) as unknown as SiteProfile[];
  },

  /**
   * Delete a site profile
   */
  async delete(id: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
      .from('site_profiles')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Delete profile error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  },

  /**
   * Update extraction stats
   */
  async incrementStats(domain: string, success: boolean): Promise<void> {
    const normalizedDomain = domain.replace('www.', '').toLowerCase();
    
    // Use RPC or manual increment
    const { data: profile } = await supabase
      .from('site_profiles')
      .select('extraction_success_count, extraction_fail_count')
      .eq('domain', normalizedDomain)
      .single();

    if (profile) {
      await supabase
        .from('site_profiles')
        .update({
          extraction_success_count: success 
            ? (profile.extraction_success_count || 0) + 1 
            : profile.extraction_success_count,
          extraction_fail_count: !success 
            ? (profile.extraction_fail_count || 0) + 1 
            : profile.extraction_fail_count,
        })
        .eq('domain', normalizedDomain);
    }
  },

  /**
   * Extract domain from URL
   */
  getDomainFromUrl(url: string): string {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      return urlObj.hostname.replace('www.', '').toLowerCase();
    } catch {
      return '';
    }
  },
};
