/**
 * clean-floorplan
 * ----------------
 * Stage 03 of the deterministic floorplan→geometry pipeline.
 *
 * AI is a RASTER PREPROCESSOR ONLY. This function asks Gemini Vision to
 * identify regions to erase (text, doors, furniture, fixtures) and window
 * openings to fill (so the wall reads as solid). The client renders the
 * cleaned binary raster from those mask regions, which keeps the contract
 * pure and reproducible.
 *
 * Request:  { imageBase64: string (data URL or raw base64), mimeType?: string }
 * Response: {
 *   regionsToErase: [{ x, y, width, height, kind }],
 *   windowsToFill:  [{ x, y, width, height }]
 * }
 * All coordinates are in INPUT-IMAGE pixel space (origin top-left).
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

const SYSTEM_PROMPT = `You analyze top-down architectural floor plans for a vectorization pipeline.

YOUR JOB: produce two arrays of axis-aligned bounding boxes in the input image's pixel coordinate space (origin top-left, x right, y down).

Return ONLY valid JSON in this exact shape:
{
  "regionsToErase": [{"x": int, "y": int, "width": int, "height": int, "kind": "text" | "door" | "furniture" | "fixture" | "other"}],
  "windowsToFill":  [{"x": int, "y": int, "width": int, "height": int}]
}

regionsToErase MUST cover:
- All text: dimension labels, room labels, callouts, title blocks, scale bars, north arrows
- All door symbols: the swing arc AND the leaf line. CRITICAL: do NOT cover the gap in the wall where the door sits — the gap must remain a gap.
- All furniture and fixtures: beds, sofas, tables, chairs, sinks, toilets, tubs, stairs, kitchen units
- Any other non-wall ornament

windowsToFill MUST cover the openings where windows sit (parallel-line / hatched window symbols). After filling, the window must read as SOLID WALL — the box should span the full thickness of the wall at the window position, not just the symbol.

DO NOT touch wall lines themselves. DO NOT invent regions. Prefer slightly tight boxes over over-covering. Use integer pixel values.

Return JSON only — no markdown, no commentary.`;

interface CleanMasks {
  regionsToErase: Array<{ x: number; y: number; width: number; height: number; kind: string }>;
  windowsToFill: Array<{ x: number; y: number; width: number; height: number }>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return new Response(
        JSON.stringify({ error: "imageBase64 is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Accept either a full data URL or raw base64
    let dataUrl = imageBase64;
    if (!dataUrl.startsWith("data:")) {
      dataUrl = `data:${mimeType ?? "image/jpeg"};base64,${imageBase64}`;
    }

    const aiResp = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Identify regionsToErase and windowsToFill for this floor plan." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      const status = aiResp.status;
      let message = `AI gateway error (${status})`;
      if (status === 429) message = "Rate limit exceeded. Please try again in a moment.";
      else if (status === 402) message = "AI credits exhausted. Add credits in Settings → Workspace → Usage.";
      console.error("clean-floorplan gateway error", status, errText);
      return new Response(
        JSON.stringify({ error: message, detail: errText }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiData = await aiResp.json();
    const content: string = aiData.choices?.[0]?.message?.content ?? "";

    let masks: CleanMasks;
    try {
      masks = JSON.parse(content);
    } catch {
      // Best-effort: pull the first {...} block
      const m = content.match(/\{[\s\S]*\}/);
      masks = m ? JSON.parse(m[0]) : { regionsToErase: [], windowsToFill: [] };
    }

    // Defensive normalization
    const sanitizeBox = (b: any) => ({
      x: Math.max(0, Math.round(Number(b.x) || 0)),
      y: Math.max(0, Math.round(Number(b.y) || 0)),
      width: Math.max(1, Math.round(Number(b.width) || 0)),
      height: Math.max(1, Math.round(Number(b.height) || 0)),
    });

    const out = {
      regionsToErase: (masks.regionsToErase || []).map((b: any) => ({
        ...sanitizeBox(b),
        kind: ["text", "door", "furniture", "fixture", "other"].includes(b.kind) ? b.kind : "other",
      })),
      windowsToFill: (masks.windowsToFill || []).map(sanitizeBox),
    };

    return new Response(JSON.stringify(out), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("clean-floorplan error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
