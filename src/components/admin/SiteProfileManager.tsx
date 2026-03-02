import { useState, useEffect } from 'react';
import { Search, Loader2, AlertCircle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { SiteProfile, siteProfilesApi } from '@/lib/api/siteProfiles';
import { SiteProfileCard } from './SiteProfileCard';

export function SiteProfileManager() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<SiteProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [reanalyzingDomain, setReanalyzingDomain] = useState<string | null>(null);

  const fetchProfiles = async () => {
    setProfilesLoading(true);
    const data = await siteProfilesApi.getAll();
    setProfiles(data);
    setProfilesLoading(false);
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleAnalyze = async () => {
    if (!url.trim()) {
      toast.error('Please enter a URL');
      return;
    }

    setLoading(true);

    try {
      const result = await siteProfilesApi.analyze(url.trim());
      
      if (result.success) {
        toast.success(result.message || 'Site analyzed successfully!');
        fetchProfiles();
        setUrl('');
      } else {
        toast.error(result.error || 'Analysis failed');
      }
    } catch (error) {
      console.error('Analyze error:', error);
      toast.error('An error occurred during analysis');
    } finally {
      setLoading(false);
    }
  };

  const handleReanalyze = async (domain: string) => {
    setReanalyzingDomain(domain);
    
    try {
      // Find the sample URL or construct one
      const profile = profiles.find(p => p.domain === domain);
      const sampleUrl = profile?.sample_url || `https://${domain}`;
      
      const result = await siteProfilesApi.analyze(sampleUrl);
      
      if (result.success) {
        toast.success('Site re-analyzed successfully!');
        fetchProfiles();
      } else {
        toast.error(result.error || 'Re-analysis failed');
      }
    } catch (error) {
      toast.error('Failed to re-analyze site');
    } finally {
      setReanalyzingDomain(null);
    }
  };

  const handleDelete = async (id: string) => {
    const result = await siteProfilesApi.delete(id);
    
    if (result.success) {
      toast.success('Profile deleted');
      setProfiles(profiles.filter(p => p.id !== id));
    } else {
      toast.error(result.error || 'Failed to delete profile');
    }
  };

  return (
    <div className="space-y-6">
      {/* Analyze New Site */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Analyze New Site
          </CardTitle>
          <CardDescription>
            Paste a product page URL to analyze the site's structure and create an extraction profile
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                placeholder="https://example-store.com/product/sofa-123"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                disabled={loading}
              />
            </div>
            <Button onClick={handleAnalyze} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Analyze
                </>
              )}
            </Button>
          </div>
          
          <Alert className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Analysis will look for JSON-LD structured data, OpenGraph tags, and CSS selectors 
              to create a reliable extraction profile for this e-commerce site.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Site Profiles Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Site Profiles</CardTitle>
          <CardDescription>
            {profiles.length} site{profiles.length !== 1 ? 's' : ''} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {profilesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : profiles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No site profiles yet. Analyze a product page to get started.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {profiles.map(profile => (
                <SiteProfileCard
                  key={profile.id}
                  profile={profile}
                  onReanalyze={handleReanalyze}
                  onDelete={handleDelete}
                  isLoading={reanalyzingDomain === profile.domain}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
