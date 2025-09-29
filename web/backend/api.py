"""FastAPI backend for Foresight Analyzer web interface"""
from fastapi import FastAPI, BackgroundTasks, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import asyncio
import json
import logging
from datetime import datetime
from pathlib import Path
import sys
import uuid

# Add current directory to path (works for Railway deployment)
sys.path.insert(0, str(Path(__file__).parent))

from core.ensemble_manager import EnsembleManager
from core.models import ForecastResult
from analysis.aggregator import ForecastAggregator
from export.excel_exporter import ExcelExporter

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="AI Foresight Analyzer API",
    description="REST API for probabilistic forecasting with LLM ensembles",
    version="2.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this properly in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory job storage (replace with database/KV in production)
jobs: Dict[str, Dict[str, Any]] = {}
active_connections: Dict[str, WebSocket] = {}


# Request/Response Models
class ForecastRequest(BaseModel):
    question: str
    definition: str
    timeframe: Optional[str] = None
    context: Optional[str] = None
    models: Optional[List[str]] = None
    iterations: int = 10
    api_key: Optional[str] = None
    enhanced_prompts: bool = False


class UkraineForecastRequest(BaseModel):
    by_date: Optional[str] = None
    api_key: Optional[str] = None
    iterations: int = 10
    enhanced_prompts: bool = False


class JobStatus(BaseModel):
    job_id: str
    status: str  # 'pending', 'running', 'completed', 'failed'
    progress: float
    message: str
    result: Optional[Dict[str, Any]] = None
    created_at: str
    updated_at: str


# Helper function to update job status
async def update_job_status(
    job_id: str,
    status: str,
    progress: float,
    message: str,
    result: Optional[Dict[str, Any]] = None
):
    """Update job status and notify connected websocket clients"""
    if job_id not in jobs:
        return
    
    jobs[job_id].update({
        "status": status,
        "progress": progress,
        "message": message,
        "result": result,
        "updated_at": datetime.now().isoformat()
    })
    
    # Notify WebSocket clients
    if job_id in active_connections:
        try:
            await active_connections[job_id].send_json({
                "type": "status_update",
                "data": jobs[job_id]
            })
        except Exception as e:
            logger.error(f"Error sending WebSocket update: {e}")


# Background task for running forecast
async def run_forecast_task(
    job_id: str,
    question: str,
    definition: str,
    timeframe: Optional[str],
    context: Optional[str],
    models: Optional[List[str]],
    iterations: int,
    api_key: Optional[str],
    enhanced_prompts: bool
):
    """Background task to run the forecast"""
    try:
        await update_job_status(job_id, "running", 0.1, "Initializing ensemble manager...")
        
        # Initialize analyzer
        ensemble_manager = EnsembleManager(
            api_key=api_key,
            use_cache=True,
            dry_run=False,
            enhanced_prompts=enhanced_prompts
        )
        aggregator = ForecastAggregator()
        exporter = ExcelExporter()
        
        await update_job_status(job_id, "running", 0.2, "Starting forecast queries...")
        
        # Run forecast
        forecast_data = await ensemble_manager.run_ensemble_forecast(
            question=question,
            definition=definition,
            models=models,
            iterations=iterations,
            timeframe=timeframe,
            context=context
        )
        
        await update_job_status(job_id, "running", 0.8, "Processing results...")
        
        # Create result object
        responses = [response_data for response_data in forecast_data['responses']]
        statistics = aggregator.aggregate_results(responses)
        
        await update_job_status(job_id, "running", 0.9, "Generating Excel report...")
        
        # Export to Excel
        # excel_path = exporter.export_forecast(forecast_result)
        
        # Calculate ensemble probability
        ensemble_prob = statistics.mean if statistics else 0.0
        
        result = {
            "ensemble_probability": ensemble_prob,
            "total_queries": forecast_data['metadata'].get('total_queries', 0),
            "successful_queries": forecast_data['metadata'].get('successful_responses', 0),
            "models_used": forecast_data['metadata'].get('models_used', []),
            "duration": forecast_data['metadata'].get('duration_seconds', 0),
            "statistics": {
                "mean": statistics.mean,
                "median": statistics.median,
                "std": statistics.std,
                "min": statistics.min,
                "max": statistics.max
            } if statistics else None
        }
        
        await update_job_status(job_id, "completed", 1.0, "Forecast completed successfully", result)
        
    except Exception as e:
        logger.error(f"Error in forecast task: {e}", exc_info=True)
        await update_job_status(job_id, "failed", 0.0, f"Error: {str(e)}")


# API Endpoints
@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "AI Foresight Analyzer API",
        "version": "2.0.0",
        "status": "operational"
    }


@app.post("/api/forecast/custom", response_model=JobStatus)
async def create_custom_forecast(request: ForecastRequest, background_tasks: BackgroundTasks):
    """Create a new custom forecast job"""
    job_id = str(uuid.uuid4())
    
    # Create job
    jobs[job_id] = {
        "job_id": job_id,
        "status": "pending",
        "progress": 0.0,
        "message": "Job created, waiting to start...",
        "result": None,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "request": request.dict()
    }
    
    # Add background task
    background_tasks.add_task(
        run_forecast_task,
        job_id,
        request.question,
        request.definition,
        request.timeframe,
        request.context,
        request.models,
        request.iterations,
        request.api_key,
        request.enhanced_prompts
    )
    
    return JobStatus(**jobs[job_id])


@app.post("/api/forecast/ukraine", response_model=JobStatus)
async def create_ukraine_forecast(request: UkraineForecastRequest, background_tasks: BackgroundTasks):
    """Create Ukraine ceasefire 2026 forecast"""
    job_id = str(uuid.uuid4())
    
    question = "Mit welcher Wahrscheinlichkeit kommt es im Jahr 2026 zu einem Waffenstillstand in der Ukraine?"
    definition = "Ein Waffenstillstand wird definiert als..."  # Add full definition
    
    jobs[job_id] = {
        "job_id": job_id,
        "status": "pending",
        "progress": 0.0,
        "message": "Ukraine forecast job created...",
        "result": None,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "request": request.dict()
    }
    
    background_tasks.add_task(
        run_forecast_task,
        job_id,
        question,
        definition,
        None,
        None,
        None,
        request.iterations,
        request.api_key,
        request.enhanced_prompts
    )
    
    return JobStatus(**jobs[job_id])


@app.get("/api/jobs/{job_id}", response_model=JobStatus)
async def get_job_status(job_id: str):
    """Get status of a forecast job"""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobStatus(**jobs[job_id])


@app.get("/api/jobs")
async def list_jobs():
    """List all forecast jobs"""
    return {
        "jobs": list(jobs.values()),
        "total": len(jobs)
    }


@app.websocket("/ws/{job_id}")
async def websocket_endpoint(websocket: WebSocket, job_id: str):
    """WebSocket endpoint for real-time job updates"""
    await websocket.accept()
    active_connections[job_id] = websocket
    
    try:
        # Send current status
        if job_id in jobs:
            await websocket.send_json({
                "type": "status_update",
                "data": jobs[job_id]
            })
        
        # Keep connection alive
        while True:
            data = await websocket.receive_text()
            # Handle ping/pong or other messages
            if data == "ping":
                await websocket.send_text("pong")
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for job {job_id}")
    finally:
        if job_id in active_connections:
            del active_connections[job_id]


@app.get("/api/models")
async def list_available_models():
    """List available models"""
    return {
        "free_models": [
            "x-ai/grok-4-fast:free",
            "deepseek/deepseek-chat-v3.1:free",
            "meta-llama/llama-3.3-70b-instruct:free",
            "qwen/qwen-2.5-72b-instruct:free",
            "mistralai/mistral-nemo:free"
        ],
        "premium_models": [
            "google/gemini-2.5-pro-preview",
            "openai/gpt-5-chat",
            "anthropic/claude-opus-4.1",
            "x-ai/grok-4",
            "deepseek/deepseek-chat-v3.1"
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
