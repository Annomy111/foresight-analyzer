"""Main orchestrator for the Foresight Analyzer

This script provides the main entry point for running ensemble forecasts
using multiple AI models via the OpenRouter API.
"""
import asyncio
import logging
import argparse
import sys
from pathlib import Path
from typing import Optional, List
from datetime import datetime
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt, Confirm

# Add project root to path
sys.path.append(str(Path(__file__).parent))

from config.settings import get_settings
from config.prompts import PromptTemplates, ForecastQuestions
from core.ensemble_manager import EnsembleManager
from core.models import ForecastResult, ModelResponse
from analysis.aggregator import ForecastAggregator
from export.excel_exporter import ExcelExporter
from utils.visual import visual

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('foresight.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)
console = Console()


class ForesightAnalyzer:
    """Main orchestrator for foresight analysis"""

    def __init__(self, api_key: Optional[str] = None, use_cache: bool = True, dry_run: bool = False, enhanced_prompts: bool = False):
        """
        Initialize the analyzer

        Args:
            api_key: OpenRouter API key (uses environment if not provided)
            use_cache: Whether to use response caching
            dry_run: Whether to run in dry-run mode (no API calls)
            enhanced_prompts: Whether to use enhanced ensemble-aware prompts with meta-reasoning
        """
        self.settings = get_settings()
        self.dry_run = dry_run
        self.enhanced_prompts = enhanced_prompts
        self.ensemble_manager = EnsembleManager(api_key, use_cache=use_cache, dry_run=dry_run, enhanced_prompts=enhanced_prompts)
        self.aggregator = ForecastAggregator()
        self.exporter = ExcelExporter()

    async def run_ukraine_ceasefire_forecast(self, by_date: Optional[str] = None) -> str:
        """
        Run the specific Ukraine ceasefire 2026 forecast from the research

        Returns:
            Path to the generated Excel file
        """
        # Show enhanced banner
        visual.show_banner()

        # Display forecast overview
        question = "Mit welcher Wahrscheinlichkeit kommt es im Jahr 2026 zu einem Waffenstillstand in der Ukraine?"
        models = self.settings.models.enabled_models

        overview_panel = visual.create_forecast_overview_panel(
            question=question,
            models=models,
            iterations=self.settings.models.iterations_per_model
        )
        console.print(overview_panel)

        # Run the forecast
        forecast_data = await self.ensemble_manager.run_ukraine_ceasefire_forecast(by_date=by_date)

        # Create structured result
        forecast_result = self._create_forecast_result(forecast_data)

        # Export to Excel
        excel_path = self.exporter.export_forecast(forecast_result)

        # Enhanced summary display
        self._display_enhanced_summary(forecast_result)

        # Completion celebration
        visual.show_completion_celebration(str(excel_path))

        return str(excel_path)

    async def run_custom_forecast(
        self,
        question: str,
        definition: str,
        timeframe: Optional[str] = None,
        context: Optional[str] = None,
        models: Optional[List[str]] = None,
        iterations: Optional[int] = None
    ) -> str:
        """
        Run a custom forecast with user-defined parameters

        Args:
            question: The forecast question
            definition: Operational definition of success
            timeframe: Time period for the forecast
            context: Additional context
            models: List of models to use
            iterations: Iterations per model

        Returns:
            Path to the generated Excel file
        """
        # Show enhanced banner
        visual.show_banner()

        # Use defaults if not specified
        models = models or self.settings.models.enabled_models
        iterations = iterations or self.settings.models.iterations_per_model

        # Display forecast overview
        overview_panel = visual.create_forecast_overview_panel(
            question=question,
            models=models,
            iterations=iterations
        )
        console.print(overview_panel)

        # Run the forecast
        forecast_data = await self.ensemble_manager.run_ensemble_forecast(
            question=question,
            definition=definition,
            timeframe=timeframe,
            context=context,
            models=models,
            iterations=iterations
        )

        # Create structured result
        forecast_result = self._create_forecast_result(forecast_data)

        # Export to Excel
        excel_path = self.exporter.export_forecast(forecast_result)

        # Enhanced summary display
        self._display_enhanced_summary(forecast_result)

        # Completion celebration
        visual.show_completion_celebration(str(excel_path))

        return str(excel_path)

    def _create_forecast_result(self, forecast_data: dict) -> ForecastResult:
        """
        Convert raw forecast data to structured ForecastResult

        Args:
            forecast_data: Raw forecast data from ensemble manager

        Returns:
            Structured ForecastResult object
        """
        # Convert responses to ModelResponse objects
        responses = []
        for response_data in forecast_data['responses']:
            response = ModelResponse(**response_data)
            responses.append(response)

        # Calculate statistics
        statistics = self.aggregator.aggregate_results(responses)

        # Create metadata
        from core.models import ForecastMetadata
        metadata = ForecastMetadata(**forecast_data['metadata'])

        # Create final result
        forecast_result = ForecastResult(
            metadata=metadata,
            prompt=forecast_data['prompt'],
            responses=responses,
            statistics=statistics
        )

        return forecast_result

    def _display_enhanced_summary(self, forecast_result: ForecastResult):
        """Display enhanced forecast summary with visual components"""
        ensemble_prob = forecast_result.get_ensemble_probability()

        # Final summary display
        visual.display_final_summary(
            ensemble_prob=ensemble_prob,
            statistics=forecast_result.statistics,
            duration=forecast_result.metadata.duration_seconds
        )

        # Model results table
        results_table = visual.create_results_table(forecast_result.statistics.model_stats)
        console.print("\n")
        console.print(results_table)

        # Consensus analysis
        consensus_panel = visual.create_consensus_panel(forecast_result.statistics)
        console.print("\n")
        console.print(consensus_panel)


async def interactive_mode():
    """Run in interactive mode with enhanced visuals"""
    # Show enhanced banner
    visual.show_banner()

    # Welcome panel
    welcome_panel = Panel.fit(
        "[bold cyan]🎯 Interactive Forecasting Mode[/bold cyan]\n\n"
        "Choose from pre-configured research scenarios or create custom forecasts\n"
        "using our ensemble of AI models with Super-Forecaster methodology.",
        title="Welcome",
        border_style="cyan"
    )
    console.print(welcome_panel)

    analyzer = ForesightAnalyzer()

    while True:
        console.print("\n[bold]Available Options:[/bold]")
        console.print("1. Run Ukraine Ceasefire 2026 forecast (research replication)")
        console.print("2. Run custom forecast")
        console.print("3. Exit")

        choice = Prompt.ask("Select an option", choices=["1", "2", "3"], default="1")

        if choice == "1":
            try:
                excel_path = await analyzer.run_ukraine_ceasefire_forecast()
                console.print(f"\n[green] Analysis complete! Results saved to:[/green] {excel_path}")
            except Exception as e:
                console.print(f"[red]L Error: {e}[/red]")
                logger.error(f"Forecast failed: {e}")

        elif choice == "2":
            # Custom forecast
            console.print("\n[bold]Custom Forecast Setup[/bold]")

            question = Prompt.ask("Enter your forecast question")
            definition = Prompt.ask("Enter the operational definition of success")
            timeframe = Prompt.ask("Enter timeframe (optional)", default="")
            context = Prompt.ask("Enter additional context (optional)", default="")

            # Optional: customize models and iterations
            use_defaults = Confirm.ask("Use default models and settings?", default=True)

            models = None
            iterations = None

            if not use_defaults:
                console.print("\nAvailable models:")
                default_models = get_settings().models.enabled_models
                for i, model in enumerate(default_models):
                    console.print(f"  {i+1}. {model}")

                # For simplicity, use all models - could add model selection here
                iterations = int(Prompt.ask("Iterations per model", default="10"))

            try:
                excel_path = await analyzer.run_custom_forecast(
                    question=question,
                    definition=definition,
                    timeframe=timeframe or None,
                    context=context or None,
                    models=models,
                    iterations=iterations
                )
                console.print(f"\n[green] Analysis complete! Results saved to:[/green] {excel_path}")
            except Exception as e:
                console.print(f"[red]L Error: {e}[/red]")
                logger.error(f"Custom forecast failed: {e}")

        elif choice == "3":
            console.print("Goodbye!")
            break


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="AI Foresight Analyzer")
    parser.add_argument("--mode", choices=["interactive", "ukraine", "custom"],
                       default="interactive", help="Run mode")
    parser.add_argument("--question", help="Forecast question (for custom mode)")
    parser.add_argument("--definition", help="Success definition (for custom mode)")
    parser.add_argument("--timeframe", help="Timeframe (for custom mode)")
    parser.add_argument("--output", help="Output filename")
    parser.add_argument("--iterations", type=int, default=10, help="Iterations per model")
    parser.add_argument("--dev-mode", action="store_true", help="Development mode (uses cache)")
    parser.add_argument("--dry-run", action="store_true", help="Dry run (no API calls, test aggregation)")
    parser.add_argument("--no-cache", action="store_true", help="Disable cache usage")
    parser.add_argument("--cache-stats", action="store_true", help="Show cache statistics and exit")
    parser.add_argument("--by-date", help="Specific date for Ukraine forecast (e.g., 2026-03-31)")
    parser.add_argument("--enhanced-prompts", action="store_true",
                       help="Use enhanced ensemble-aware prompts with meta-reasoning (based on 2024/2025 research)")

    args = parser.parse_args()

    # Handle cache statistics
    if args.cache_stats:
        from core.cache_manager import CacheManager
        cache = CacheManager()
        stats = cache.get_statistics()
        console.print(Panel.fit(
            f"[bold cyan]Cache Statistics[/bold cyan]\n\n"
            f"Active Entries: {stats['active_entries']}\n"
            f"Expired Entries: {stats['expired_entries']}\n"
            f"Total Entries: {stats['total_entries']}\n"
            f"Cache Size: {stats['cache_size_mb']} MB\n"
            f"Database Path: {stats['database_path']}\n\n"
            f"Entries by Model:\n" +
            "\n".join([f"  {model}: {count}" for model, count in stats['entries_by_model'].items()])
        ))
        return 0

    # Check for API key (not needed for dry-run or cache stats)
    if not args.dry_run:
        try:
            settings = get_settings()
        except ValueError as e:
            console.print(f"[red]Configuration Error: {e}[/red]")
            console.print("Please check your .env file and ensure OPENROUTER_API_KEY is set.")
            return 1
    else:
        console.print("[yellow]Running in DRY-RUN mode - no API calls will be made[/yellow]")

    # Set cache mode based on arguments
    use_cache = not args.no_cache
    if args.dev_mode:
        console.print("[cyan]Development mode enabled - using cache where available[/cyan]")
        use_cache = True

    if args.mode == "interactive":
        asyncio.run(interactive_mode())

    elif args.mode == "ukraine":
        async def run_ukraine():
            analyzer = ForesightAnalyzer(use_cache=use_cache, dry_run=args.dry_run, enhanced_prompts=args.enhanced_prompts)
            excel_path = await analyzer.run_ukraine_ceasefire_forecast(by_date=args.by_date)
            console.print(f"Results saved to: {excel_path}")

        asyncio.run(run_ukraine())

    elif args.mode == "custom":
        if not args.question or not args.definition:
            console.print("[red]Error: --question and --definition required for custom mode[/red]")
            return 1

        async def run_custom():
            analyzer = ForesightAnalyzer(use_cache=use_cache, dry_run=args.dry_run, enhanced_prompts=args.enhanced_prompts)
            excel_path = await analyzer.run_custom_forecast(
                question=args.question,
                definition=args.definition,
                timeframe=args.timeframe,
                iterations=args.iterations
            )
            console.print(f"Results saved to: {excel_path}")

        asyncio.run(run_custom())

    return 0


if __name__ == "__main__":
    exit(main())