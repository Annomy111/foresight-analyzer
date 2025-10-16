"""FastAPI backend for Foresight Analyzer web interface - v3.0.0 with Database"""
from fastapi import FastAPI, BackgroundTasks, HTTPException, WebSocket, WebSocketDisconnect, Query
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

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

from core.ensemble_manager import EnsembleManager
from core.models import ForecastResult
from analysis.aggregator import ForecastAggregator
from export.excel_exporter import ExcelExporter
from database.manager import DatabaseManager
from utils.eta_calculator import ModelETATracker

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="AI Foresight Analyzer API",
    description="REST API for probabilistic forecasting with LLM ensembles",
    version="3.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Database Manager
db = DatabaseManager()

# Active WebSocket connections
active_connections: Dict[str, WebSocket] = {}

# ETA Trackers for active jobs
eta_trackers: Dict[str, ModelETATracker] = {}


# Request/Response Models
class ForecastRequest(BaseModel):
    question: str
    definition: str
    timeframe: Optional[str] = None
    context: Optional[str] = None
    models: Optional[List[str]] = None
    iterations: int = 10
    enhanced_prompts: bool = False


class UkraineForecastRequest(BaseModel):
    by_date: Optional[str] = None
    iterations: int = 10
    enhanced_prompts: bool = False


class JobStatus(BaseModel):
    job_id: str
    status: str
    progress: float
    message: str
    result: Optional[Dict[str, Any]] = None
    created_at: str
    updated_at: str
    eta_seconds: Optional[int] = None
    speed_str: Optional[str] = None
    model_progress: Optional[Dict[str, Any]] = None


# Helper function to update job status
async def update_job_status(
    job_id: str,
    status: str,
    progress: float,
    message: str,
    result: Optional[Dict[str, Any]] = None,
    started_at: Optional[datetime] = None,
    completed_at: Optional[datetime] = None,
    model_progress: Optional[Dict[str, Any]] = None
):
    """Update job status in database and notify WebSocket clients"""
    # Update database
    db.update_job_status(
        job_id=job_id,
        status=status,
        progress=progress,
        message=message,
        started_at=started_at,
        completed_at=completed_at
    )

    # Get ETA statistics if available
    eta_data = {}
    if job_id in eta_trackers:
        tracker = eta_trackers[job_id]
        global_stats = tracker.get_global_stats()
        eta_data = {
            'eta_seconds': global_stats.get('eta_seconds'),
            'speed_str': global_stats.get('speed_str'),
            'model_progress': model_progress or {}
        }

    # Prepare WebSocket message
    job = db.get_job(job_id)
    if job:
        ws_data = {
            **job.to_dict(include_result=False),
            **eta_data
        }

        # Notify WebSocket clients
        if job_id in active_connections:
            try:
                await active_connections[job_id].send_json({
                    "type": "status_update",
                    "data": ws_data
                })
            except Exception as e:
                logger.error(f"Error sending WebSocket update: {e}")


# Progress callback for ensemble manager
async def create_progress_callback(job_id: str):
    """Create a progress callback function for ensemble manager"""
    async def callback(progress_data: Dict[str, Any]):
        """Handle progress updates from ensemble manager"""
        # Update ETA tracker
        if job_id in eta_trackers:
            tracker = eta_trackers[job_id]
            if 'model_name' in progress_data and progress_data.get('query_completed'):
                tracker.update_model(progress_data['model_name'], 1)

        # Update job status
        await update_job_status(
            job_id=job_id,
            status='running',
            progress=progress_data.get('progress', 0.0),
            message=progress_data.get('message', ''),
            model_progress=progress_data.get('model_progress', {})
        )

    return callback


# Background task for running forecast
async def run_forecast_task(
    job_id: str,
    question: str,
    definition: str,
    forecast_type: str,
    timeframe: Optional[str],
    context: Optional[str],
    models: Optional[List[str]],
    iterations: int,
    enhanced_prompts: bool
):
    """Background task to run the forecast"""
    try:
        start_time = datetime.utcnow()
        await update_job_status(
            job_id, "running", 0.05, "Initializing ensemble manager...",
            started_at=start_time
        )

        # Initialize ETA tracker
        from config.settings import get_settings
        settings = get_settings()
        model_list = models or settings.models.enabled_models
        tracker = ModelETATracker()
        tracker.start_job(model_list, iterations)
        eta_trackers[job_id] = tracker

        # Initialize analyzer
        ensemble_manager = EnsembleManager(
            api_key=None,  # Uses .env
            use_cache=True,
            dry_run=False,
            enhanced_prompts=enhanced_prompts
        )
        aggregator = ForecastAggregator()
        exporter = ExcelExporter()

        await update_job_status(job_id, "running", 0.1, "Starting forecast queries...")

        # Create progress callback
        async def progress_callback(progress: float, message: str):
            await update_job_status(job_id, "running", progress, message)

        # Run forecast with progress tracking
        forecast_data = await ensemble_manager.run_ensemble_forecast(
            question=question,
            definition=definition,
            models=model_list,
            iterations=iterations,
            timeframe=timeframe,
            context=context,
            progress_callback=progress_callback
        )

        summary = forecast_data.get('summary', {})
        successful_queries = summary.get('successful_queries', 0)
        if successful_queries == 0:
            raise RuntimeError("No successful model responses")

        await update_job_status(job_id, "running", 0.85, "Processing results...")

        # Save model responses to database
        for response_data in forecast_data['responses']:
            db.save_model_response(
                job_id=job_id,
                model_name=response_data.model_name,
                iteration_number=response_data.iteration,
                probability=response_data.probability,
                reasoning=response_data.reasoning,
                base_rate=getattr(response_data, 'base_rate', None),
                case_rate=getattr(response_data, 'case_rate', None),
                confidence=getattr(response_data, 'confidence', None),
                response_time_ms=response_data.response_time_ms,
                tokens_used=getattr(response_data, 'tokens_used', None),
                success=True,
                error_message=None
            )

        # Aggregate results
        responses = [r for r in forecast_data['responses']]
        statistics = aggregator.aggregate_results(responses)

        await update_job_status(job_id, "running", 0.95, "Saving results...")

        # Save result to database
        ensemble_prob = getattr(statistics, 'mean', 0.0)
        db.save_result(
            job_id=job_id,
            ensemble_probability=ensemble_prob,
            total_queries=forecast_data['metadata'].get('total_queries', 0),
            successful_queries=successful_queries,
            failed_queries=forecast_data['metadata'].get('total_queries', 0) - successful_queries,
            statistics={
                "mean": getattr(statistics, 'mean', None),
                "median": getattr(statistics, 'median', None),
                "std": getattr(statistics, 'std', None),
                "min": getattr(statistics, 'min', None),
                "max": getattr(statistics, 'max', None)
            },
            models_used=forecast_data['metadata'].get('models_used', [])
        )

        # Prepare result for response
        result = {
            "ensemble_probability": ensemble_prob,
            "total_queries": forecast_data['metadata'].get('total_queries', 0),
            "successful_queries": successful_queries,
            "models_used": forecast_data['metadata'].get('models_used', []),
            "duration": forecast_data['metadata'].get('duration_seconds', 0),
            "statistics": {
                "mean": getattr(statistics, 'mean', None),
                "median": getattr(statistics, 'median', None),
                "std": getattr(statistics, 'std', None),
                "min": getattr(statistics, 'min', None),
                "max": getattr(statistics, 'max', None)
            }
        }

        completed_time = datetime.utcnow()
        await update_job_status(
            job_id, "completed", 1.0, "Forecast completed successfully",
            result=result, completed_at=completed_time
        )

    except Exception as e:
        logger.error(f"Error in forecast task: {e}", exc_info=True)
        await update_job_status(job_id, "failed", 0.0, f"Error: {str(e)}")
    finally:
        # Cleanup ETA tracker
        if job_id in eta_trackers:
            del eta_trackers[job_id]


# ========== API ENDPOINTS ==========

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "AI Foresight Analyzer API",
        "version": "3.0.0",
        "status": "operational",
        "database": "connected"
    }


@app.get("/health")
async def health():
    """Health check endpoint for Docker and monitoring"""
    try:
        # Check database connection
        db_status = "healthy"
        try:
            # Simple database check - just list jobs without errors
            db.list_jobs(limit=1)
        except Exception as e:
            db_status = f"unhealthy: {str(e)}"
            logger.error(f"Database health check failed: {e}")

        return {
            "status": "healthy" if db_status == "healthy" else "unhealthy",
            "service": "foresight-analyzer-api",
            "version": "3.0.0",
            "database": db_status,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail=f"Service unhealthy: {str(e)}")


@app.post("/api/forecast/custom", response_model=JobStatus)
async def create_custom_forecast(request: ForecastRequest, background_tasks: BackgroundTasks):
    """Create a new custom forecast job"""
    job_id = str(uuid.uuid4())

    # Create job in database
    db.create_job(
        job_id=job_id,
        question=request.question,
        definition=request.definition,
        forecast_type="custom",
        iterations=request.iterations,
        timeframe=request.timeframe,
        context=request.context,
        enhanced_prompts=request.enhanced_prompts,
        models_requested=request.models
    )

    # Add background task
    background_tasks.add_task(
        run_forecast_task,
        job_id,
        request.question,
        request.definition,
        "custom",
        request.timeframe,
        request.context,
        request.models,
        request.iterations,
        request.enhanced_prompts
    )

    job = db.get_job(job_id)
    return JobStatus(**job.to_dict(include_result=False))


@app.post("/api/forecast/ukraine", response_model=JobStatus)
async def create_ukraine_forecast(request: UkraineForecastRequest, background_tasks: BackgroundTasks):
    """Create Ukraine ceasefire 2026 forecast"""
    job_id = str(uuid.uuid4())

    question = "Mit welcher Wahrscheinlichkeit kommt es im Jahr 2026 zu einem Waffenstillstand in der Ukraine?"
    definition = "Ein Waffenstillstand wird definiert als eine offizielle Vereinbarung zwischen Russland und der Ukraine..."

    # Create job in database
    db.create_job(
        job_id=job_id,
        question=question,
        definition=definition,
        forecast_type="ukraine",
        iterations=request.iterations,
        timeframe=request.by_date,
        enhanced_prompts=request.enhanced_prompts
    )

    background_tasks.add_task(
        run_forecast_task,
        job_id,
        question,
        definition,
        "ukraine",
        request.by_date,
        None,
        None,
        request.iterations,
        request.enhanced_prompts
    )

    job = db.get_job(job_id)
    return JobStatus(**job.to_dict(include_result=False))


@app.get("/api/jobs/{job_id}", response_model=JobStatus)
async def get_job_status(job_id: str):
    """Get status of a forecast job"""
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    response_data = job.to_dict(include_result=False)

    # Add ETA data if job is running
    if job.status == 'running' and job_id in eta_trackers:
        tracker = eta_trackers[job_id]
        global_stats = tracker.get_global_stats()
        response_data.update({
            'eta_seconds': global_stats.get('eta_seconds'),
            'speed_str': global_stats.get('speed_str')
        })

    return JobStatus(**response_data)


@app.get("/api/history")
async def list_jobs(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: str = Query('created_at'),
    sort_desc: bool = Query(True)
):
    """List forecast jobs with filtering and pagination"""
    result = db.list_jobs(
        limit=limit,
        offset=offset,
        status=status,
        search=search,
        sort_by=sort_by,
        sort_desc=sort_desc
    )
    return result


@app.get("/api/history/{job_id}")
async def get_job_details(job_id: str):
    """Get complete job details including all model responses"""
    details = db.get_job_with_details(job_id)
    if not details:
        raise HTTPException(status_code=404, detail="Job not found")
    return details


@app.delete("/api/history/{job_id}")
async def delete_job(job_id: str):
    """Delete a forecast job"""
    success = db.delete_job(job_id)
    if not success:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"message": "Job deleted successfully"}


@app.get("/api/statistics")
async def get_statistics():
    """Get overall statistics"""
    stats = db.get_statistics()
    return stats


@app.websocket("/ws/{job_id}")
async def websocket_endpoint(websocket: WebSocket, job_id: str):
    """WebSocket endpoint for real-time job updates"""
    await websocket.accept()
    active_connections[job_id] = websocket

    try:
        # Send current status
        job = db.get_job(job_id)
        if job:
            await websocket.send_json({
                "type": "status_update",
                "data": job.to_dict(include_result=False)
            })

        # Keep connection alive
        while True:
            data = await websocket.receive_text()
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
