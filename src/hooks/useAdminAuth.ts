import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'admin' | 'moderator' | 'user';

interface UseAdminAuthReturn {
  isAdmin: boolean;
  isModerator: boolean;
  roles: AppRole[];
  loading: boolean;
  error: string | null;
}

export const useAdminAuth = (): UseAdminAuthReturn => {
  const { user, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    
    const fetchRoles = async () => {
      if (!user) {
        console.log('[useAdminAuth] No user, clearing roles');
        setRoles([]);
        setLoading(false);
        return;
      }

      console.log('[useAdminAuth] Fetching roles for user:', user.id);
      try {
        const { data, error: fetchError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (cancelled) return;

        if (fetchError) {
          console.error('[useAdminAuth] Error fetching user roles:', fetchError);
          setError(fetchError.message);
          setRoles([]);
        } else {
          const userRoles = (data || []).map(r => r.role as AppRole);
          console.log('[useAdminAuth] Fetched roles:', userRoles);
          setRoles(userRoles);
        }
      } catch (err) {
        if (cancelled) return;
        console.error('[useAdminAuth] Error in fetchRoles:', err);
        setError('Failed to fetch roles');
        setRoles([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    if (!authLoading) {
      console.log('[useAdminAuth] authLoading=false, calling fetchRoles');
      fetchRoles();
    } else {
      console.log('[useAdminAuth] authLoading=true, waiting...');
    }

    return () => { cancelled = true; };
  }, [user, authLoading]);

  return {
    isAdmin: roles.includes('admin'),
    isModerator: roles.includes('moderator') || roles.includes('admin'),
    roles,
    loading: authLoading || loading,
    error,
  };
};

export default useAdminAuth;
