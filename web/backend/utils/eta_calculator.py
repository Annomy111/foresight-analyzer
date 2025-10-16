"""ETA (Estimated Time of Arrival) calculator for forecast jobs"""
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from collections import deque


class ETACalculator:
    """Calculates estimated time remaining for forecast jobs"""

    def __init__(self, window_size: int = 10):
        """
        Initialize ETA calculator

        Args:
            window_size: Number of recent timings to use for moving average
        """
        self.window_size = window_size
        self.query_times = deque(maxlen=window_size)
        self.start_time = None
        self.total_queries = 0
        self.completed_queries = 0
        self.last_update_time = None

    def start(self, total_queries: int):
        """
        Start tracking for a new job

        Args:
            total_queries: Total number of queries to be executed
        """
        self.start_time = datetime.now()
        self.last_update_time = self.start_time
        self.total_queries = total_queries
        self.completed_queries = 0
        self.query_times.clear()

    def update(self, queries_completed: int = 1):
        """
        Update with completed queries

        Args:
            queries_completed: Number of queries just completed
        """
        now = datetime.now()

        if self.last_update_time:
            # Calculate time taken for these queries
            time_delta = (now - self.last_update_time).total_seconds()
            # Add per-query time to our moving average
            per_query_time = time_delta / queries_completed if queries_completed > 0 else time_delta
            self.query_times.append(per_query_time)

        self.completed_queries += queries_completed
        self.last_update_time = now

    def get_eta(self) -> Optional[int]:
        """
        Get estimated seconds remaining

        Returns:
            Estimated seconds remaining, or None if not enough data
        """
        if not self.query_times or self.completed_queries == 0:
            return None

        remaining_queries = self.total_queries - self.completed_queries
        if remaining_queries <= 0:
            return 0

        # Calculate average time per query using moving average
        avg_time_per_query = sum(self.query_times) / len(self.query_times)

        # Estimate remaining time
        estimated_seconds = int(avg_time_per_query * remaining_queries)

        return estimated_seconds

    def get_speed(self) -> Optional[float]:
        """
        Get current speed in queries per second

        Returns:
            Queries per second, or None if not enough data
        """
        if not self.query_times:
            return None

        avg_time_per_query = sum(self.query_times) / len(self.query_times)
        if avg_time_per_query == 0:
            return None

        # Queries per second
        speed = 1.0 / avg_time_per_query

        return round(speed, 2)

    def get_elapsed_time(self) -> int:
        """
        Get elapsed time since start

        Returns:
            Elapsed seconds
        """
        if not self.start_time:
            return 0

        elapsed = (datetime.now() - self.start_time).total_seconds()
        return int(elapsed)

    def get_progress(self) -> float:
        """
        Get current progress as fraction

        Returns:
            Progress between 0.0 and 1.0
        """
        if self.total_queries == 0:
            return 0.0

        progress = self.completed_queries / self.total_queries
        return min(1.0, max(0.0, progress))

    def get_statistics(self) -> Dict[str, Any]:
        """
        Get all statistics

        Returns:
            Dict with all timing statistics
        """
        eta_seconds = self.get_eta()
        speed = self.get_speed()
        elapsed = self.get_elapsed_time()
        progress = self.get_progress()

        # Format ETA as human-readable string
        eta_str = self._format_duration(eta_seconds) if eta_seconds is not None else "Calculating..."

        # Format speed as human-readable
        speed_str = f"{speed:.1f} queries/sec" if speed else "Calculating..."

        return {
            'total_queries': self.total_queries,
            'completed_queries': self.completed_queries,
            'remaining_queries': self.total_queries - self.completed_queries,
            'progress': progress,
            'progress_percent': int(progress * 100),
            'elapsed_seconds': elapsed,
            'elapsed_str': self._format_duration(elapsed),
            'eta_seconds': eta_seconds,
            'eta_str': eta_str,
            'speed': speed,
            'speed_str': speed_str,
            'avg_time_per_query': sum(self.query_times) / len(self.query_times) if self.query_times else None
        }

    @staticmethod
    def _format_duration(seconds: Optional[int]) -> str:
        """
        Format duration in human-readable format

        Args:
            seconds: Duration in seconds

        Returns:
            Human-readable string like "2m 30s" or "45s"
        """
        if seconds is None:
            return "Unknown"

        if seconds < 0:
            return "Complete"

        if seconds < 60:
            return f"{seconds}s"

        minutes = seconds // 60
        remaining_seconds = seconds % 60

        if minutes < 60:
            if remaining_seconds > 0:
                return f"{minutes}m {remaining_seconds}s"
            return f"{minutes}m"

        hours = minutes // 60
        remaining_minutes = minutes % 60

        parts = [f"{hours}h"]
        if remaining_minutes > 0:
            parts.append(f"{remaining_minutes}m")

        return " ".join(parts)


class ModelETATracker:
    """Tracks ETA for individual models within a job"""

    def __init__(self):
        """Initialize model-level ETA tracker"""
        self.model_calculators: Dict[str, ETACalculator] = {}
        self.global_calculator = ETACalculator()

    def start_job(self, models: List[str], iterations_per_model: int):
        """
        Start tracking for a new job

        Args:
            models: List of model names
            iterations_per_model: Number of iterations per model
        """
        # Initialize calculator for each model
        for model in models:
            calc = ETACalculator()
            calc.start(iterations_per_model)
            self.model_calculators[model] = calc

        # Initialize global calculator
        total_queries = len(models) * iterations_per_model
        self.global_calculator.start(total_queries)

    def update_model(self, model_name: str, queries_completed: int = 1):
        """
        Update progress for a specific model

        Args:
            model_name: Name of the model
            queries_completed: Number of queries completed
        """
        if model_name in self.model_calculators:
            self.model_calculators[model_name].update(queries_completed)

        # Also update global
        self.global_calculator.update(queries_completed)

    def get_model_stats(self, model_name: str) -> Optional[Dict[str, Any]]:
        """Get statistics for a specific model"""
        if model_name not in self.model_calculators:
            return None

        return self.model_calculators[model_name].get_statistics()

    def get_global_stats(self) -> Dict[str, Any]:
        """Get global job statistics"""
        return self.global_calculator.get_statistics()

    def get_all_model_stats(self) -> Dict[str, Dict[str, Any]]:
        """Get statistics for all models"""
        return {
            model: calc.get_statistics()
            for model, calc in self.model_calculators.items()
        }

    def get_model_status(self, model_name: str) -> str:
        """
        Get status of a model

        Returns:
            'pending', 'running', or 'completed'
        """
        if model_name not in self.model_calculators:
            return 'pending'

        calc = self.model_calculators[model_name]
        if calc.completed_queries == 0:
            return 'pending'
        elif calc.completed_queries >= calc.total_queries:
            return 'completed'
        else:
            return 'running'
