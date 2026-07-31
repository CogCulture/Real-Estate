# Full Codebase Audit — 9 Questions

---

## Q1 — `claude_master_prompt.txt` placeholder / `project_features` data path

### Root cause: the placeholder never exists

[claude_master_prompt.txt](file:///d:/RE%202.0/masterplan/claude_master_prompt.txt) contains exactly two bytes of content:

```
You are a luxury masterplan layout engine. Output only valid JSON.
```

There is **no `[Insert the generated JSON configuration here]` substring anywhere in that file.**

The `.replace()` call in [ai.py L194](file:///d:/RE%202.0/masterplan/backend/routers/ai.py#L188-L197):

```python
master_prompt = master_prompt.replace(
    "[Insert the generated JSON configuration here]",
    json.dumps(project_features, indent=2)
)
```

…finds zero matches and returns the string unchanged. `project_features` is silently discarded from that branch.

**However** — `project_features` is NOT entirely lost. The code builds a separate `user_reqs_str` block (L140–L182) and prepends it to `user_prompt` at L185:

```python
user_prompt = user_reqs_str + boundary_context + user_prompt
```

So `project_features` **does** reach the prompt through the `user_reqs_str` prepend — but only the fields explicitly extracted (theme, building types, site_analysis, zoning_rules, setbacks, green_area_pct, safety_tier). Fields like `unit_specifications`, `clubhouse`, `sustainability`, `green_building`, `basement_parking_per_unit` are **never referenced** in that extraction block and are silently dropped.

### Full data path

```
ProjectRequirementsForm.jsx (onSubmit(formData))
  → NewProject.jsx handleFormSubmit (L119)
      → createProject({ features: JSON.stringify(formData) })   ← stored as TEXT in DB
          → projects.py POST /projects → masterplan.db projects.features column

Toolbar.jsx "Generate Layout" button (L314)
  → generateSuggestedLayout(meta.site_width_m, meta.site_height_m, projectId, {
        boundary_geojson, scale, land_offset_x_m, land_offset_y_m,
        north_angle_deg, showNumberLegend, showSetback
    })                     ← ⚠️ formData / project_features NOT passed here
  → fetch('/api/ai/suggest', { body: { project_id, site_width_m, site_height_m, features } })
        where features = the meta-only object above (no project_features)

ai.py /ai/suggest handler:
  → IGNORES request.features entirely (never read after L53 model def)
  → Queries DB: SELECT features, boundary_geojson FROM projects WHERE id = ?   (L104)
  → project_features = json.loads(row['features'])   ← ✅ correctly loaded from DB
  → Builds user_reqs_str from a partial extraction   ← ⚠️ drops clubhouse, unit_specs, sustainability, green_building, basement_parking
  → Tries to use claude_master_prompt.txt .replace()  ← ⚠️ no-op (placeholder absent)
  → Assembles: user_reqs_str + boundary_context + USER_PROMPT_TEMPLATE
  → Sends to Claude
```

### Where user input stops affecting output

**Step 1** — In `Toolbar.jsx`, `generateSuggestedLayout` is called without `project_features`; it passes only canvas-meta fields. The `features` argument sent to `/api/ai/suggest` body contains **no form data**. (This doesn't matter because the backend reads features from the DB anyway.)

**Step 2** — In `ai.py`, the `user_reqs_str` extraction loop skips: `unit_specifications`, `clubhouse`, `sustainability`, `green_building`, `basement_parking_per_unit`. These never enter the prompt.

**Step 3** — The `claude_master_prompt.txt` branch is a no-op (placeholder absent), so the master prompt adds nothing but a generic one-liner prepended before the real prompt.

### Fixes required
1. Add `[Insert the generated JSON configuration here]` into `claude_master_prompt.txt`, or remove the `.replace()` dead code and expand the `user_reqs_str` block to include the missing fields.
2. Extract `unit_specifications`, `clubhouse` (flattened), `sustainability`, `green_building`, `basement_parking_per_unit` into `user_reqs_str`.

---

## Q2 — Same as Q1 (traced above). Exact step where input stops affecting output

> **Toolbar.jsx L314–L322**: `generateSuggestedLayout(...)` — form data is never included in this call. The backend compensates by reading the DB, but:
> **ai.py L140–L182**: only 10 of the ~15 formData fields are extracted into the prompt. The rest are silently skipped.

---

## Q3 — BoundaryEngine / CollisionEngine: detect-only, no repair

`BoundaryEngine.process()` ([planning_engine.py L154–L239](file:///d:/RE%202.0/masterplan/backend/planning_engine.py#L154-L239)) only appends to `masterplan_json["boundary_violations"]`. It never moves anything.

`CollisionEngine.process()` ([planning_engine.py L241–L302](file:///d:/RE%202.0/masterplan/backend/planning_engine.py#L241-L302)) only appends to `masterplan_json["conflicts"]`. It never moves anything.

`resolve_layout()` ([planning_engine.py L374–L553](file:///d:/RE%202.0/masterplan/backend/planning_engine.py#L374-L553)) **does** do a repair pass — it pushes overlapping elements apart (50 iterations, AABB-based) and clamps to boundary/margin. **However:**

- It is called **before** BoundaryEngine and CollisionEngine (L239 in ai.py), so violations detected by those engines after `resolve_layout` returns are never repaired.
- The clamping uses `margin = 0.06` (matches `SETBACKS`) ✅, but the push logic uses a simplified `required_gap` (0.04 tower-tower, 0.02 otherwise) that doesn't match the full `SETBACKS` dict for every pair type (e.g., amenity-boundary uses 0.04 in SETBACKS but 0.02 in resolve_layout).
- No road-point clamping is done in `resolve_layout` — only towers and amenities.

### Fix required
Call `resolve_layout` **after** BoundaryEngine+CollisionEngine (or merge it with a second-pass re-check), and align the per-pair gap values to the `SETBACKS` dict.

---

## Q4 — Should /ai/suggest retry on grade C/F?

**Currently**: [ai.py L238–L250](file:///d:/RE%202.0/masterplan/backend/routers/ai.py#L238-L250) — after `resolve_layout` + BoundaryEngine + CollisionEngine, the result is returned regardless of `report['grade']`. A grade F layout is returned to the frontend without any retry.

**Answer: Yes, a bounded retry loop should be implemented.** The conflicts and boundary_violations are already structured data — they can be injected into a follow-up prompt. Suggested shape:

```python
MAX_RETRIES = 2
for attempt in range(MAX_RETRIES + 1):
    # ... call Claude, parse, resolve, validate ...
    if report['grade'] in ('A', 'B'):
        break
    if attempt < MAX_RETRIES:
        # append conflict feedback to user_prompt and retry
        ...
# if still C/F: return procedural fallback
```

The procedural fallback already partially exists (the hardcoded tower positions in `USER_PROMPT_TEMPLATE` lines 71–75 are a static seed). A true procedural fallback should place towers on an ellipse deterministically (see Q5).

---

## Q5 — Geometry should be procedural; Claude chooses content only

**Currently**: Claude generates all x_pct/y_pct for towers, all bezier control points for roads, and all amenity positions. This is the primary cause of collision and boundary violations — the LLM guesses numbers.

**Proposed split:**

| Layer | Who generates it |
|---|---|
| Tower positions (on ellipse ring) | Procedural (Python) |
| Loop road bezier points (ellipse hull) | Procedural (Python) |
| Jogging track (concentric ellipse, inner offset) | Procedural (Python) |
| Entry boulevard axis (centroid → entry point) | Procedural (Python) |
| Amenity type list, unit mix, theme, land-use %, tower footprint style, labels | Claude |
| Tree cluster density/positions (gaps between towers) | Claude or simple fill algorithm |

**What that split looks like:**

```python
# BEFORE Claude call — compute deterministic geometry
cx, cy = get_polygon_centroid(boundary_poly)  # already available
a, b = 0.30, 0.22  # ellipse semi-axes (tunable by site aspect ratio)
n_towers = 8
tower_positions = [
    (cx + a * math.cos(2*math.pi*i/n_towers),
     cy + b * math.sin(2*math.pi*i/n_towers))
    for i in range(n_towers)
]
loop_road_pts = [  # same ellipse, slightly larger
    (cx + (a+0.04) * math.cos(2*math.pi*i/32),
     cy + (b+0.04) * math.sin(2*math.pi*i/32))
    for i in range(33)
]
jogging_pts = [   # inner offset
    (cx + (a-0.06) * math.cos(2*math.pi*i/32),
     cy + (b-0.06) * math.sin(2*math.pi*i/32))
    for i in range(33)
]

# Claude prompt is stripped down — no coordinate output required for geometry
CONTENT_PROMPT = """
Given these pre-placed tower positions {tower_positions}:
Choose for each tower: footprint_style (cruciform/h_shaped/u_shaped/courtyard), floors, unit_type, label.
Choose: which amenities to place in the central zone (names + types only, no coordinates).
Choose: land_use percentages, project name, theme.
Output JSON matching this schema: {...}
"""
```

Then the backend assembles the final layout by merging Claude's content choices with the deterministic geometry.

---

## Q6 — Existing shape/placement utility reuse

[`planningEngine.js`](file:///d:/RE%202.0/masterplan/frontend/src/utils/planningEngine.js) contains ellipse/geometry logic references but **no deterministic tower-ring or ellipse-path generator** — it mainly handles the API call and fallback layout (hardcoded static positions, L60–L67).

[`geoUtils.js`](file:///d:/RE%202.0/masterplan/frontend/src/utils/geoUtils.js) has:
- `calculatePolygonArea` — shoelace formula ✅
- `rotatePoint(x, y, cx, cy, angleRad)` — ✅ reusable for rotating ellipse ring
- `getBoundingBoxMeters` — ✅ gives site aspect ratio needed to size ellipse axes
- `rotateLatLngs` — GeoJSON rotation (not directly useful here)

**Verdict**: `rotatePoint` from `geoUtils.js` + `get_polygon_centroid` from `planning_engine.py` are the reusable primitives. Neither file has an ellipse ring generator. One needs to be written — but it's ~10 lines of math; no new library is needed.

---

## Q7 — Does Canvas2D render a street-grid basemap under the editor?

**Yes, but conditionally.** [Canvas2D.jsx L1416–L1524](file:///d:/RE%202.0/masterplan/frontend/src/components/editor/Canvas2D.jsx#L1416-L1524) initializes a Leaflet map when `viewMode === 'satellite'` or `viewMode === 'street'`. It uses:
- `satellite`: ArcGIS World Imagery tiles
- `street`: OpenStreetMap tiles (standard raster, not vector)

The Leaflet `<div>` is rendered at [L3690–L3691](file:///d:/RE%202.0/masterplan/frontend/src/components/editor/Canvas2D.jsx#L3690-L3691):
```jsx
{(viewMode === 'satellite' || viewMode === 'street') && (
  <div ref={mapContainerRef} ... />
)}
```

**In the editor**, `viewMode` is initialized from `localStorage.getItem('masterplan_viewMode') || 'street'` ([Editor.jsx L49](file:///d:/RE%202.0/masterplan/frontend/src/pages/Editor.jsx#L49)). So by default the street basemap **is wired up and active** in the editor.

However: the Konva Stage is rendered on top of the Leaflet `<div>` with a transparent background when `viewMode === 'street'` ([Canvas2D.jsx L3797–L3798](file:///d:/RE%202.0/masterplan/frontend/src/components/editor/Canvas2D.jsx#L3795-L3798)). The basemap shows through as long as the Stage background is transparent. This is already working.

**What's needed to improve it**: The Leaflet map and Konva stage sync zoom/pan but the geographic alignment depends on `currentProject.lat/lng` being set. If a project has no location, the basemap will be at 0,0. No additional wiring changes are needed for the current architecture — it works when lat/lng is set.

---

## Q8 — Canvas2D road/tree styling vs. racetrack-style reference

**Current road rendering (Canvas2D.jsx)**:
- Roads are rendered as Konva `Line` elements using bezier curves.
- Width is set from `road.width_px`.
- **No lane markings, no median stripe, no sidewalk lines are drawn.** The road is a single filled stroke.
- Tree clusters: rendered as grouped `Circle` elements with a green fill — no individual tree canopy textures, no variation in density visualization.
- Amenity icons: rendered as labeled rectangles/ellipses with color fills from `colorMap.js`. No SVG icons.

**Reference layout targets**: numbered tower markers, concentric jogging path, clustered central amenities — the layout data structure supports all of these (towers have `label`, pedestrian_paths has jogging type, amenities cluster in center). The geometry is generated but the **render quality** doesn't match the reference because:

1. **Roads** — missing dashed center-line (median), no dual-stroke (asphalt band + curb lines)
2. **Tree clusters** — need a "dot matrix" or canvas-noise approach for density, not uniform circles
3. **Tower markers** — legend number overlay exists in the store but needs to be rendered prominently on each tower footprint
4. **Jogging track** — data exists but rendered identically to roads (no dashed-line style distinction)

**Fastest path to close the gap**:
- Road median: add a second `Line` with `dash={[8,8]}` + white stroke on top of the road line (1–2 lines of Konva JSX)
- Tower number badge: render a `Circle` + `Text` at tower center using `getLegendNumber(zone.label)`
- Jogging track style: check `road.type === 'pedestrian'` and apply `dash={[5,10]}` + narrower stroke

---

## Q9 — Recent commits impact on layout quality

**6 commits total** touching these files:

| Commit | Message | Files in scope |
|---|---|---|
| `dd27d30` | Add new components, assets, canvas modules... | Canvas2D (added), ai.py (initial), planning_engine.py (initial) |
| `36041e4` | Automated update | Unknown (all three plausibly touched) |
| `95b3a51` | Fix tree cluster background box visibility | Canvas2D |
| `0d55101` | Enhance shapes and UI | Canvas2D, likely ai.py |
| `97b0d0e` | Process new pool images | Assets only |
| `c6abfcf` | Initial commit | All |

`dd27d30` was a massive initial dump (225 files, 18k+ insertions) — it established the current state with all existing bugs already present. No subsequent commit meaningfully changes `ai.py` or `planning_engine.py` based on the log. `95b3a51` and `0d55101` touch Canvas2D for visual fixes (tree background, shapes) — **neither improves nor degrades layout quality** since they are rendering-only changes. No commit has improved collision resolution or prompt assembly.

**Net effect on layout quality**: The layout pipeline is unchanged since initial commit. The bugs (placeholder no-op, dropped form fields, no retry loop) have been present since day one.

---

## Q10 — Other places ANTHROPIC_MODEL / Claude call is configured

| Location | Value |
|---|---|
| [.env L4](file:///d:/RE%202.0/masterplan/backend/.env#L4) | `ANTHROPIC_MODEL=claude-sonnet-4-6` |
| [ai.py L81](file:///d:/RE%202.0/masterplan/backend/routers/ai.py#L81) | `os.environ.get("ANTHROPIC_MODEL", "claude-3-5-sonnet-20240620")` |

**Only one call site** — `/ai/suggest` in `ai.py`. No other router or script calls Claude.

**The `.env` is correctly set to `claude-sonnet-4-6`**, so in production the default fallback (`claude-3-5-sonnet-20240620`) is never reached — the env var overrides it. The hardcoded fallback in code is stale but harmless since `.env` is always loaded by the FastAPI app.

The reason it was originally defaulting to `claude-3-5-sonnet-20240620` is simply that it was the stable Sonnet at initial commit time. The `.env` has since been updated to `claude-sonnet-4-6` which is the correct current model.

---

## Summary of actionable bugs (prioritized)

| # | Bug | File | Severity |
|---|---|---|---|
| 1 | `claude_master_prompt.txt` missing placeholder — `.replace()` is a no-op | ai.py L194, claude_master_prompt.txt | High |
| 2 | `unit_specifications`, `clubhouse`, `sustainability`, `green_building`, `basement_parking_per_unit` never enter the prompt | ai.py L140–L182 | High |
| 3 | No retry on grade C/F — bad layout returned to frontend | ai.py L238–L250 | High |
| 4 | `resolve_layout` called before BoundaryEngine/CollisionEngine — detected violations are never repaired | ai.py L239–L248 | Medium |
| 5 | `resolve_layout` gap values don't match full `SETBACKS` dict | planning_engine.py L427 | Medium |
| 6 | Road vertices never clamped/repaired in `resolve_layout` | planning_engine.py L374–L553 | Medium |
| 7 | Geometry (tower positions, loop road, jogging track) generated by LLM instead of procedurally | ai.py USER_PROMPT_TEMPLATE | Medium |
| 8 | Roads missing lane markings / median stripe in Canvas2D | Canvas2D.jsx | Low |
| 9 | `claude_master_prompt.txt` fallback default model string stale | ai.py L81 | Low (already overridden by .env) |
