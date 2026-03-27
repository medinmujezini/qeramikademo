import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANALYSIS_PROMPT = `You are an expert architectural floor plan analyzer specializing in vectorization and digitization.

CRITICAL INSTRUCTIONS FOR WALL DETECTION:

1. IDENTIFY WALL LINES CORRECTLY:
   - Walls are the THICKEST BLACK/DARK LINES that form room boundaries
   - Walls form a CONNECTED NETWORK - they meet at corners (intersections)
   - IGNORE: thin lines (dimensions), dashed lines (fixtures), furniture outlines, text annotations
   - IGNORE: arcs for doors, dimension arrows, hatching patterns

2. TRACE WALLS AS CONNECTED SEGMENTS:
   - First identify all CORNER POINTS (where walls meet/intersect)
   - Then create wall segments BETWEEN these corners
   - Walls sharing a corner MUST have EXACTLY MATCHING coordinates at that point
   - Example: If Wall_A ends at (100, 200), and Wall_B starts there, use EXACTLY (100, 200) for both

3. EXTERIOR vs INTERIOR WALLS:
   - Exterior walls form the OUTER PERIMETER of the building
   - Interior walls divide the space into rooms
   - Mark isExterior: true for perimeter walls, false for interior partitions

4. COORDINATE PRECISION:
   - Use INTEGER pixel values only
   - Origin (0,0) is TOP-LEFT corner
   - X increases to the RIGHT
   - Y increases DOWNWARD

5. DOOR DETECTION:
   - Look for ARC SYMBOLS indicating door swing
   - Doors appear as BREAKS in wall lines with arcs
   - Position the door at the CENTER of the opening

6. WINDOW DETECTION:
   - Windows appear as DOUBLE PARALLEL LINES on walls
   - Or as rectangular breaks with small perpendicular lines

7. ROOM DETECTION — REQUIRED:
   - Identify ALL enclosed spaces formed by wall intersections
   - Even if room labels are not visible, detect rooms from closed wall loops
   - Trace the wall network to find every enclosed polygon — each one is a room
   - Label rooms by their likely function based on size and position: bathroom (small), bedroom (medium), kitchen, living room (large)
   - Every floor plan has at least one room — always return at least one room entry
   - Room vertices should trace the inner perimeter of the wall centerlines

Return ONLY valid JSON (no markdown, no explanation):
{
  "walls": [
    {"id": "wall_1", "startX": <int>, "startY": <int>, "endX": <int>, "endY": <int>, "thickness": <10-15 for interior, 15-25 for exterior>, "confidence": <0.7-1.0>, "isExterior": <boolean>}
  ],
  "doors": [
    {"id": "door_1", "x": <int>, "y": <int>, "width": <typical 80-100 pixels>, "type": "hinged-left"|"hinged-right"|"sliding"|"double"|"pocket", "confidence": <0.6-1.0>}
  ],
  "windows": [
    {"id": "window_1", "x": <int>, "y": <int>, "width": <int>, "height": <int>, "confidence": <0.6-1.0>}
  ],
  "rooms": [
    {"id": "room_1", "vertices": [{"x": <int>, "y": <int>}, ...], "label": "<room name>", "confidence": <0.5-1.0>}
  ],
  "ignoreRegions": [],
  "imageWidth": <int>,
  "imageHeight": <int>,
  "analysisConfidence": <0.7-1.0>
}

QUALITY CHECKLIST:
✓ Every wall corner is shared by connected walls (same coordinates)
✓ Exterior walls form a closed perimeter
✓ No duplicate or overlapping walls
✓ Wall thickness is consistent (10-15cm interior, 15-25cm exterior)
✓ At least one room detected and returned
✓ Room vertices form closed polygons
✓ Room boundaries derived from wall intersection network
✓ Limit: max 30 walls, 15 doors, 15 windows for precision`;

// Wall post-processing types
interface WallData {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  thickness: number;
  confidence: number;
  isExterior: boolean;
}

// Snap nearby endpoints together
function snapWallEndpoints(walls: WallData[], threshold: number = 20): WallData[] {
  console.log(`Snapping wall endpoints with threshold: ${threshold}px`);
  
  // Collect all unique endpoints
  const endpoints: { x: number; y: number; refs: Array<{ wallId: string; endpoint: 'start' | 'end' }> }[] = [];
  
  for (const wall of walls) {
    // Check start point
    let foundStart = false;
    for (const ep of endpoints) {
      const dist = Math.sqrt((ep.x - wall.startX) ** 2 + (ep.y - wall.startY) ** 2);
      if (dist < threshold) {
        ep.refs.push({ wallId: wall.id, endpoint: 'start' });
        foundStart = true;
        break;
      }
    }
    if (!foundStart) {
      endpoints.push({ x: wall.startX, y: wall.startY, refs: [{ wallId: wall.id, endpoint: 'start' }] });
    }
    
    // Check end point
    let foundEnd = false;
    for (const ep of endpoints) {
      const dist = Math.sqrt((ep.x - wall.endX) ** 2 + (ep.y - wall.endY) ** 2);
      if (dist < threshold) {
        ep.refs.push({ wallId: wall.id, endpoint: 'end' });
        foundEnd = true;
        break;
      }
    }
    if (!foundEnd) {
      endpoints.push({ x: wall.endX, y: wall.endY, refs: [{ wallId: wall.id, endpoint: 'end' }] });
    }
  }
  
  // Calculate average position for each cluster and update walls
  const wallMap = new Map(walls.map(w => [w.id, { ...w }]));
  
  for (const ep of endpoints) {
    if (ep.refs.length > 1) {
      // Calculate centroid
      let sumX = 0, sumY = 0;
      for (const ref of ep.refs) {
        const wall = wallMap.get(ref.wallId)!;
        if (ref.endpoint === 'start') {
          sumX += wall.startX;
          sumY += wall.startY;
        } else {
          sumX += wall.endX;
          sumY += wall.endY;
        }
      }
      const avgX = Math.round(sumX / ep.refs.length);
      const avgY = Math.round(sumY / ep.refs.length);
      
      // Snap all references to this position
      for (const ref of ep.refs) {
        const wall = wallMap.get(ref.wallId)!;
        if (ref.endpoint === 'start') {
          wall.startX = avgX;
          wall.startY = avgY;
        } else {
          wall.endX = avgX;
          wall.endY = avgY;
        }
      }
    }
  }
  
  const snappedCount = endpoints.filter(ep => ep.refs.length > 1).length;
  console.log(`Snapped ${snappedCount} endpoint clusters`);
  
  return Array.from(wallMap.values());
}

// Remove duplicate/overlapping walls
function removeDuplicateWalls(walls: WallData[], overlapThreshold: number = 15): WallData[] {
  console.log(`Removing duplicate walls with threshold: ${overlapThreshold}px`);
  
  const result: WallData[] = [];
  
  for (const wall of walls) {
    let isDuplicate = false;
    
    for (const existing of result) {
      // Check if walls are essentially the same (endpoints match in either direction)
      const sameDir = 
        Math.abs(wall.startX - existing.startX) < overlapThreshold &&
        Math.abs(wall.startY - existing.startY) < overlapThreshold &&
        Math.abs(wall.endX - existing.endX) < overlapThreshold &&
        Math.abs(wall.endY - existing.endY) < overlapThreshold;
      
      const reverseDir = 
        Math.abs(wall.startX - existing.endX) < overlapThreshold &&
        Math.abs(wall.startY - existing.endY) < overlapThreshold &&
        Math.abs(wall.endX - existing.startX) < overlapThreshold &&
        Math.abs(wall.endY - existing.startY) < overlapThreshold;
      
      if (sameDir || reverseDir) {
        isDuplicate = true;
        // Keep the one with higher confidence
        if (wall.confidence > existing.confidence) {
          const idx = result.indexOf(existing);
          result[idx] = wall;
        }
        break;
      }
    }
    
    if (!isDuplicate) {
      result.push(wall);
    }
  }
  
  console.log(`Removed ${walls.length - result.length} duplicate walls`);
  return result;
}

// Merge collinear walls
function mergeCollinearWalls(walls: WallData[], angleThreshold: number = 5, gapThreshold: number = 25): WallData[] {
  console.log(`Merging collinear walls`);
  
  const getAngle = (w: WallData) => Math.atan2(w.endY - w.startY, w.endX - w.startX) * 180 / Math.PI;
  const getLength = (w: WallData) => Math.sqrt((w.endX - w.startX) ** 2 + (w.endY - w.startY) ** 2);
  
  const result: WallData[] = [...walls];
  let merged = true;
  let iterations = 0;
  
  while (merged && iterations < 10) {
    merged = false;
    iterations++;
    
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const w1 = result[i];
        const w2 = result[j];
        
        // Check if angles are similar
        const angle1 = getAngle(w1);
        const angle2 = getAngle(w2);
        const angleDiff = Math.abs(((angle1 - angle2 + 180) % 360) - 180);
        
        if (angleDiff > angleThreshold && Math.abs(angleDiff - 180) > angleThreshold) continue;
        
        // Check if endpoints are close enough to merge
        const connections = [
          { gap: Math.sqrt((w1.endX - w2.startX) ** 2 + (w1.endY - w2.startY) ** 2), merge: 'end-start' },
          { gap: Math.sqrt((w1.startX - w2.endX) ** 2 + (w1.startY - w2.endY) ** 2), merge: 'start-end' },
          { gap: Math.sqrt((w1.endX - w2.endX) ** 2 + (w1.endY - w2.endY) ** 2), merge: 'end-end' },
          { gap: Math.sqrt((w1.startX - w2.startX) ** 2 + (w1.startY - w2.startY) ** 2), merge: 'start-start' },
        ];
        
        const best = connections.reduce((a, b) => a.gap < b.gap ? a : b);
        
        if (best.gap < gapThreshold) {
          // Merge walls
          let newWall: WallData;
          
          switch (best.merge) {
            case 'end-start':
              newWall = { ...w1, endX: w2.endX, endY: w2.endY, confidence: (w1.confidence + w2.confidence) / 2 };
              break;
            case 'start-end':
              newWall = { ...w1, startX: w2.startX, startY: w2.startY, confidence: (w1.confidence + w2.confidence) / 2 };
              break;
            case 'end-end':
              newWall = { ...w1, endX: w2.startX, endY: w2.startY, confidence: (w1.confidence + w2.confidence) / 2 };
              break;
            case 'start-start':
              newWall = { ...w1, startX: w2.endX, startY: w2.endY, confidence: (w1.confidence + w2.confidence) / 2 };
              break;
            default:
              continue;
          }
          
          // Check if merged wall is reasonably straight (not a bend)
          const newLength = getLength(newWall);
          const combinedLength = getLength(w1) + getLength(w2);
          
          if (newLength > combinedLength * 0.9) { // Allow 10% curvature tolerance
            result[i] = newWall;
            result.splice(j, 1);
            merged = true;
            break;
          }
        }
      }
      if (merged) break;
    }
  }
  
  console.log(`Merged into ${result.length} walls (from ${walls.length})`);
  return result;
}

// Remove very short walls (likely detection errors)
function removeShortWalls(walls: WallData[], minLength: number = 20): WallData[] {
  const result = walls.filter(w => {
    const length = Math.sqrt((w.endX - w.startX) ** 2 + (w.endY - w.startY) ** 2);
    return length >= minLength;
  });
  console.log(`Removed ${walls.length - result.length} short walls (< ${minLength}px)`);
  return result;
}

// Main post-processing function
function postProcessWalls(walls: WallData[]): WallData[] {
  console.log(`Post-processing ${walls.length} walls...`);
  
  let processed = [...walls];
  
  // Step 1: Remove very short walls
  processed = removeShortWalls(processed, 15);
  
  // Step 2: Remove duplicates
  processed = removeDuplicateWalls(processed, 20);
  
  // Step 3: Snap endpoints
  processed = snapWallEndpoints(processed, 25);
  
  // Step 4: Merge collinear walls
  processed = mergeCollinearWalls(processed, 8, 30);
  
  // Step 5: Final snap after merging
  processed = snapWallEndpoints(processed, 15);
  
  console.log(`Post-processing complete: ${processed.length} walls`);
  return processed;
}

// Attempt to repair truncated JSON
function repairTruncatedJson(content: string): object | null {
  let jsonStr = content;
  
  // Extract JSON from markdown code blocks if present
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  } else {
    // Try to find raw JSON object
    const rawMatch = jsonStr.match(/\{[\s\S]*$/);
    if (rawMatch) {
      jsonStr = rawMatch[0];
    }
  }
  
  // Try parsing as-is first
  try {
    return JSON.parse(jsonStr);
  } catch {
    // Continue with repair attempts
  }
  
  console.log("Attempting JSON repair...");
  
  // Remove trailing incomplete values
  jsonStr = jsonStr
    .replace(/,\s*$/, '')  // Remove trailing comma
    .replace(/:\s*$/, ': null')  // Complete hanging colons
    .replace(/:\s*\d+$/, (m) => m)  // Keep complete numbers
    .replace(/:\s*"[^"]*$/, ': ""')  // Complete truncated strings
    .replace(/,\s*"[^"]*$/, '')  // Remove incomplete key-value pairs
    .replace(/,\s*\{[^}]*$/, '')  // Remove incomplete objects in array
    .replace(/\[\s*\{[^}\]]*$/, '[]');  // Replace incomplete arrays
  
  // Count brackets and add missing ones
  const openBraces = (jsonStr.match(/\{/g) || []).length;
  const closeBraces = (jsonStr.match(/\}/g) || []).length;
  const openBrackets = (jsonStr.match(/\[/g) || []).length;
  const closeBrackets = (jsonStr.match(/\]/g) || []).length;
  
  // Add missing closing brackets
  jsonStr += ']'.repeat(Math.max(0, openBrackets - closeBrackets));
  jsonStr += '}'.repeat(Math.max(0, openBraces - closeBraces));
  
  try {
    const parsed = JSON.parse(jsonStr);
    console.log("JSON repair successful!");
    return parsed;
  } catch (e) {
    console.error("JSON repair failed:", e);
    return null;
  }
}

async function callAI(imageDataUrl: string, apiKey: string, model: string, maxTokens: number): Promise<object> {
  console.log(`Calling AI with model: ${model}, max_tokens: ${maxTokens}`);
  
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: "You are an expert architectural floor plan vectorizer. Analyze images precisely and return valid JSON only. Focus on accurate wall detection with connected endpoints.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: ANALYSIS_PROMPT },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`AI Gateway error (${model}):`, response.status, errorText);
    throw new Error(`AI_ERROR:${response.status}`);
  }

  const aiResponse = await response.json();
  const content = aiResponse.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No response from AI model");
  }

  console.log("Raw AI response length:", content.length);
  console.log("Raw AI response (first 1000 chars):", content.substring(0, 1000));

  // Try direct parse first
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(content);
  } catch (parseError) {
    console.log("Direct parse failed, attempting repair...");
    
    // Try to repair truncated JSON
    const repaired = repairTruncatedJson(content);
    if (repaired) {
      return repaired;
    }
    
    throw new Error("PARSE_FAILED");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageDataUrl, highAccuracy = false } = await req.json();
    
    if (!imageDataUrl) {
      throw new Error("No image data provided");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log(`Starting floor plan analysis... (highAccuracy: ${highAccuracy})`);

    let analysis: object | null = null;
    let lastError: Error | null = null;

    // Flash-first for speed; high accuracy uses a faster pro model to stay within 60s limit
    const attempts = highAccuracy 
      ? [
          { model: "google/gemini-2.5-flash", maxTokens: 16000 },
          { model: "google/gemini-3-flash-preview", maxTokens: 12000 },
        ]
      : [
          { model: "google/gemini-3-flash-preview", maxTokens: 12000 },
          { model: "google/gemini-2.5-flash", maxTokens: 12000 },
        ];

    for (const attempt of attempts) {
      try {
        analysis = await callAI(imageDataUrl, LOVABLE_API_KEY, attempt.model, attempt.maxTokens);
        if (analysis) {
          console.log(`Success with ${attempt.model}`);
          break;
        }
      } catch (e) {
        lastError = e as Error;
        console.log(`Attempt with ${attempt.model} failed:`, e);
        
        // Don't retry on rate limits or payment issues
        if (lastError.message.includes("AI_ERROR:429") || lastError.message.includes("AI_ERROR:402")) {
          break;
        }
      }
    }

    if (!analysis) {
      if (lastError?.message.includes("AI_ERROR:429")) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (lastError?.message.includes("AI_ERROR:402")) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("Failed to analyze floor plan after multiple attempts");
    }

    // Validate and normalize the structure
    const result = analysis as Record<string, unknown>;
    if (!result.walls || !Array.isArray(result.walls)) {
      result.walls = [];
    }
    if (!result.doors || !Array.isArray(result.doors)) {
      result.doors = [];
    }
    if (!result.windows || !Array.isArray(result.windows)) {
      result.windows = [];
    }
    if (!result.rooms || !Array.isArray(result.rooms)) {
      result.rooms = [];
    }
    if (!result.ignoreRegions || !Array.isArray(result.ignoreRegions)) {
      result.ignoreRegions = [];
    }

    console.log(`Raw analysis: ${(result.walls as unknown[]).length} walls, ${(result.doors as unknown[]).length} doors, ${(result.windows as unknown[]).length} windows`);

    // Apply post-processing to walls
    if ((result.walls as WallData[]).length > 0) {
      result.walls = postProcessWalls(result.walls as WallData[]);
    }

    console.log(`Final result: ${(result.walls as unknown[]).length} walls, ${(result.doors as unknown[]).length} doors, ${(result.windows as unknown[]).length} windows`);

    return new Response(
      JSON.stringify({ success: true, analysis: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Floor plan analysis error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
