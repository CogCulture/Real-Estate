from pydantic import BaseModel
from typing import Optional, List, Dict
import uuid

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    location_name: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    site_width: float
    site_height: float
    site_area: float
    boundary_geojson: Optional[str] = None
    features: Optional[str] = None

class ProjectResponse(ProjectCreate):
    id: str
    created_at: str
    updated_at: str

class LayoutCreate(BaseModel):
    project_id: str
    layout_json: str
    canvas_width: float
    canvas_height: float
    scale_factor: float

class LayoutResponse(LayoutCreate):
    id: str
    version: int
    created_at: str

class RenderJobCreate(BaseModel):
    project_id: str
    layout_id: str
    render_type: str = "still"           # still | walkthrough
    quality: str = "high"                # preview | high | ultra
    camera_preset: str = "aerial"        # aerial | street | isometric | cinematic

class RenderJobResponse(RenderJobCreate):
    id: str
    status: str
    progress: int
    output_url: Optional[str] = None
    error_msg: Optional[str] = None
    created_at: str

class AiSuggestRequest(BaseModel):
    project_id: str
    site_width_m: float
    site_height_m: float
    features: Optional[Dict] = None

class ApiUsageResponse(BaseModel):
    id: str
    project_id: str
    model: str
    prompt_tokens: int
    completion_tokens: int
    cost: float
    created_at: str
