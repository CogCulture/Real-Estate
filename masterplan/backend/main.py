from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from routers import projects, layouts, renders, ai
from database import init_db

app = FastAPI(title="MasterPlan API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure outputs folder exists
outputs_dir = os.path.join(os.path.dirname(__file__), "outputs")
os.makedirs(outputs_dir, exist_ok=True)

app.mount("/outputs", StaticFiles(directory=outputs_dir), name="outputs")

@app.on_event("startup")
async def startup():
    await init_db()

app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(layouts.router, prefix="/api/layouts", tags=["layouts"])
app.include_router(renders.router, prefix="/api/renders", tags=["renders"])
app.include_router(ai.router, prefix="/api/ai", tags=["ai"])

if __name__ == "__main__":
    import uvicorn
    import subprocess
    import sys
    import os

    # Resolve absolute path to the backend directory
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, backend_dir)

    print("Starting background Celery worker process...")
    # Spawn Celery worker using the same Python interpreter
    celery_cmd = [
        sys.executable, "-m", "celery",
        "-A", "tasks.celery_app",
        "worker",
        "--loglevel=info",
        "--pool=solo"
    ]
    celery_proc = subprocess.Popen(celery_cmd, cwd=backend_dir)

    try:
        print("Starting FastAPI Uvicorn web server on http://localhost:8000...")
        uvicorn.run("main:app", host="127.0.0.1", port=8000)
    finally:
        print("Terminating Celery worker process...")
        celery_proc.terminate()
        try:
            celery_proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            celery_proc.kill()
        print("Shutdown complete.")
