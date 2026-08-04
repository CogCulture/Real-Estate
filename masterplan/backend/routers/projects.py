from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
import uuid
import aiosqlite
from database import get_db
from models import ProjectCreate, ProjectResponse
import urllib.request
import urllib.parse
import json
import ssl

router = APIRouter()

@router.get("/geosearch")
def geosearch(q: str):
    if not q.strip():
        return []
    try:
        # Photon (by Komoot) — powered by OSM, great POI/brand name fuzzy autocomplete
        url = (
            f"https://photon.komoot.io/api/"
            f"?q={urllib.parse.quote(q)}&limit=8&lang=en"
        )
        req = urllib.request.Request(
            url,
            headers={
                'User-Agent': 'MasterPlanTownshipApp/2.0 (architect@masterplan.com)',
                'Accept': 'application/json'
            }
        )
        ctx = ssl._create_unverified_context()
        with urllib.request.urlopen(req, context=ctx, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))

        # Normalise Photon GeoJSON → same shape frontend expects from Nominatim
        results = []
        for feature in data.get('features', []):
            props = feature.get('properties', {})
            coords = feature.get('geometry', {}).get('coordinates', [None, None])
            lon, lat = coords[0], coords[1]
            if lat is None or lon is None:
                continue

            # Build a human-readable display name
            parts = [
                props.get('name', ''),
                props.get('street', ''),
                props.get('city', '') or props.get('town', '') or props.get('village', ''),
                props.get('state', ''),
                props.get('country', ''),
            ]
            display_name = ', '.join(p for p in parts if p)

            results.append({
                'place_id': f"{lat},{lon}",
                'lat': str(lat),
                'lon': str(lon),
                'display_name': display_name,
                'type': props.get('osm_value', ''),
            })

        return results

    except Exception as e:
        print("Geosearch Photon proxy error:", e)
        raise HTTPException(status_code=500, detail=f"Failed to fetch geocoding search results: {str(e)}")

@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(project: ProjectCreate, db: aiosqlite.Connection = Depends(get_db)):
    project_id = str(uuid.uuid4())
    query = """
    INSERT INTO projects (id, name, description, location_name, lat, lng, site_width, site_height, site_area, boundary_geojson, features)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    await db.execute(query, (
        project_id, project.name, project.description, project.location_name,
        project.lat, project.lng, project.site_width, project.site_height,
        project.site_area, project.boundary_geojson, project.features
    ))
    await db.commit()
    
    # Retrieve and return the created project
    async with db.execute("SELECT * FROM projects WHERE id = ?", (project_id,)) as cursor:
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=500, detail="Failed to create project")
        return dict(row)

@router.get("", response_model=List[ProjectResponse])
async def list_projects(db: aiosqlite.Connection = Depends(get_db)):
    async with db.execute("SELECT * FROM projects ORDER BY created_at DESC") as cursor:
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]

@router.get("/{id}", response_model=ProjectResponse)
async def get_project(id: str, db: aiosqlite.Connection = Depends(get_db)):
    async with db.execute("SELECT * FROM projects WHERE id = ?", (id,)) as cursor:
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Project not found")
        return dict(row)

@router.put("/{id}", response_model=ProjectResponse)
async def update_project(id: str, project: ProjectCreate, db: aiosqlite.Connection = Depends(get_db)):
    # Check if exists
    async with db.execute("SELECT 1 FROM projects WHERE id = ?", (id,)) as cursor:
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="Project not found")
            
    query = """
    UPDATE projects 
    SET name = ?, description = ?, location_name = ?, lat = ?, lng = ?, 
        site_width = ?, site_height = ?, site_area = ?, boundary_geojson = ?, 
        features = ?, updated_at = datetime('now')
    WHERE id = ?
    """
    await db.execute(query, (
        project.name, project.description, project.location_name,
        project.lat, project.lng, project.site_width, project.site_height,
        project.site_area, project.boundary_geojson, project.features, id
    ))
    await db.commit()
    
    async with db.execute("SELECT * FROM projects WHERE id = ?", (id,)) as cursor:
        row = await cursor.fetchone()
        return dict(row)

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(id: str, db: aiosqlite.Connection = Depends(get_db)):
    async with db.execute("SELECT 1 FROM projects WHERE id = ?", (id,)) as cursor:
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="Project not found")
            
    await db.execute("DELETE FROM projects WHERE id = ?", (id,))
    await db.commit()
    return None
