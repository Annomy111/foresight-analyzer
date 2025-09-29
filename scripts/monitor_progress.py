#!/usr/bin/env python3
"""Monitor forecast progress in real-time"""

import time
import os
from rich.console import Console
from rich.live import Live
from rich.panel import Panel
from rich.table import Table

console = Console()

def get_log_stats():
    """Parse the log file for current statistics"""
    log_file = "forecast_output.log"

    if not os.path.exists(log_file):
        return {"status": "Waiting for log file..."}

    with open(log_file, 'r') as f:
        lines = f.readlines()

    # Count results
    successful = 0
    no_prob = 0
    errors = 0
    current_model = ""
    probabilities = []

    for line in lines:
        if "✓" in line and "%" in line:
            successful += 1
            # Extract probability
            try:
                prob_str = line.split(":")[-1].strip().replace("%", "")
                prob = float(prob_str)
                probabilities.append(prob)
            except:
                pass
        elif "⚠" in line:
            no_prob += 1
        elif "✗" in line:
            errors += 1
        elif "Average:" in line:
            current_model = line.split()[0] if line.split() else ""

    total = successful + no_prob + errors

    # Calculate mean
    mean = sum(probabilities) / len(probabilities) if probabilities else 0

    return {
        "total": total,
        "successful": successful,
        "no_prob": no_prob,
        "errors": errors,
        "mean": mean,
        "current_model": current_model
    }

def create_display():
    """Create the display panel"""
    stats = get_log_stats()

    table = Table(show_header=False, box=None)
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="yellow")

    table.add_row("📊 Total Queries", f"{stats.get('total', 0)}/120")
    table.add_row("✅ Successful", str(stats.get('successful', 0)))
    table.add_row("⚠️  No Probability", str(stats.get('no_prob', 0)))
    table.add_row("❌ Errors", str(stats.get('errors', 0)))
    table.add_row("📈 Current Mean", f"{stats.get('mean', 0):.1f}%")

    progress = (stats.get('total', 0) / 120) * 100 if stats.get('total', 0) else 0
    progress_bar = "█" * int(progress / 5) + "░" * (20 - int(progress / 5))
    table.add_row("Progress", f"[{progress_bar}] {progress:.0f}%")

    return Panel(table, title="🔮 Ukraine Forecast Progress", border_style="cyan")

if __name__ == "__main__":
    console.print("[cyan]Monitoring forecast progress...[/cyan]")
    console.print("Press Ctrl+C to stop monitoring\n")

    try:
        with Live(create_display(), refresh_per_second=1, console=console) as live:
            while True:
                time.sleep(1)
                live.update(create_display())
    except KeyboardInterrupt:
        console.print("\n[yellow]Monitoring stopped[/yellow]")