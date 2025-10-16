#!/bin/bash
# Setup Cloudflare Tunnel for HTTPS access to backend
# This creates a secure HTTPS tunnel to your HTTP backend

echo "🔐 Setting up Cloudflare Tunnel for HTTPS access..."
echo ""
echo "This will create a secure HTTPS URL for your backend API."
echo ""

# Check if cloudflared is installed locally
if ! command -v cloudflared &> /dev/null; then
    echo "📦 Installing cloudflared..."

    # macOS installation
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install cloudflare/cloudflare/cloudflared
    else
        # Linux installation
        curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
        sudo dpkg -i cloudflared.deb
        rm cloudflared.deb
    fi
fi

echo ""
echo "🚀 Starting Cloudflare Tunnel..."
echo ""
echo "This will create a public HTTPS URL that tunnels to http://130.61.137.77"
echo ""
echo "Keep this terminal open while using the application!"
echo "Press Ctrl+C to stop the tunnel."
echo ""
echo "========================================="
echo ""

# Start tunnel to backend
cloudflared tunnel --url http://130.61.137.77

# The tunnel will output something like:
# https://something-random.trycloudflare.com