from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
import uuid
import json
import aiosqlite
from database import get_db
from models import LayoutCreate, LayoutResponse

router = APIRouter()

@router.post("", response_model=LayoutResponse, status_code=status.HTTP_201_CREATED)
async def save_layout(layout: LayoutCreate, db: aiosqlite.Connection = Depends(get_db)):
    # Verify project exists
    async with db.execute("SELECT 1 FROM projects WHERE id = ?", (layout.project_id,)) as cursor:
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="Project not found")

    # Get the latest version number for this project
    version = 1
    async with db.execute("SELECT MAX(version) FROM layouts WHERE project_id = ?", (layout.project_id,)) as cursor:
        val = await cursor.fetchone()
        if val and val[0] is not None:
            version = val[0] + 1

    layout_id = str(uuid.uuid4())
    query = """
    INSERT INTO layouts (id, project_id, version, layout_json, canvas_width, canvas_height, scale_factor)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """
    await db.execute(query, (
        layout_id, layout.project_id, version, layout.layout_json,
        layout.canvas_width, layout.canvas_height, layout.scale_factor
    ))
    await db.commit()

    async with db.execute("SELECT * FROM layouts WHERE id = ?", (layout_id,)) as cursor:
        row = await cursor.fetchone()
        return dict(row)

@router.get("/{project_id}", response_model=Optional[LayoutResponse])
async def get_latest_layout(project_id: str, db: aiosqlite.Connection = Depends(get_db)):
    async with db.execute(
        "SELECT * FROM layouts WHERE project_id = ? ORDER BY version DESC LIMIT 1",
        (project_id,)
    ) as cursor:
        row = await cursor.fetchone()
        if not row:
            return None
        return dict(row)

@router.get("/{project_id}/all", response_model=List[LayoutResponse])
async def get_all_layouts(project_id: str, db: aiosqlite.Connection = Depends(get_db)):
    async with db.execute(
        "SELECT * FROM layouts WHERE project_id = ? ORDER BY version DESC",
        (project_id,)
    ) as cursor:
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]

@router.put("/{layout_id}", response_model=LayoutResponse)
async def update_layout(layout_id: str, layout: LayoutCreate, db: aiosqlite.Connection = Depends(get_db)):
    async with db.execute("SELECT version FROM layouts WHERE id = ?", (layout_id,)) as cursor:
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Layout not found")
        current_version = row[0]

    query = """
    UPDATE layouts
    SET layout_json = ?, canvas_width = ?, canvas_height = ?, scale_factor = ?, updated_at = datetime('now')
    WHERE id = ?
    """
    await db.execute(query, (
        layout.layout_json, layout.canvas_width, layout.canvas_height, layout.scale_factor, layout_id
    ))
    await db.commit()

    async with db.execute("SELECT * FROM layouts WHERE id = ?", (layout_id,)) as cursor:
        row = await cursor.fetchone()
        return dict(row)
