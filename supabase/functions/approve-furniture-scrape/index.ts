import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ApproveRequest {
  scrape_id: string;
  // Optional overrides
  name?: string;
  category?: string;
  dimensions?: { width: number; depth: number; height: number };
  price?: number;
  currency?: string;
  color?: string;
  type_slug?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user is admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: ApproveRequest = await req.json();
    const { scrape_id, name, category, dimensions, price, currency, color, type_slug } = body;

    if (!scrape_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'scrape_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the scrape queue item
    const { data: scrapeItem, error: fetchError } = await supabase
      .from('furniture_scrape_queue')
      .select('*')
      .eq('id', scrape_id)
      .single();

    if (fetchError || !scrapeItem) {
      console.error('Failed to fetch scrape item:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: 'Scrape item not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use overrides or extracted values
    const finalName = name || scrapeItem.extracted_name || 'Unnamed Furniture';
    const finalCategory = category || scrapeItem.extracted_category || 'living';
    const finalDimensions = dimensions || scrapeItem.extracted_dimensions || { width: 100, depth: 100, height: 100 };
    const finalPrice = price ?? scrapeItem.extracted_price;
    const finalCurrency = currency || scrapeItem.extracted_currency || 'USD';
    const finalColor = color || '#8B4513';

    // Generate type slug if not provided
    let baseTypeSlug = type_slug || finalName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
    
    // Check if type already exists and generate unique slug
    let finalTypeSlug = baseTypeSlug;
    let suffix = 1;
    while (true) {
      const { data: existingType } = await supabase
        .from('furniture_templates')
        .select('id')
        .eq('type', finalTypeSlug)
        .single();
      
      if (!existingType) {
        break; // Type is unique
      }
      
      // Append suffix to make unique
      suffix++;
      finalTypeSlug = `${baseTypeSlug}-${suffix}`;
      console.log(`Type "${baseTypeSlug}" exists, trying "${finalTypeSlug}"`);
      
      // Safety limit to prevent infinite loop
      if (suffix > 100) {
        return new Response(
          JSON.stringify({ success: false, error: 'Could not generate unique type slug' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Download and upload first image to storage if available
    let thumbnailUrl: string | null = null;
    const images = scrapeItem.extracted_images || [];
    
    if (images.length > 0) {
      try {
        const imageUrl = images[0];
        console.log('Downloading image:', imageUrl);
        
        const imageResponse = await fetch(imageUrl);
        if (imageResponse.ok) {
          const imageBlob = await imageResponse.blob();
          const extension = imageUrl.split('.').pop()?.split('?')[0] || 'jpg';
          const fileName = `furniture/${scrape_id}.${extension}`;
          
          const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from('models')
            .upload(fileName, imageBlob, {
              contentType: imageBlob.type,
              upsert: true
            });

          if (!uploadError && uploadData) {
            const { data: urlData } = supabase
              .storage
              .from('models')
              .getPublicUrl(fileName);
            thumbnailUrl = urlData.publicUrl;
            console.log('Uploaded thumbnail:', thumbnailUrl);
          } else {
            console.error('Upload error:', uploadError);
          }
        }
      } catch (imgError) {
        console.error('Image processing error:', imgError);
        // Continue without thumbnail
      }
    }

    // Create furniture template
    const { data: template, error: insertError } = await supabase
      .from('furniture_templates')
      .insert({
        type: finalTypeSlug,
        category: finalCategory,
        name: finalName,
        dimensions_json: finalDimensions,
        default_color: finalColor,
        thumbnail_url: thumbnailUrl,
        is_active: true,
        sort_order: 0,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create template:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create furniture template', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update scrape queue item
    const { error: updateError } = await supabase
      .from('furniture_scrape_queue')
      .update({
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        furniture_template_id: template.id,
      })
      .eq('id', scrape_id);

    if (updateError) {
      console.error('Failed to update scrape queue:', updateError);
    }

    // Log activity
    await supabase
      .from('admin_activity_log')
      .insert({
        action: 'create',
        entity_type: 'furniture_templates',
        entity_id: template.id,
        entity_name: finalName,
        admin_user_id: user.id,
        changes_json: {
          source: 'scraper',
          scrape_id: scrape_id,
          source_url: scrapeItem.source_url
        }
      });

    console.log('Furniture template created:', template.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: {
          template_id: template.id,
          template: template
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Approval error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
