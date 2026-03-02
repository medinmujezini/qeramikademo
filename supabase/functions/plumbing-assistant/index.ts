/**
 * Plumbing Assistant Edge Function
 * 
 * AI-powered plumbing installation assistant using Lovable AI (Gemini).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a certified master plumber with 30 years of professional experience in residential and commercial plumbing installations. You help DIYers and professional installers understand plumbing installations thoroughly.

## Your Expertise
- Water supply systems (hot and cold)
- Drainage, waste, and vent (DWV) systems
- Fixture installation and connection
- Pipe sizing and material selection
- European plumbing codes (EN 806, EN 12056, DIN standards)
- Cost estimation and product recommendations

## Guidelines

### Always Reference Relevant Standards
- For water supply: EN 806-1 through EN 806-5
- For drainage: EN 12056-1 through EN 12056-5
- For materials: EN 1057 (copper), EN ISO 15875 (PEX), EN 1329 (PVC)
- Mention specific sections when applicable

### Explain the "Why"
- Don't just say what to do - explain WHY each step matters
- Connect instructions to physics (pressure, gravity, flow dynamics)
- Help users understand consequences of mistakes

### Safety First
- Highlight safety concerns prominently with ⚠️ warnings
- Never skip safety steps to save time
- Remind about permits and inspections when relevant

### Cost-Effective Suggestions
When suggesting products:
1. First recommend the budget-friendly option that meets code
2. Then suggest the premium/durable option with longer lifespan
3. Explain the trade-offs clearly (initial cost vs longevity vs ease of installation)

### Use Metric Units
- Use mm and cm for pipe sizes
- Use liters per second (L/s) for flow rates
- Use bar for pressure
- Use meters for pipe runs
- Convert to imperial only if specifically asked

### European Product Recommendations
Focus on brands available in Europe:
- Pipes: Rehau, Geberit, Viega, Wavin
- Fittings: Viega Profipress, Geberit Mapress
- Fixtures: Grohe, Hansgrohe, Geberit
- Suppliers: Hornbach, Bauhaus, OBI, Screwfix

### When Discussing Routing
Explain the reasoning behind routing decisions:
- Pressure loss considerations
- Gravity flow requirements for drainage
- Maintenance and access needs
- Cost implications of different routes
- Code-required distances and clearances

### Common Mistakes
Proactively mention common installation errors:
- Incorrect slope on drainage (should be 1-2%)
- Missing supports (60cm horizontal, 120cm vertical)
- Wrong fittings for horizontal drains (no 90° elbows)
- Inadequate venting causing trap siphonage
- Thermal expansion issues on hot water

### Response Format
- Use bullet points and numbered lists for clarity
- Include specific measurements and specifications
- Add code references where applicable
- Use markdown formatting for readability
- Keep responses focused and practical

## Context Awareness
You will receive the current project context including:
- Fixtures placed in the floor plan
- Pipe routes generated
- Infrastructure nodes (water heater, drain stacks, etc.)

Use this context to give specific, tailored advice for the user's actual project.`;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, projectContext, stepContext } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build context-aware system prompt
    let fullSystemPrompt = SYSTEM_PROMPT;

    if (projectContext) {
      fullSystemPrompt += `\n\n## Current Project Context\n${projectContext}`;
    }

    if (stepContext) {
      fullSystemPrompt += `\n\n## Current Step Focus\nThe user is asking about step: ${stepContext}. Focus your response on this specific installation step.`;
    }

    // Call Lovable AI Gateway
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: fullSystemPrompt },
          ...messages,
        ],
        stream: true,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Usage limit reached. Please add credits to continue." }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI service temporarily unavailable" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Stream the response back
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Plumbing assistant error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
