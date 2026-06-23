from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from typing import List
import uuid
import os
import aiosqlite
from database import get_db
from models import RenderJobCreate, RenderJobResponse
from tasks.render_task import run_blender_render

router = APIRouter()

@router.post("", response_model=RenderJobResponse, status_code=status.HTTP_201_CREATED)
async def create_render_job(job: RenderJobCreate, db: aiosqlite.Connection = Depends(get_db)):
    # Verify project exists
    async with db.execute("SELECT 1 FROM projects WHERE id = ?", (job.project_id,)) as cursor:
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="Project not found")

    # Verify layout exists
    layout_json = None
    async with db.execute("SELECT layout_json FROM layouts WHERE id = ?", (job.layout_id,)) as cursor:
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Layout not found")
        layout_json = row[0]

    job_id = str(uuid.uuid4())
    
    # Create output directories if they don't exist
    outputs_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "outputs")
    os.makedirs(outputs_dir, exist_ok=True)

    query = """
    INSERT INTO render_jobs (id, project_id, layout_id, status, render_type, quality, camera_preset, progress)
    VALUES (?, ?, ?, 'queued', ?, ?, ?, 0)
    """
    await db.execute(query, (
        job_id, job.project_id, job.layout_id, job.render_type, job.quality, job.camera_preset
    ))
    await db.commit()

    # Trigger async Celery task
    run_blender_render.delay(
        job_id,
        layout_json,
        {
            "quality": job.quality,
            "camera_preset": job.camera_preset,
            "render_type": job.render_type
        }
    )

    async with db.execute("SELECT * FROM render_jobs WHERE id = ?", (job_id,)) as cursor:
        row = await cursor.fetchone()
        return dict(row)

@router.get("/{job_id}", response_model=RenderJobResponse)
async def get_render_job(job_id: str, db: aiosqlite.Connection = Depends(get_db)):
    async with db.execute("SELECT * FROM render_jobs WHERE id = ?", (job_id,)) as cursor:
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Render job not found")
        return dict(row)

@router.get("/{job_id}/download")
async def download_render(job_id: str, db: aiosqlite.Connection = Depends(get_db)):
    async with db.execute("SELECT output_path, status FROM render_jobs WHERE id = ?", (job_id,)) as cursor:
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Render job not found")
        
        path, status_val = row
        if status_val != "done":
            raise HTTPException(status_code=400, detail=f"Render is not ready. Current status: {status_val}")
        
        # Resolve absolute path
        abs_path = os.path.abspath(path)
        if not os.path.exists(abs_path):
            # Try resolving relative to backend directory
            backend_dir = os.path.dirname(os.path.dirname(__file__))
            fallback_path = os.path.join(backend_dir, path)
            if os.path.exists(fallback_path):
                abs_path = fallback_path
            else:
                raise HTTPException(status_code=404, detail="Render file not found on disk")

        return FileResponse(abs_path, media_type="image/png", filename=os.path.basename(abs_path))

@router.get("/project/{id}", response_model=List[RenderJobResponse])
async def list_project_renders(id: str, db: aiosqlite.Connection = Depends(get_db)):
    async with db.execute("SELECT * FROM render_jobs WHERE project_id = ? ORDER BY created_at DESC", (id,)) as cursor:
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]
