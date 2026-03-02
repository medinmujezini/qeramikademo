import { CheckCircle, XCircle, Globe, Trash2, RefreshCw, Database, Code, Image } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SiteProfile } from '@/lib/api/siteProfiles';

interface SiteProfileCardProps {
  profile: SiteProfile;
  onReanalyze: (domain: string) => void;
  onDelete: (id: string) => void;
  isLoading?: boolean;
}

export function SiteProfileCard({ profile, onReanalyze, onDelete, isLoading }: SiteProfileCardProps) {
  const successRate = profile.extraction_success_count + profile.extraction_fail_count > 0
    ? Math.round((profile.extraction_success_count / (profile.extraction_success_count + profile.extraction_fail_count)) * 100)
    : null;

  return (
    <Card className="relative">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-muted-foreground" />
            <CardTitle className="text-lg">{profile.site_name || profile.domain}</CardTitle>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onReanalyze(profile.domain)}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(profile.id)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <CardDescription>{profile.domain}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Data Sources */}
        <div className="flex flex-wrap gap-2">
          <Badge variant={profile.has_json_ld ? 'default' : 'outline'} className="gap-1">
            {profile.has_json_ld ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
            JSON-LD
          </Badge>
          <Badge variant={profile.has_open_graph ? 'default' : 'outline'} className="gap-1">
            {profile.has_open_graph ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
            OpenGraph
          </Badge>
          <Badge variant={profile.has_microdata ? 'default' : 'outline'} className="gap-1">
            {profile.has_microdata ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
            Microdata
          </Badge>
        </div>

        {/* Extraction Method */}
        <div className="text-sm space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            {profile.has_json_ld ? (
              <>
                <Database className="w-4 h-4 text-green-500" />
                <span className="text-green-600 font-medium">Structured data extraction</span>
              </>
            ) : Object.keys(profile.css_selectors || {}).length > 0 ? (
              <>
                <Code className="w-4 h-4 text-yellow-500" />
                <span className="text-yellow-600 font-medium">CSS selector extraction</span>
              </>
            ) : (
              <>
                <Image className="w-4 h-4 text-orange-500" />
                <span className="text-orange-600 font-medium">AI-based extraction</span>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="p-2 bg-muted rounded-lg">
            <div className="font-medium text-lg">{profile.extraction_success_count}</div>
            <div className="text-xs text-muted-foreground">Success</div>
          </div>
          <div className="p-2 bg-muted rounded-lg">
            <div className="font-medium text-lg">{profile.extraction_fail_count}</div>
            <div className="text-xs text-muted-foreground">Failed</div>
          </div>
          <div className="p-2 bg-muted rounded-lg">
            <div className="font-medium text-lg">{successRate !== null ? `${successRate}%` : '-'}</div>
            <div className="text-xs text-muted-foreground">Rate</div>
          </div>
        </div>

        {/* Currency & Dimensions */}
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="secondary">
            Currency: {profile.default_currency}
          </Badge>
          {profile.dimension_patterns?.format && (
            <Badge variant="secondary">
              Dims: {profile.dimension_patterns.format}
            </Badge>
          )}
          {profile.dimension_patterns?.labels?.length > 0 && (
            <Badge variant="secondary">
              Labels: {profile.dimension_patterns.labels.slice(0, 2).join(', ')}
            </Badge>
          )}
        </div>

        {/* Sample Extraction */}
        {profile.sample_extraction && Object.keys(profile.sample_extraction).length > 0 && (
          <div className="mt-3 p-3 bg-muted/50 rounded-lg text-xs">
            <div className="font-medium mb-1">Sample extraction:</div>
            <div className="space-y-0.5 text-muted-foreground">
              {profile.sample_extraction.name && (
                <div className="truncate">Name: {profile.sample_extraction.name}</div>
              )}
              {profile.sample_extraction.price && (
                <div>Price: {profile.sample_extraction.currency || profile.default_currency} {profile.sample_extraction.price}</div>
              )}
              {profile.sample_extraction.sku && (
                <div>SKU: {profile.sample_extraction.sku}</div>
              )}
            </div>
          </div>
        )}

        {/* Analyzed date */}
        <div className="text-xs text-muted-foreground">
          Analyzed: {new Date(profile.analyzed_at).toLocaleDateString()}
        </div>
      </CardContent>
    </Card>
  );
}
