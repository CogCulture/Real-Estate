from fastapi import APIRouter, Depends, HTTPException
from typing import List
import uuid
import json
import os
import litellm
from database import get_db
from models import AiSuggestRequest, ApiUsageResponse
import aiosqlite
from planning_engine import BoundaryEngine, CollisionEngine, generate_report, get_boundary_coords_pct, get_polygon_centroid, resolve_layout, generate_procedural_fallback, merge_layout_choices, resolve_selected_slots

router = APIRouter()

SYSTEM_PROMPT = """You are an expert luxury masterplan configuration engine. You produce ONLY valid JSON. No markdown, no explanation, no preamble — just raw JSON.
Your task is to SELECT valid tower positions from a pre-validated candidate pool and configure semantic choices for the layout. All candidate slots have been mathematically pre-calculated to respect setbacks, boundaries, and collision safety."""

USER_PROMPT_TEMPLATE = """Configure a luxury masterplan layout for a site that is {site_width_m}m wide x {site_height_m}m tall.

CANDIDATE TOWER SLOTS (pre-validated for containment/spacing):
{candidate_slots_list}

Your task: SELECT exactly {total_towers} slots from the pool above by ID.
Assign each selected slot: label, footprint, rotation, floors, units, unit_type.

Amenities to configure:
{amenities_list}

REQUIRED OUTPUT JSON STRUCTURE:
{{
  "selected_tower_slots": ["slot_0", "slot_3", "slot_7"],  // Exactly {total_towers} slot IDs from the pool above
  "project": {{ "name": "...", "total_area_acres": ..., "total_towers": {total_towers}, "theme": "..." }},
  "land_use": {{ "residential_pct": ..., "roads_pct": ..., "amenities_pct": ..., "open_spaces_pct": ..., "parks_pct": ... }},
  "towers": [
    {{
      "id": "tower_a",
      "label": "Tower A",
      "footprint": "cruciform|h_shaped|u_shaped|courtyard",
      "rotation_deg": 0|45|90|135,
      "floors": 28,
      "units": 120,
      "unit_type": "3BHK|4BHK",
      "has_arrival_plaza": true,
      "has_drop_off_loop": true,
      "has_landscape_buffer": true
    }}
  ],
  "amenities": [
    {{
      "id": "clubhouse",
      "type": "clubhouse",
      "label": "..."
    }}
  ],
  "landscape": {{
    "tree_clusters": [
      {{ "id": "tc_0", "density": "high|medium" }}
    ]
  }}
}}

OUTPUT RULES:
- Return ONLY the JSON object. Zero other text.
- You may only select from the provided slot IDs. Do not invent new coordinates.
- selected_tower_slots must contain exactly {total_towers} valid slot IDs from the pool.
- Match amenity IDs exactly as provided.
- Customize tower heights, unit distributions, footprints, naming, and theme to align with the client preferences below."""

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

        # Fetch features and boundary_geojson from DB
        async with db.execute("SELECT features, boundary_geojson FROM projects WHERE id = ?", (request.project_id,)) as cursor:
            row = await cursor.fetchone()
            if row:
                try:
                    project_features = json.loads(row['features']) if row['features'] else None
                except json.JSONDecodeError:
                    project_features = None
                boundary_geojson = row['boundary_geojson']
            else:
                project_features = None
                boundary_geojson = None

        # Build boundary coordinates and centroid if boundary geojson exists
        boundary_coords_str = ""
        centroid_str = ""
        boundary_poly = None
        if boundary_geojson:
            boundary_poly = get_boundary_coords_pct(boundary_geojson, sw, sh)
            if boundary_poly:
                boundary_coords_str = f"Site Boundary Polygon Coordinates (in 0.0 to 1.0 percentage space):\n{json.dumps(boundary_poly)}\n"
                centroid = get_polygon_centroid(boundary_poly)
                centroid_str = f"Centroid (geometric center) of the site boundary: x={centroid[0]:.4f}, y={centroid[1]:.4f}\n"

        # Inject boundary polygon details into the prompt
        boundary_context = ""
        if boundary_coords_str:
            boundary_context = (
                f"\nSITEMAP GEOMETRY & BOUNDARIES:\n{boundary_coords_str}{centroid_str}"
                f"- CRITICAL: The site is NOT a simple rectangle. You must ensure that ALL placed towers, amenities, and road vertices fall STRICTLY INSIDE the polygon coordinates listed above.\n"
                f"- Centering: The central lawn, main clubhouse, and inner loop road MUST be centered around the site centroid ({centroid[0]:.4f}, {centroid[1]:.4f}) rather than the generic center (0.5, 0.5).\n"
            )
        else:
            boundary_context = "\n- Keep all elements within the 0.15 to 0.85 percentage bounding box range to ensure safety.\n"

        # Construct requirements from features
        user_reqs_str = ""
        if project_features:
            user_reqs = []
            if "project_specification" in project_features:
                user_reqs.append(f"- Building Types: {', '.join(project_features['project_specification'])}")
            if "theme" in project_features:
                user_reqs.append(f"- Theme: {project_features['theme']}")
            if "green_area_pct" in project_features:
                user_reqs.append(f"- Target Green Area: {project_features['green_area_pct']}%")
            if "safety_tier" in project_features:
                user_reqs.append(f"- Safety Tier: {project_features['safety_tier']}")
            
            # Site Analysis
            sa = project_features.get("site_analysis", {})
            if sa:
                if "topography" in sa:
                    user_reqs.append(f"- Site Topography: {sa['topography']}")
                if "orientation" in sa:
                    user_reqs.append(f"- Site Orientation: {sa['orientation']}")
                if "soil_type" in sa:
                    user_reqs.append(f"- Soil Type: {sa['soil_type']}")
                if "climate" in sa:
                    user_reqs.append(f"- Climate Zone: {sa['climate']}")
                if "vegetation" in sa:
                    user_reqs.append(f"- Existing Vegetation/Water: {sa['vegetation']}")
                if "views" in sa:
                    user_reqs.append(f"- Surrounding Views/Screening: {sa['views']}")

            # Zoning Rules
            zoning = project_features.get("zoning_rules", {})
            if zoning:
                if "tower_orientation" in zoning:
                    user_reqs.append(f"- Residential Tower Orientation: {zoning['tower_orientation']}")
                if "amenity_layout" in zoning:
                    user_reqs.append(f"- Zoning/Amenity Layout Preference: {zoning['amenity_layout']}")
                if "road_type" in zoning:
                    user_reqs.append(f"- Internal Road style: {zoning['road_type']}")
                if "density_distribution" in zoning:
                    user_reqs.append(f"- Spacing & Density Distribution: {zoning['density_distribution']}")
            
            # Setbacks
            user_reqs.append(f"- Setbacks: Front={project_features.get('front_setback_m', 6.0)}m, Rear={project_features.get('rear_setback_m', 6.0)}m, Sides={project_features.get('side_setback_m', 6.0)}m")
            
            # Additional features
            if "unit_specifications" in project_features:
                us = project_features["unit_specifications"]
                user_reqs.append(f"- Unit Specifications: {json.dumps(us)}")
            if "clubhouse" in project_features:
                user_reqs.append(f"- Clubhouse Features: {json.dumps(project_features['clubhouse'])}")
            if "sustainability" in project_features:
                user_reqs.append(f"- Sustainability Requirements: {project_features['sustainability']}")
            if "green_building" in project_features:
                user_reqs.append(f"- Green Building Standard: {project_features['green_building']}")
            if "basement_parking_per_unit" in project_features:
                user_reqs.append(f"- Basement Parking per Unit: {project_features['basement_parking_per_unit']}")

            user_reqs_str = "USER DESIGN REQUIREMENTS & PREFERENCES:\n" + "\n".join(user_reqs) + "\n\n"

        # Generate the procedural geometry template first
        template_layout = generate_procedural_fallback(sw, sh, project_features, boundary_poly)
        template_layout = resolve_layout(template_layout, boundary_poly, sw, sh, project_features)

        # Build candidate slots list for Claude selection
        candidate_slots_list = []
        for slot in template_layout.get("candidate_slots", []):
            candidate_slots_list.append(f"- ID: {slot['id']}, Center: ({slot['cx']:.4f}, {slot['cy']:.4f}), Max Footprint: {slot['max_width_pct']:.4f} x {slot['max_height_pct']:.4f}")
        candidate_slots_str = "\n".join(candidate_slots_list)

        amenities_list = []
        for a in template_layout.get("amenities", []):
            label = a.get("label", a.get("id"))
            amenities_list.append(f"- ID: {a['id']}, Type: {a['type']}, Default Label: {label}")
        amenities_list_str = "\n".join(amenities_list)

        total_towers = len(template_layout.get("towers", []))

        # Add site-analysis signals
        site_context = ""
        if boundary_poly:
            xs = [p[0] for p in boundary_poly]
            ys = [p[1] for p in boundary_poly]
            bbox_w = max(xs) - min(xs)
            bbox_h = max(ys) - min(ys)
            site_orientation = "horizontal" if bbox_w > bbox_h else "vertical"
            site_context += f"- Site long-axis orientation: {site_orientation}\n"

        if boundary_geojson:
            try:
                geojson = json.loads(boundary_geojson) if isinstance(boundary_geojson, str) else boundary_geojson
                coords = geojson.get("geometry", {}).get("coordinates", [[]])[0]
                lats = [c[1] for c in coords]
                if lats:
                    avg_lat = sum(lats) / len(lats)
                    sun_preference = "south-facing frontage preferred" if avg_lat > 0 else "north-facing frontage preferred"
                    site_context += f"- Sun path: {sun_preference}\n"
            except Exception:
                pass

        formatted_prompt = USER_PROMPT_TEMPLATE.format(
            site_width_m=sw,
            site_height_m=sh,
            candidate_slots_list=candidate_slots_str,
            amenities_list=amenities_list_str,
            total_towers=total_towers
        )
        
        # Final assembly of prompt
        user_prompt = user_reqs_str + boundary_context + site_context + formatted_prompt

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt}
        ]

        MAX_ATTEMPTS = 3
        for attempt in range(MAX_ATTEMPTS):
            try:
                response = await litellm.acompletion(
                    model=f"anthropic/{model_name}",
                    messages=messages,
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

                    # Validate selected slot IDs
                    selected_ids = layout_json.get("selected_tower_slots", [])
                    candidate_pool = template_layout.get("candidate_slots", [])
                    valid_slots, invalid_ids = resolve_selected_slots(selected_ids, candidate_pool)

                    if invalid_ids:
                        if attempt < MAX_ATTEMPTS - 1:
                            err_msg = f"Invalid slot IDs selected: {invalid_ids}. Only use valid slot IDs from the provided pool."
                            messages.append({"role": "assistant", "content": content})
                            messages.append({"role": "user", "content": f"ERROR: {err_msg}. Please try again with valid slot IDs only."})
                            continue
                        else:
                            raise HTTPException(status_code=400, detail=f"Invalid slot IDs: {invalid_ids}")

                    # Map selected slots to tower positions
                    if valid_slots:
                        # Reorder towers based on Claude's selection order
                        tower_configs = layout_json.get("towers", [])
                        reordered_towers = []
                        for i, slot in enumerate(valid_slots):
                            if i < len(tower_configs):
                                tower_config = tower_configs[i]
                                tower_config["x_pct"] = round(slot["cx"] - slot["max_width_pct"] / 2, 4)
                                tower_config["y_pct"] = round(slot["cy"] - slot["max_height_pct"] / 2, 4)
                                tower_config["width_pct"] = slot["max_width_pct"]
                                tower_config["height_pct"] = slot["max_height_pct"]
                                reordered_towers.append(tower_config)
                        layout_json["towers"] = reordered_towers

                    # Merge Claude's custom attributes into our safe procedural geometry template
                    merged_layout = merge_layout_choices(template_layout, layout_json)
                    merged_layout = resolve_layout(merged_layout, boundary_poly, sw, sh, project_features)
                    
                    raw = merged_layout
                    boundary_result = BoundaryEngine().process(raw, boundary_geojson=boundary_geojson, site_width=sw, site_height=sh)
                    collision_result = CollisionEngine().process(boundary_result)
                    
                    # If there are conflicts or violations, run resolve_layout and engines a second time to ensure correctness
                    if collision_result.get("conflicts") or collision_result.get("boundary_violations"):
                        merged_layout = resolve_layout(collision_result, boundary_poly, sw, sh, project_features)
                        boundary_result = BoundaryEngine().process(merged_layout, boundary_geojson=boundary_geojson, site_width=sw, site_height=sh)
                        collision_result = CollisionEngine().process(boundary_result)
                        
                    report = generate_report(
                        collision_result,
                        collision_result.get("conflicts", []),
                        collision_result.get("boundary_violations", [])
                    )
                    
                    grade = report.get("grade", "F")
                    if grade in ("A", "B"):
                        collision_result["validation"] = report
                        return collision_result
                    else:
                        if attempt < MAX_ATTEMPTS - 1:
                            conflicts_desc = []
                            for c in collision_result.get("conflicts", []):
                                conflicts_desc.append(f"- Overlap between {c.get('element_a')} and {c.get('element_b')} (severity: {c.get('severity')})")
                            violations_desc = []
                            for v in collision_result.get("boundary_violations", []):
                                violations_desc.append(f"- Boundary violation by {v.get('element_id')} of type {v.get('element_type')}: {v.get('violation')}")
                            
                            err_msg = f"Your generated layout failed validation with Grade {grade}."
                            if conflicts_desc:
                                err_msg += "\nConflicts:\n" + "\n".join(conflicts_desc)
                            if violations_desc:
                                err_msg += "\nBoundary Violations:\n" + "\n".join(violations_desc)
                            err_msg += "\nPlease correct these spacing/boundary issues and output a complete, corrected JSON masterplan."
                            
                            messages.append({"role": "assistant", "content": content})
                            messages.append({"role": "user", "content": err_msg})
                else:
                    if attempt < MAX_ATTEMPTS - 1:
                        messages.append({"role": "assistant", "content": content})
                        messages.append({"role": "user", "content": "Failed to parse JSON. Please return ONLY a valid JSON object without any additional conversational text or markdown code blocks."})
            except Exception as e:
                print(f"litellm attempt {attempt} failed: {e}")
                if attempt >= MAX_ATTEMPTS - 1:
                    raise e
                    
        # Fallback layout generation
        fallback_layout = generate_procedural_fallback(sw, sh, project_features, boundary_poly)
        fallback_layout = resolve_layout(fallback_layout, boundary_poly, sw, sh, project_features)
        
        boundary_result = BoundaryEngine().process(fallback_layout, boundary_geojson=boundary_geojson, site_width=sw, site_height=sh)
        collision_result = CollisionEngine().process(boundary_result)
        report = generate_report(
            collision_result,
            collision_result.get("conflicts", []),
            collision_result.get("boundary_violations", [])
        )
        report["summary"] += " (Procedural fallback generated after retry exhaustion)"
        collision_result["validation"] = report
        return collision_result
            
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
