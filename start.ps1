# ============================================================
# start.ps1  —  Start the full RE 2.0 stack
#   1. Redis      (Docker)          → localhost:6379
#   2. FastAPI    (Uvicorn)         → localhost:8000
#   3. Frontend   (Vite)            → localhost:5173
# ============================================================

$ROOT      = $PSScriptRoot
$BACKEND   = "$ROOT\masterplan\backend"
$FRONTEND  = "$ROOT\masterplan\frontend"
$VENV      = "$BACKEND\venv\Scripts\activate.ps1"

# ── 1. Redis via Docker ──────────────────────────────────────
Write-Host "`n[1/3] Starting Redis container..." -ForegroundColor Cyan
docker run -d --name masterplan-redis -p 6379:6379 --restart always redis:alpine 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "      Redis container already running or starting existing one..." -ForegroundColor Yellow
    docker start masterplan-redis 2>$null
}
Write-Host "      Redis → localhost:6379" -ForegroundColor Green

# ── 2. Python Backend (FastAPI + Celery) ─────────────────────
Write-Host "`n[2/3] Starting Python backend (FastAPI + Celery)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", `
    "cd '$BACKEND'; & '$VENV'; python main.py" `
    -WindowStyle Normal
Write-Host "      Backend → http://localhost:8001" -ForegroundColor Green
Write-Host "      API Docs → http://localhost:8001/docs" -ForegroundColor Green

# ── 3. Frontend (Vite) ───────────────────────────────────────
Write-Host "`n[3/3] Starting Frontend (Vite)..." -ForegroundColor Cyan
# Clear stale Vite cache to prevent module export errors
Remove-Item -Recurse -Force "$FRONTEND\node_modules\.vite" -ErrorAction SilentlyContinue
Start-Process powershell -ArgumentList "-NoExit", "-Command", `
    "cd '$FRONTEND'; npm run dev -- --force" `
    -WindowStyle Normal
Write-Host "      Frontend → http://localhost:5173" -ForegroundColor Green

Write-Host "`n✅ All services started. Press any key to exit this launcher." -ForegroundColor Green
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
