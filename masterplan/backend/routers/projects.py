from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
import uuid
import aiosqlite
from database import get_db
from models import ProjectCreate, ProjectResponse

router = APIRouter()

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
