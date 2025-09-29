"""Setup script for Foresight Analyzer"""
import os
import sys
from pathlib import Path

def setup_project():
    """Set up the project environment"""
    print("🔧 Setting up Foresight Analyzer...")

    # Create necessary directories
    dirs = [
        "data/results",
        "data/logs"
    ]

    for dir_path in dirs:
        Path(dir_path).mkdir(parents=True, exist_ok=True)
        print(f"✓ Created directory: {dir_path}")

    # Check for .env file
    if not Path(".env").exists():
        if Path(".env.example").exists():
            print("⚠️  No .env file found. Please copy .env.example to .env and add your OpenRouter API key.")
            print("   cp .env.example .env")
        else:
            print("❌ No .env.example file found!")
    else:
        print("✓ .env file exists")

    # Check Python version
    if sys.version_info < (3, 10):
        print("❌ Python 3.10+ required")
        return False
    else:
        print(f"✓ Python version: {sys.version}")

    print("\n🚀 Setup complete!")
    print("\nNext steps:")
    print("1. Add your OpenRouter API key to .env file")
    print("2. Install dependencies: pip install -r requirements.txt")
    print("3. Run the analyzer: python main.py")

    return True

if __name__ == "__main__":
    setup_project()