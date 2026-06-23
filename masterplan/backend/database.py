import aiosqlite
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "masterplan.db")

async def get_db():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        yield db

async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        # Create Tables
        await db.execute("""
        CREATE TABLE IF NOT EXISTS projects (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            description TEXT,
            location_name TEXT,
            lat         REAL,
            lng         REAL,
            site_width  REAL,
            site_height REAL,
            site_area   REAL,
            boundary_geojson TEXT,
            created_at  TEXT DEFAULT (datetime('now')),
            updated_at  TEXT DEFAULT (datetime('now'))
        );
        """)

        await db.execute("""
        CREATE TABLE IF NOT EXISTS layouts (
            id          TEXT PRIMARY KEY,
            project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            version     INTEGER DEFAULT 1,
            layout_json TEXT NOT NULL,
            canvas_width  REAL,
            canvas_height REAL,
            scale_factor  REAL,
            created_at  TEXT DEFAULT (datetime('now')),
            updated_at  TEXT DEFAULT (datetime('now'))
        );
        """)

        await db.execute("""
        CREATE TABLE IF NOT EXISTS render_jobs (
            id          TEXT PRIMARY KEY,
            project_id  TEXT NOT NULL REFERENCES projects(id),
            layout_id   TEXT NOT NULL REFERENCES layouts(id),
            status      TEXT DEFAULT 'queued',
            render_type TEXT DEFAULT 'still',
            quality     TEXT DEFAULT 'high',
            camera_preset TEXT DEFAULT 'aerial',
            output_path TEXT,
            output_url  TEXT,
            error_msg   TEXT,
            progress    INTEGER DEFAULT 0,
            started_at  TEXT,
            completed_at TEXT,
            created_at  TEXT DEFAULT (datetime('now'))
        );
        """)
        await db.execute("""
        CREATE TABLE IF NOT EXISTS api_usage (
            id          TEXT PRIMARY KEY,
            project_id  TEXT NOT NULL REFERENCES projects(id),
            model       TEXT NOT NULL,
            prompt_tokens INTEGER,
            completion_tokens INTEGER,
            cost        REAL,
            created_at  TEXT DEFAULT (datetime('now'))
        );
        """)
        await db.commit()
# Helper for direct non-request database updates (like Celery background updates)
def update_render_status(job_id: str, status: str = None, progress: int = None, error_msg: str = None, output_path: str = None, output_url: str = None):
    import sqlite3
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    updates = []
    params = []
    if status is not None:
        updates.append("status = ?")
        params.append(status)
        if status == "processing":
            updates.append("started_at = datetime('now')")
        elif status in ["done", "failed"]:
            updates.append("completed_at = datetime('now')")
            
    if progress is not None:
        updates.append("progress = ?")
        params.append(progress)
    if error_msg is not None:
        updates.append("error_msg = ?")
        params.append(error_msg)
    if output_path is not None:
        updates.append("output_path = ?")
        params.append(output_path)
    if output_url is not None:
        updates.append("output_url = ?")
        params.append(output_url)
        
    if updates:
        params.append(job_id)
        cursor.execute(f"UPDATE render_jobs SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()
    conn.close()
