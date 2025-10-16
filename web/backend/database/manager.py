"""Database manager for CRUD operations and session management"""
from sqlalchemy import create_engine, desc, and_, or_
from sqlalchemy.orm import sessionmaker, scoped_session
from sqlalchemy.pool import StaticPool
from contextlib import contextmanager
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import logging
from pathlib import Path

from .models import Base, ForecastJob, ForecastResult, ModelResponse

logger = logging.getLogger(__name__)


class DatabaseManager:
    """Manages database operations for forecast jobs"""

    def __init__(self, db_path: str = None):
        """
        Initialize database manager

        Args:
            db_path: Path to SQLite database file. If None, uses default location.
        """
        if db_path is None:
            # Default to data/database/foresight.db
            base_dir = Path(__file__).parent.parent / 'data' / 'database'
            base_dir.mkdir(parents=True, exist_ok=True)
            db_path = str(base_dir / 'foresight.db')

        # SQLite connection string
        self.db_url = f'sqlite:///{db_path}'

        # Create engine with proper settings for SQLite
        self.engine = create_engine(
            self.db_url,
            connect_args={'check_same_thread': False},
            poolclass=StaticPool,  # Use StaticPool for SQLite
            echo=False  # Set to True for SQL debugging
        )

        # Create session factory
        self.Session = scoped_session(sessionmaker(bind=self.engine))

        # Create all tables
        Base.metadata.create_all(self.engine)

        logger.info(f"Database initialized at: {db_path}")

    @contextmanager
    def session_scope(self):
        """Provide a transactional scope around a series of operations."""
        session = self.Session()
        try:
            yield session
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"Database error: {e}")
            raise
        finally:
            session.close()

    # ========== JOB CRUD OPERATIONS ==========

    def create_job(
        self,
        job_id: str,
        question: str,
        definition: str,
        forecast_type: str,
        iterations: int = 10,
        timeframe: Optional[str] = None,
        context: Optional[str] = None,
        enhanced_prompts: bool = False,
        models_requested: Optional[List[str]] = None
    ) -> ForecastJob:
        """Create a new forecast job"""
        with self.session_scope() as session:
            job = ForecastJob(
                id=job_id,
                question=question,
                definition=definition,
                forecast_type=forecast_type,
                timeframe=timeframe,
                context=context,
                iterations=iterations,
                enhanced_prompts=enhanced_prompts,
                models_requested=models_requested,
                status='pending',
                progress=0.0,
                message='Job created'
            )
            session.add(job)
            session.flush()  # Ensure job is saved
            logger.info(f"Created job: {job_id}")
            return job

    def get_job(self, job_id: str) -> Optional[ForecastJob]:
        """Get a job by ID"""
        with self.session_scope() as session:
            job = session.query(ForecastJob).filter_by(id=job_id).first()
            if job:
                # Detach from session to avoid issues with relationships
                session.expunge(job)
            return job

    def update_job_status(
        self,
        job_id: str,
        status: str,
        progress: float,
        message: str,
        started_at: Optional[datetime] = None,
        completed_at: Optional[datetime] = None
    ) -> bool:
        """Update job status and progress"""
        with self.session_scope() as session:
            job = session.query(ForecastJob).filter_by(id=job_id).first()
            if not job:
                logger.warning(f"Job not found: {job_id}")
                return False

            job.status = status
            job.progress = progress
            job.message = message
            job.updated_at = datetime.utcnow()

            if started_at:
                job.started_at = started_at
            if completed_at:
                job.completed_at = completed_at
                if job.started_at:
                    job.duration_seconds = (completed_at - job.started_at).total_seconds()

            session.flush()
            return True

    def list_jobs(
        self,
        limit: int = 50,
        offset: int = 0,
        status: Optional[str] = None,
        search: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        sort_by: str = 'created_at',
        sort_desc: bool = True
    ) -> Dict[str, Any]:
        """
        List jobs with filtering and pagination

        Args:
            limit: Maximum number of jobs to return
            offset: Number of jobs to skip
            status: Filter by status (completed/failed/running/pending)
            search: Search in question and definition
            start_date: Filter jobs created after this date
            end_date: Filter jobs created before this date
            sort_by: Field to sort by
            sort_desc: Sort descending if True

        Returns:
            Dict with 'jobs' list and 'total' count
        """
        with self.session_scope() as session:
            query = session.query(ForecastJob)

            # Apply filters
            if status:
                query = query.filter(ForecastJob.status == status)

            if search:
                search_pattern = f'%{search}%'
                query = query.filter(
                    or_(
                        ForecastJob.question.ilike(search_pattern),
                        ForecastJob.definition.ilike(search_pattern)
                    )
                )

            if start_date:
                query = query.filter(ForecastJob.created_at >= start_date)

            if end_date:
                query = query.filter(ForecastJob.created_at <= end_date)

            # Get total count before pagination
            total = query.count()

            # Apply sorting
            sort_column = getattr(ForecastJob, sort_by, ForecastJob.created_at)
            if sort_desc:
                query = query.order_by(desc(sort_column))
            else:
                query = query.order_by(sort_column)

            # Apply pagination
            jobs = query.limit(limit).offset(offset).all()

            # Convert to dict while still in session (without result to avoid lazy loading)
            jobs_data = [job.to_dict(include_result=False) for job in jobs]

            return {
                'jobs': jobs_data,
                'total': total,
                'limit': limit,
                'offset': offset
            }

    def delete_job(self, job_id: str) -> bool:
        """Delete a job and all related data"""
        with self.session_scope() as session:
            job = session.query(ForecastJob).filter_by(id=job_id).first()
            if not job:
                return False

            session.delete(job)
            logger.info(f"Deleted job: {job_id}")
            return True

    # ========== RESULT OPERATIONS ==========

    def save_result(
        self,
        job_id: str,
        ensemble_probability: float,
        total_queries: int,
        successful_queries: int,
        failed_queries: int,
        statistics: Dict[str, float],
        models_used: List[str],
        excel_file_path: Optional[str] = None,
        calibrated_probability: Optional[float] = None,
        bayesian_probability: Optional[float] = None,
        consistency_weighted_probability: Optional[float] = None
    ) -> ForecastResult:
        """Save forecast result"""
        with self.session_scope() as session:
            # Check if result already exists
            existing = session.query(ForecastResult).filter_by(job_id=job_id).first()
            if existing:
                # Update existing
                existing.ensemble_probability = ensemble_probability
                existing.total_queries = total_queries
                existing.successful_queries = successful_queries
                existing.failed_queries = failed_queries
                existing.mean_probability = statistics.get('mean')
                existing.median_probability = statistics.get('median')
                existing.std_probability = statistics.get('std')
                existing.min_probability = statistics.get('min')
                existing.max_probability = statistics.get('max')
                existing.models_used = models_used
                existing.excel_file_path = excel_file_path
                existing.calibrated_probability = calibrated_probability
                existing.bayesian_probability = bayesian_probability
                existing.consistency_weighted_probability = consistency_weighted_probability
                result = existing
            else:
                # Create new
                result = ForecastResult(
                    job_id=job_id,
                    ensemble_probability=ensemble_probability,
                    total_queries=total_queries,
                    successful_queries=successful_queries,
                    failed_queries=failed_queries,
                    mean_probability=statistics.get('mean'),
                    median_probability=statistics.get('median'),
                    std_probability=statistics.get('std'),
                    min_probability=statistics.get('min'),
                    max_probability=statistics.get('max'),
                    calibrated_probability=calibrated_probability,
                    bayesian_probability=bayesian_probability,
                    consistency_weighted_probability=consistency_weighted_probability,
                    models_used=models_used,
                    excel_file_path=excel_file_path
                )
                session.add(result)

            session.flush()
            logger.info(f"Saved result for job: {job_id}")
            return result

    # ========== MODEL RESPONSE OPERATIONS ==========

    def save_model_response(
        self,
        job_id: str,
        model_name: str,
        iteration_number: int,
        probability: Optional[float],
        reasoning: Optional[str],
        base_rate: Optional[float],
        case_rate: Optional[float],
        confidence: Optional[float],
        response_time_ms: Optional[int],
        tokens_used: Optional[int],
        success: bool,
        error_message: Optional[str] = None
    ) -> ModelResponse:
        """Save individual model response"""
        with self.session_scope() as session:
            response = ModelResponse(
                job_id=job_id,
                model_name=model_name,
                iteration_number=iteration_number,
                probability=probability,
                reasoning=reasoning,
                base_rate=base_rate,
                case_rate=case_rate,
                confidence=confidence,
                response_time_ms=response_time_ms,
                tokens_used=tokens_used,
                success=success,
                error_message=error_message
            )
            session.add(response)
            session.flush()
            return response

    def get_job_responses(self, job_id: str) -> List[ModelResponse]:
        """Get all model responses for a job"""
        with self.session_scope() as session:
            responses = session.query(ModelResponse).filter_by(job_id=job_id).all()
            # Detach from session
            for resp in responses:
                session.expunge(resp)
            return responses

    # ========== STATISTICS ==========

    def get_statistics(self) -> Dict[str, Any]:
        """Get overall statistics across all jobs"""
        with self.session_scope() as session:
            total_jobs = session.query(ForecastJob).count()
            completed_jobs = session.query(ForecastJob).filter_by(status='completed').count()
            failed_jobs = session.query(ForecastJob).filter_by(status='failed').count()
            running_jobs = session.query(ForecastJob).filter_by(status='running').count()

            # Calculate average probability for completed jobs
            results = session.query(ForecastResult).all()
            avg_probability = sum(r.ensemble_probability for r in results) / len(results) if results else 0

            # Calculate total queries
            total_queries = sum(r.total_queries for r in results) if results else 0
            successful_queries = sum(r.successful_queries for r in results) if results else 0

            # Calculate average duration for completed jobs
            completed = session.query(ForecastJob).filter_by(status='completed').all()
            durations = [j.duration_seconds for j in completed if j.duration_seconds]
            avg_duration = sum(durations) / len(durations) if durations else 0

            return {
                'total_jobs': total_jobs,
                'completed_jobs': completed_jobs,
                'failed_jobs': failed_jobs,
                'running_jobs': running_jobs,
                'success_rate': (completed_jobs / total_jobs * 100) if total_jobs > 0 else 0,
                'average_probability': avg_probability,
                'total_queries': total_queries,
                'successful_queries': successful_queries,
                'query_success_rate': (successful_queries / total_queries * 100) if total_queries > 0 else 0,
                'average_duration_seconds': avg_duration
            }

    def get_job_with_details(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get job with all related data (result and model responses)"""
        with self.session_scope() as session:
            job = session.query(ForecastJob).filter_by(id=job_id).first()
            if not job:
                return None

            # Get result
            result = session.query(ForecastResult).filter_by(job_id=job_id).first()

            # Get model responses
            responses = session.query(ModelResponse).filter_by(job_id=job_id).all()

            # Detach from session
            session.expunge(job)
            if result:
                session.expunge(result)
            for resp in responses:
                session.expunge(resp)

            return {
                'job': job.to_dict(),
                'result': result.to_dict() if result else None,
                'model_responses': [resp.to_dict() for resp in responses]
            }
