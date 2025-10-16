"""SQLAlchemy database models for forecast job persistence"""
from sqlalchemy import Column, String, Integer, Float, Boolean, Text, ForeignKey, JSON, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

Base = declarative_base()


class ForecastJob(Base):
    """Main forecast job table"""
    __tablename__ = 'forecast_jobs'

    # Primary identification
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # Forecast parameters
    question = Column(Text, nullable=False)
    definition = Column(Text, nullable=False)
    timeframe = Column(Text, nullable=True)
    context = Column(Text, nullable=True)
    forecast_type = Column(String(50), nullable=False)  # 'ukraine' or 'custom'

    # Execution parameters
    iterations = Column(Integer, nullable=False, default=10)
    enhanced_prompts = Column(Boolean, default=False)
    models_requested = Column(JSON, nullable=True)  # List of model names

    # Status tracking
    status = Column(String(20), nullable=False, default='pending')  # pending/running/completed/failed
    progress = Column(Float, default=0.0)  # 0.0 to 1.0
    message = Column(Text, nullable=True)

    # Timing information
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Float, nullable=True)

    # Relationships
    result = relationship('ForecastResult', back_populates='job', uselist=False, cascade='all, delete-orphan')
    model_responses = relationship('ModelResponse', back_populates='job', cascade='all, delete-orphan')

    def to_dict(self, include_result=False):
        """Convert to dictionary for API responses"""
        data = {
            'job_id': self.id,
            'question': self.question,
            'definition': self.definition,
            'timeframe': self.timeframe,
            'context': self.context,
            'forecast_type': self.forecast_type,
            'status': self.status,
            'progress': self.progress,
            'message': self.message,
            'iterations': self.iterations,
            'enhanced_prompts': self.enhanced_prompts,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'duration_seconds': self.duration_seconds,
        }

        # Only include result if explicitly requested (to avoid lazy loading issues)
        if include_result:
            try:
                data['result'] = self.result.to_dict() if self.result else None
            except:
                data['result'] = None
        else:
            data['result'] = None

        return data


class ForecastResult(Base):
    """Aggregated forecast results"""
    __tablename__ = 'forecast_results'

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(String(36), ForeignKey('forecast_jobs.id'), nullable=False, unique=True)

    # Main result
    ensemble_probability = Column(Float, nullable=False)

    # Query statistics
    total_queries = Column(Integer, nullable=False)
    successful_queries = Column(Integer, nullable=False)
    failed_queries = Column(Integer, default=0)

    # Probability statistics
    mean_probability = Column(Float, nullable=True)
    median_probability = Column(Float, nullable=True)
    std_probability = Column(Float, nullable=True)
    min_probability = Column(Float, nullable=True)
    max_probability = Column(Float, nullable=True)

    # Advanced aggregation results
    calibrated_probability = Column(Float, nullable=True)
    bayesian_probability = Column(Float, nullable=True)
    consistency_weighted_probability = Column(Float, nullable=True)

    # Model information
    models_used = Column(JSON, nullable=True)  # List of model names actually used

    # Output files
    excel_file_path = Column(Text, nullable=True)

    # Relationships
    job = relationship('ForecastJob', back_populates='result')

    def to_dict(self):
        """Convert to dictionary for API responses"""
        return {
            'ensemble_probability': self.ensemble_probability,
            'total_queries': self.total_queries,
            'successful_queries': self.successful_queries,
            'failed_queries': self.failed_queries,
            'statistics': {
                'mean': self.mean_probability,
                'median': self.median_probability,
                'std': self.std_probability,
                'min': self.min_probability,
                'max': self.max_probability
            },
            'calibrated_probability': self.calibrated_probability,
            'bayesian_probability': self.bayesian_probability,
            'consistency_weighted_probability': self.consistency_weighted_probability,
            'models_used': self.models_used,
            'excel_file_path': self.excel_file_path
        }


class ModelResponse(Base):
    """Individual model responses"""
    __tablename__ = 'model_responses'

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(String(36), ForeignKey('forecast_jobs.id'), nullable=False)

    # Model information
    model_name = Column(String(200), nullable=False)
    iteration_number = Column(Integer, nullable=False)

    # Response data
    probability = Column(Float, nullable=True)
    reasoning = Column(Text, nullable=True)  # Full reasoning text
    base_rate = Column(Float, nullable=True)
    case_rate = Column(Float, nullable=True)
    confidence = Column(Float, nullable=True)

    # Execution metadata
    response_time_ms = Column(Integer, nullable=True)
    tokens_used = Column(Integer, nullable=True)
    success = Column(Boolean, default=False)
    error_message = Column(Text, nullable=True)

    # Timing
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    job = relationship('ForecastJob', back_populates='model_responses')

    def to_dict(self):
        """Convert to dictionary for API responses"""
        return {
            'id': self.id,
            'model_name': self.model_name,
            'iteration_number': self.iteration_number,
            'probability': self.probability,
            'reasoning': self.reasoning,
            'base_rate': self.base_rate,
            'case_rate': self.case_rate,
            'confidence': self.confidence,
            'response_time_ms': self.response_time_ms,
            'tokens_used': self.tokens_used,
            'success': self.success,
            'error_message': self.error_message,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
