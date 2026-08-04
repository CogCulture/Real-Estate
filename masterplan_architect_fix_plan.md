# Masterplan AI Layout Engine — CTO Review: Concerns, Architect-Realism Fixes & Implementation Plan (v3)

Repo: `CogCulture/Real-Estate`, commit `16a1852` ("editor polish").
Live/production layout generator: `masterplan/backend/planning_engine.py` + `masterplan/backend/routers/ai.py` (called from `Toolbar.jsx` → `/api/ai/suggest`). **This is the only engine actually running.**

Note on scope: this repo also contains a second, much more ambitious TypeScript engine at top-level `/src` (`knowledge/`, `optimizer/`, `engines/placement`, `engines/road`, `engines/block`, `planning/circulation`, etc.), plus a stub `server/index.ts` that currently just `sleep()`s through fake pipeline stages. **That engine is not wired to anything the user sees today** — it's a parallel, unfinished "RE 2.0" effort (see `RE2.0_Implementation_Plan.md` Phase 4). Everything below targets the live Python engine. The TS engine's `src/knowledge/jurisdictions/india/nbc.ts` (real NBC 2016 values: FAR ≤2.5, ground coverage ≤0.4, front setback 6m, primary road ≥12m, secondary road ≥9m) is genuinely useful reference data and is called out below where relevant — see Open Questions.

All line numbers below were re-verified directly against the source in this repo, not assumed.

---

## Part A — Confirmed concerns (why the layout looks broken)

These were first raised in a separate audit and I independently re-verified each one against the actual code. All five are **confirmed accurate**:

| # | Concern | Where | Confirmed mechanism |
|---|---|---|---|
| A1 | Tower/road ring is a fixed circle, not shaped to the boundary | `generate_procedural_fallback()`, `planning_engine.py:432` | `tower_radius = 0.28` is a constant applied equally on both axes around the centroid, regardless of the boundary polygon's actual shape or orientation. |
| A2 | Boundary mismatch collapses towers into a pile | `ConstraintSolver.solve()`, `planning_engine.py:735-739` | Any element with a corner outside the polygon gets nudged `0.015` per iteration, for 100 iterations, straight toward **the same centroid**. When most of 8 ring-points start outside an elongated/diagonal site, they all converge on one point. |
| A3 | Roads are never fed into the repair solver | `resolve_layout()`, `planning_engine.py:377-388` | Only `towers` and `amenities` are collected into `elements`. `roads`, `pedestrian_paths`, `entry_points` never enter the solver, so a road point flagged by `BoundaryEngine` as outside the polygon is detected but never fixed. |
| A4 | Boulevard cuts through the loop instead of merging at its edge | `main_boulevard_pts`, `planning_engine.py:458-464` | The boulevard's midpoint sits at `(cx, cy)` — the exact centroid — which is inside the loop road's radius (0.18). The straight run from south entry to north entry slices through the loop's interior instead of stopping at its edge, producing the figure-8/pretzel look. |
| A5 | Grading has no check for either failure mode | `generate_report()`, `planning_engine.py:306-374` | No pairwise minimum-distance check between tower centers (would catch collapse-to-a-point) and no road self-intersection check. |

**Additional finding not in the original audit — the most consequential one:**

| # | Concern | Where | Confirmed mechanism |
|---|---|---|---|
| A6 | Bad layouts are shipped anyway via a hardcoded grade override | `ai.py`, end of `/suggest` handler (~line 299) | After 3 failed Claude retries, the code regenerates the **same broken circular template**, computes a real `report` via `generate_report()`, then does `report["grade"] = "B"` — unconditionally overwriting whatever grade was actually computed — before returning it to the frontend. |

**Why A6 matters most:** `template_layout` (the broken circle geometry) is computed **once**, before the retry loop starts, and Claude is never allowed to touch coordinates (only labels/floors/footprint style via `merge_layout_choices()`). That means for any non-circular site, all 3 retry attempts validate the *exact same* broken geometry and are guaranteed to fail identically. The loop always exhausts, always falls through to A6, and the grade lie always ships. **A1–A5 are why the geometry is bad. A6 is why nobody — not even the app's own QA logic — ever stops it from reaching the user.**

---

## Part B — Confirmed gaps vs. "acts like a real architect"

You asked for the AI to behave like a human architect: realistic land-use accounting, guaranteed road access per building, enforced green space, etc. I checked what real inputs the app already collects vs. what the backend actually does with them. **The intake form already asks for the right things — the backend just throws most of it away.**

| # | Gap | Evidence |
|---|---|---|
| B1 | Tower count is a hardcoded constant, unrelated to site size or land availability | `generate_procedural_fallback()` line 428: `num_towers = 8`, always, whether the site is 2 acres or 20. |
| B2 | No buildable-area / land-availability calculation exists anywhere in the backend | Confirmed via search: no function computes net buildable area (site area − setbacks − roads − mandatory green) anywhere in `planning_engine.py` or `ai.py`. |
| B3 | User's `green_area_pct` (form default 70%, `ProjectRequirementsForm.jsx:37`) is never enforced | It's only interpolated into the Claude prompt as a text line (`ai.py`: `"- Target Green Area: {pct}%"`). Claude's returned `land_use` percentages are merged in verbatim (`merge_layout_choices()` line 583-584) with no validation against the actual drawn geometry, and no check against what the user asked for. |
| B4 | User's setback inputs (`front_setback_m`, `rear_setback_m`, `side_setback_m` — real fields, meters, in the form) never reach the geometry engine | The engine's actual spacing logic uses a completely separate, hardcoded `SETBACKS` dict of small percentage constants (`tower-tower: 0.04`, `tower-boundary: 0.05`, etc.) with **no conversion from or connection to** the user's meter values anywhere in the codebase. |
| B5 | No per-tower road connectivity / frontage check | Towers merely happen to sit near the ring road because of how the circle is constructed — nothing generates a driveway/spur per tower, and nothing validates that a tower actually has road access. If A1/A2 deform the ring (which they do on non-circular sites), towers can end up with zero road connectivity and nothing catches it. |
| B6 | Declared unit counts have no relationship to physical footprint | Tower footprint is a fixed ~30m×22m constant (`tw`/`th`, line 417-418) regardless of the `floors: random.randint(18,36)` and `units: random.randint(80,160)` also randomly assigned to the same tower. A 36-floor tower and an 18-floor tower get the identical footprint and no floor-area/unit-count consistency check exists. |
| B7 | `road.type` values emitted by the backend don't match what the frontend styles as "major" | Backend emits `roads: [{"type": "boulevard"...}, {"type": "loop"...}]` and `pedestrian_paths: [{"type": "jogging"...}]`. `Canvas2D.jsx` (lines 241, 3911, 3966) checks `road.type === 'primary' \| 'ring_primary' \| 'ring_secondary'` to decide road-width styling — none of those strings are ever produced by the backend, so major/minor road width differentiation silently never applies. Separate bug from A1-A6, but relevant to "looks unrealistic." |

---

## Part C — New constraints to implement (making Claude act like a human architect)

Goal: give Claude a **bounded, pre-validated design envelope** to make content decisions within — footprint style, unit mix, labeling, theme — while code guarantees the physical/regulatory realism Claude can't be trusted to compute reliably (it currently isn't even asked to).

**C1 — Buildable Envelope Engine** *(new function, e.g. `compute_buildable_envelope(boundary_poly, setbacks_m, site_width_m, site_height_m)`)*
Compute, in order: (a) total site area via shoelace formula on `boundary_poly` (already have `calculatePolygonArea` equivalent), (b) inset the boundary polygon inward by the user's actual `front/rear/side_setback_m` (converted to pct using `site_width_m`/`site_height_m` — this is the fix for B4), (c) subtract a reserved road-corridor allowance, (d) reserve `green_area_pct` (B3 fix) of total site area as inviolable open-space polygon(s) *before* placing anything else. What's left is the real buildable footprint budget — everything downstream works within it.

**C2 — Tower count & sizing driven by the buildable budget, not a constant**
Replace `num_towers = 8` (B1) with a count derived from: buildable footprint budget ÷ (target footprint area per tower, informed by the user's `project_specification`/`unit_specifications` selection). Bounded to a sane range (e.g. 4–16) rather than unbounded, but no longer hardcoded.

**C3 — Green-area enforcement, not just prompt text**
Reserve green/park polygon area *before* tower placement (per C1), and add a real post-generation check in `generate_report()`: compute actual `(sum of park/lawn/buffer polygon areas) / (total site area)` and compare against the user's requested `green_area_pct` within a tolerance band (e.g. ±5 pts). Currently nothing computes this at all (B3).

**C4 — Real setback enforcement using the user's meter values**
Convert `front_setback_m`/`rear_setback_m`/`side_setback_m` to pct at the point of use — both in the boundary-inset step (C1) and by replacing/augmenting the generic `SETBACKS` dict values with ones derived from the actual user input, not disconnected constants (B4).

**C5 — Road connectivity / frontage constraint**
After placing each tower, generate a short spur/driveway from the tower to the nearest point on a road (bounded max length, e.g. 15–20m — reference the NBC-style value if adopted, see Open Questions). Add a `generate_report()` check that flags any tower with no road access within that distance as a **critical** issue (fixes B5) — this is also what would have caught the "collapsed onto one point" failure in A2 far more directly than a general distance check.

**C6 — Ring/road geometry conforms to the boundary shape**
Fit the tower ring / loop road to the boundary's actual bounding-box aspect ratio and rotation (e.g. via min-area rotated bounding box or principal-axis fit) instead of a fixed-radius circle (A1 fix).

**C7 — Boulevard T-merge instead of pass-through**
Generate the entry boulevard from the entry point to the *nearest point on the loop's edge* only, not through its interior (A4 fix).

**C8 — Solver that preserves ring structure instead of collapsing it**
Replace "push toward centroid" with per-element angle-preserving correction: if a ring element lands outside the polygon, shrink its radius along its own angle from centroid until inside, rather than dragging every offending element toward the same point (A2 fix). Extend the solver's input to include roads/paths/entry points, not just towers/amenities (A3 fix).

**C9 — Real grading, no shortcuts**
Add pairwise minimum tower-center distance check, road self-intersection check, green-area tolerance check (C3), and road-connectivity check (C5) to `generate_report()`. **Remove the hardcoded `report["grade"] = "B"` override in the fallback path (A6)** — if the deterministic fallback still fails validation after these fixes, that's a real signal that should surface, not get overwritten.

**C10 — Unit-count / footprint consistency**
Derive footprint size from `floors × units × avg_unit_size` (avg unit size per BHK type — see Open Question 1) rather than a fixed constant regardless of floor count, so a 36-floor tower and an 18-floor tower are no longer identical boxes (B6 fix).

**C11 — Fix road-type taxonomy mismatch**
Align backend `road.type` values (`boulevard`, `loop`, `jogging`) with what `Canvas2D.jsx` actually styles as major/minor (`primary`, `ring_primary`, `ring_secondary`, `pedestrian`) — either rename backend output or extend the frontend's type-check list (B7 fix). Low effort, currently silently broken.

---

## Part D — Implementation plan & sequencing

| # | Task | File(s) | Fixes | Priority | Depends on |
|---|---|---|---|---|---|
| 1 | Remove hardcoded `grade = "B"` override in fallback path | `ai.py` | A6 | **Critical — do first** | none |
| 2 | Build `compute_buildable_envelope()`: real setback inset (meters→pct), road corridor reserve, green-area reserve | `planning_engine.py` (new fn) | B2, B3, B4, C1 | Critical | none |
| 3 | Fit tower ring / loop road to boundary shape (rotated bounding box or principal-axis ellipse) instead of fixed circle | `planning_engine.py` — `generate_procedural_fallback()` | A1, C6 | Critical | Task 2 |
| 4 | Boulevard T-merge to loop edge instead of interior pass-through | `planning_engine.py` — `generate_procedural_fallback()` | A4, C7 | Critical | Task 3 |
| 5 | Derive `num_towers` and footprint size from buildable budget + unit specs, instead of constants | `planning_engine.py` — `generate_procedural_fallback()` | B1, B6, C2, C10 | High | Task 2 |
| 6 | Extend `resolve_layout()`/`ConstraintSolver` to include roads/paths/entry points; replace pull-to-centroid with angle-preserving radius correction | `planning_engine.py` — `resolve_layout()`, `ConstraintSolver.solve()` | A2, A3, C8 | High | Task 3 |
| 7 | Generate per-tower road spurs; add road-connectivity check | `planning_engine.py` — `generate_procedural_fallback()`, `generate_report()` | B5, C5 | High | Tasks 3, 6 |
| 8 | Add real grading checks: pairwise tower distance, road self-intersection, green-area tolerance, road connectivity | `planning_engine.py` — `generate_report()` | A5, C3, C9 | High | Tasks 2, 7 |
| 9 | Fix road-type taxonomy mismatch between backend and `Canvas2D.jsx` | `planning_engine.py`, `Canvas2D.jsx` | B7, C11 | Medium | none (independent) |

**Suggested execution order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9.**
Task 1 is a one-line change that stops known-bad layouts from shipping *today*, independent of everything else — should land immediately regardless of when the rest starts. Tasks 2-4 remove the structural cause of the figure-8/collapse. Tasks 5-8 are what make the output "architect-realistic" rather than merely "not broken." Task 9 is cosmetic and can happen anytime in parallel.

---

## Part E — Questions for antigravity (please confirm against the latest code before implementation)

1. **Unit size reference data**: Is there an authoritative sqm-per-unit-type table (3BHK/4BHK/etc.) anywhere in the codebase already — I found `src/knowledge/jurisdictions/india/nbc.ts` in the unused TS "RE 2.0" engine with real NBC values (max FAR 2.5, max ground coverage 0.4, min front setback 6m, primary road ≥12m, secondary ≥9m) but no unit-size table. Task C10 needs one. Should we add a small constants table in Python, or is there a source of truth elsewhere (design docs, a spreadsheet, another form field) I haven't found?

2. **Should the India NBC values be bridged from the TS engine, or duplicated as Python constants for now?** The real FAR/coverage/road-width numbers in `nbc.ts` are good defaults for tasks C1/C2/C5, but that module isn't reachable from the Python backend. Fastest path is porting the specific constants we need into `planning_engine.py` directly rather than building a cross-language bridge — confirm that's acceptable for now, or if there's already a planned integration path for the TS knowledge engine we should use instead.

3. **Tower count bounds**: what's a sane min/max tower count for Task C2 (I proposed 4–16 as a placeholder)? Does this depend on project tier/scale that's collected somewhere in the form I should check (e.g. `project_specification` values like "High Rise" vs "Independent Floors" implying very different expected counts)?

4. **Green-area tolerance band**: for the C3 grading check, is ±5 percentage points around the user's `green_area_pct` reasonable, or should this be a hard minimum (never below X%) rather than a symmetric band?

5. **Road connectivity max spur length**: I proposed 15-20m as the max driveway/spur length for Task C7's connectivity check — does this match any real constraint already in the form (e.g. fire-access/emergency-vehicle requirements) that I should check for in `ProjectRequirementsForm.jsx`'s safety_tier field before hardcoding a number?

6. **Frontend tolerance for variable tower count**: does anything in `Canvas2D.jsx`, the legend renderer, or elsewhere assume exactly 8 towers (e.g. a fixed A-H lettering scheme, fixed layout grid for the legend UI)? Task C2 makes tower count variable — want to confirm nothing else breaks before that lands.

7. **Regenerate-once-per-request cost**: Tasks 3-8 make `generate_procedural_fallback()` meaningfully more expensive per call (polygon fitting, spur generation, more validation passes). Is there a required response-time budget for `/api/ai/suggest` I should design against?
