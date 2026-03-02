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
    const fetchRoles = async () => {
      if (!user) {
        setRoles([]);
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (fetchError) {
          console.error('Error fetching user roles:', fetchError);
          setError(fetchError.message);
          setRoles([]);
        } else {
          const userRoles = (data || []).map(r => r.role as AppRole);
          setRoles(userRoles);
        }
      } catch (err) {
        console.error('Error in fetchRoles:', err);
        setError('Failed to fetch roles');
        setRoles([]);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchRoles();
    }
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
