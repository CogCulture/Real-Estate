from fastapi import APIRouter, Depends, HTTPException
from typing import List
import uuid
import json
import os
import litellm
from database import get_db
from models import AiSuggestRequest, ApiUsageResponse
import aiosqlite
from planning_engine import BoundaryEngine, CollisionEngine, generate_report

router = APIRouter()

SYSTEM_PROMPT = """You are an expert architectural masterplan layout engine. You produce ONLY valid JSON. No markdown, no explanation, no preamble — just raw JSON.

ABSOLUTE CONSTRAINTS:
1. All positions are percentages (0.0 to 1.0) of canvas width and height.
2. ALL elements MUST stay within the 0.06 to 0.94 range. Nothing goes outside the site boundary.
3. NO two elements may overlap. Maintain minimum 0.02 (2%) gap between any two structures.
4. Road widths are in METERS. Realistic widths: internal roads 7m, collector roads 9-10m, main boulevard 12m, arterial max 15m. NEVER exceed 15m.
5. Tower footprints are realistic: width 20-35m, depth 15-25m. In percentage terms on a typical site this is roughly 0.06-0.10 width_pct and 0.04-0.08 height_pct.
6. Amenity sizes: clubhouse ~40x25m, pool ~25x12m, tennis court ~24x11m, kids area ~15x15m. Scale percentages accordingly.
7. Think of this as a REAL architectural site plan with precise geometry — not abstract art."""

USER_PROMPT_TEMPLATE = """Generate a masterplan layout for a site that is {site_width_m}m wide x {site_height_m}m tall.

DIMENSIONAL REALITY CHECK:
- Site is {site_width_m}m x {site_height_m}m
- A tower footprint is about 25m x 20m = roughly {tower_w_pct:.3f} x {tower_h_pct:.3f} in percentage
- A 12m wide boulevard = {road_12m_pct:.4f} in width_meters (use this exact value)
- A 9m collector road = 9 in width_meters
- A 7m internal road = 7 in width_meters
- NEVER set road width_meters above 15

OUTPUT RULES:
- Return ONLY a valid JSON object
- All coordinates are percentages of canvas (0.0 to 1.0)
- No coordinate below 0.06 or above 0.94
- Minimum 6 towers, maximum 8 towers
- Roads use bezier tension curves (tension 0.3-0.5)
- Every element must have a unique position with NO overlaps
- Maintain at least 0.02 gap between all structures

REQUIRED JSON STRUCTURE:
{{
  "project": {{ "name": "...", "total_area_acres": ..., "total_towers": ..., "theme": "..." }},
  "land_use": {{ "residential_pct": ..., "roads_pct": ..., "amenities_pct": ..., "open_spaces_pct": ..., "parks_pct": ... }},
  "entry_points": [{{ "id": "...", "side": "south|north", "x_pct": ..., "y_pct": ..., "type": "main|secondary", "label": "..." }}],
  "roads": [{{ "id": "...", "type": "boulevard|loop|internal", "width_meters": 7|9|10|12, "points": [[x,y],...], "tension": 0.4, "has_median": true|false, "has_sidewalks": true, "has_trees": true }}],
  "towers": [{{ "id": "...", "label": "...", "footprint": "cruciform|h_shaped|u_shaped|courtyard", "x_pct": ..., "y_pct": ..., "width_pct": {tower_w_pct:.3f}, "height_pct": {tower_h_pct:.3f}, "rotation_deg": 0, "floors": 28, "units": 120, "unit_type": "3BHK", "has_arrival_plaza": true, "has_drop_off_loop": true, "has_landscape_buffer": true }}],
  "amenities": [{{ "id": "...", "type": "...", "label": "...", "shape": "rect|ellipse", "x_pct|cx_pct": ..., "y_pct|cy_pct": ..., "width_pct|rx_pct": ..., "height_pct|ry_pct": ... }}],
  "pedestrian_paths": [{{ "id": "...", "type": "jogging|trail", "points": [[x,y],...], "tension": 0.4, "width_meters": 2 }}],
  "landscape": {{
    "tree_clusters": [{{ "id": "...", "cx_pct": ..., "cy_pct": ..., "radius_pct": 0.03, "density": "high|medium" }}],
    "water_features": [{{ "id": "...", "type": "fountain", "cx_pct": ..., "cy_pct": ..., "radius_pct": 0.015 }}],
    "green_buffers": [{{ "id": "...", "type": "boundary_green", "inset_pct": 0.03 }}]
  }}
}}

PLACEMENT STRATEGY:
1. Place entry points first: main entry at south (y=0.94), secondary at north (y=0.06)
2. Place main boulevard connecting entries through center
3. Place inner loop road around the central amenity zone
4. Place 8 towers AROUND the loop road, evenly distributed, each with {tower_w_pct:.3f} x {tower_h_pct:.3f} size
5. Place clubhouse and amenities INSIDE the loop road
6. Place tree clusters in gaps between towers and along boundaries
7. VERIFY: no tower overlaps another tower, no tower overlaps a road, nothing goes outside 0.06-0.94

Tower approximate positions (distribute evenly):
- Tower A: (0.15, 0.18), Tower B: (0.42, 0.12)
- Tower C: (0.70, 0.18), Tower D: (0.82, 0.42)
- Tower E: (0.75, 0.72), Tower F: (0.50, 0.82)
- Tower G: (0.25, 0.78), Tower H: (0.12, 0.50)

Output ONLY the JSON. Zero other text."""

@router.post("/suggest")
async def suggest_layout(request: AiSuggestRequest, db: aiosqlite.Connection = Depends(get_db)):
    model_name = os.environ.get("ANTHROPIC_MODEL", "claude-3-5-sonnet-20240620")
    api_key = os.environ.get("VITE_ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_API_KEY")
    
    if not api_key:
        raise HTTPException(status_code=500, detail="Anthropic API key not configured in backend.")

    # Calculate realistic percentage sizes based on actual site dimensions
    sw = request.site_width_m
    sh = request.site_height_m
    tower_w_pct = min(30.0 / sw, 0.10)   # ~30m tower width
    tower_h_pct = min(22.0 / sh, 0.08)   # ~22m tower depth
    road_12m_pct = 12.0 / sw

    try:
        user_prompt = USER_PROMPT_TEMPLATE.format(
            site_width_m=sw,
            site_height_m=sh,
            tower_w_pct=tower_w_pct,
            tower_h_pct=tower_h_pct,
            road_12m_pct=road_12m_pct
        )

        # Fetch features from DB
        async with db.execute("SELECT features FROM projects WHERE id = ?", (request.project_id,)) as cursor:
            row = await cursor.fetchone()
            if row and row['features']:
                try:
                    project_features = json.loads(row['features'])
                except json.JSONDecodeError:
                    project_features = None
            else:
                project_features = None

        if project_features:
            prompt_path = os.path.join(os.path.dirname(__file__), "../../claude_master_prompt.txt")
            if os.path.exists(prompt_path):
                with open(prompt_path, "r") as f:
                    master_prompt = f.read()
                
                # Inject the user features
                master_prompt = master_prompt.replace("[Insert the generated JSON configuration here]", json.dumps(project_features, indent=2))
                
                # Prepend the architectural context, then append the JSON output rules
                user_prompt = master_prompt + "\n\nCRITICAL OUTPUT REQUIREMENT:\nYou MUST output ONLY a valid JSON object. Zero other text. Do NOT wrap in markdown code blocks.\n\n" + user_prompt

        response = await litellm.acompletion(
            model=f"anthropic/{model_name}",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt}
            ],
            api_key=api_key,
            max_tokens=8000
        )
        
        content = response.choices[0].message.content
        usage = response.usage
        
        # Calculate cost
        try:
            cost = litellm.cost_calculator.completion_cost(completion_response=response)
        except Exception:
            cost = 0.0
        
        # Save usage to db
        usage_id = f"usage_{uuid.uuid4().hex[:8]}"
        await db.execute("""
            INSERT INTO api_usage (id, project_id, model, prompt_tokens, completion_tokens, cost)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            usage_id,
            request.project_id,
            model_name,
            usage.prompt_tokens,
            usage.completion_tokens,
            cost
        ))
        await db.commit()

        start = content.find('{')
        end = content.rfind('}') + 1
        if start >= 0 and end > start:
            layout_json = json.loads(content[start:end])
            
            raw = layout_json
            boundary_result = BoundaryEngine().process(raw)
            collision_result = CollisionEngine().process(boundary_result)
            report = generate_report(
                collision_result,
                collision_result.get("conflicts", []),
                collision_result.get("boundary_violations", [])
            )
            collision_result["validation"] = report
            return collision_result
        else:
            raise HTTPException(status_code=500, detail="Failed to parse JSON from LLM response")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/usage", response_model=List[ApiUsageResponse])
async def get_api_usage(db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("""
        SELECT id, project_id, model, prompt_tokens, completion_tokens, cost, created_at 
        FROM api_usage
        ORDER BY created_at DESC
    """)
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]
