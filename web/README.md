# AI Foresight Analyzer - Web Deployment

Full-stack web application for the AI Foresight Analyzer with Cloudflare deployment.

## Architecture

### Frontend (React + TypeScript + Vite)
- **Location**: `frontend/`
- **Deploy to**: Cloudflare Pages
- **Features**:
  - Beautiful UI with Tailwind CSS
  - Real-time progress updates via WebSocket
  - Interactive charts with Chart.js
  - Responsive design

### Backend (FastAPI + Cloudflare Workers)
- **Location**: `backend/`
- **Deploy to**: Cloudflare Workers + Durable Objects
- **Features**:
  - REST API endpoints
  - Long-running job management
  - WebSocket support
  - Integration with Python forecasting engine

## Local Development

### Prerequisites
- Node.js 20.17+ (for frontend)
- Python 3.10+ (for backend)
- OpenRouter API key

### 1. Start Backend (FastAPI)

```bash
cd backend

# Install Python dependencies
pip install fastapi uvicorn websockets

# Run the server
python api.py
# Server will start at http://localhost:8000
```

### 2. Start Frontend (React)

```bash
cd frontend

# Install dependencies (if not done yet)
npm install

# Start development server
npm run dev
# Frontend will start at http://localhost:5173
```

### 3. Open in Browser

Navigate to `http://localhost:5173` and you'll see the full application!

---

## Cloud flare Deployment

### Step 1: Setup Cloudflare Account

1. Create account at [cloudflare.com](https://cloudflare.com)
2. Get your Account ID from dashboard
3. Install Wrangler CLI:
   ```bash
   npm install -g wrangler
   # or use local: npx wrangler
   ```

### Step 2: Configure Backend

```bash
cd backend

# Login to Cloudflare
npx wrangler login

# Update wrangler.toml with your account ID
# Replace "your_account_id_here" with actual ID

# Create KV namespace for caching
npx wrangler kv:namespace create "FORECAST_CACHE"
# Update wrangler.toml with returned ID

# Create R2 bucket for results
npx wrangler r2 bucket create foresight-results

# Set secrets
npx wrangler secret put OPENROUTER_API_KEY
# Paste your OpenRouter API key when prompted
```

### Step 3: Deploy Backend to Workers

```bash
cd backend
npx wrangler deploy

# Your API will be available at:
# https://foresight-analyzer-api.your-account.workers.dev
```

### Step 4: Deploy Frontend to Pages

```bash
cd frontend

# Update .env with your Worker URL
echo "VITE_API_URL=https://foresight-analyzer-api.your-account.workers.dev" > .env

# Build the frontend
npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist

# Or connect to GitHub for automatic deployments:
# 1. Push code to GitHub
# 2. Go to Cloudflare Dashboard → Pages
# 3. Connect your repository
# 4. Set build command: npm run build
# 5. Set build output directory: dist
# 6. Add environment variable: VITE_API_URL=https://your-worker-url
```

---

## Environment Variables

### Frontend (.env)
```bash
VITE_API_URL=http://localhost:8000  # Local development
# VITE_API_URL=https://your-worker.workers.dev  # Production
```

### Backend (Cloudflare Secrets)
```bash
OPENROUTER_API_KEY=your_key_here  # Your OpenRouter API key from openrouter.ai
BACKEND_URL=your_backend_url  # Optional external backend URL
```

---

## Hybrid Deployment (Recommended)

For production with long-running forecasts, we recommend hybrid architecture:

### Option A: Cloudflare + External Backend
1. **Frontend**: Cloudflare Pages ✅
2. **Worker**: Cloudflare Workers (routing) ✅  
3. **Backend**: Railway/Fly.io/Render (FastAPI) ✅

**Steps**:
```bash
# 1. Deploy FastAPI to Railway
railway login
railway init
railway up

# 2. Get Railway URL and update Worker
npx wrangler secret put BACKEND_URL
# Enter: https://your-app.railway.app

# 3. Deploy Worker and Frontend as above
```

### Option B: Full Cloudflare (Experimental)
- Uses Cloudflare Workers Python runtime (beta)
- CPU time limits may require splitting forecast into chunks
- Best for shorter forecasts (<30 seconds)

---

## Project Structure

```
web/
├── backend/
│   ├── api.py                    # FastAPI application
│   ├── worker.js                 # Cloudflare Worker
│   ├── forecast-processor.js    # Durable Object
│   └── wrangler.toml            # CF configuration
│
├── frontend/
│   ├── src/
│   │   ├── components/          # React components
│   │   ├── hooks/               # Custom hooks
│   │   ├── lib/                 # API client
│   │   ├── pages/               # Page components
│   │   ├── App.tsx              # Main app
│   │   └── main.tsx            # Entry point
│   ├── public/
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
│
└── shared/                       # Shared types/utils
```

---

## Features

### ✅ Implemented
- [x] Forecast form (Ukraine & Custom)
- [x] Real-time progress updates
- [x] Results visualization with charts
- [x] Model selection
- [x] API key management
- [x] Responsive design
- [x] WebSocket support
- [x] Job queue system

### 🚧 Coming Soon
- [ ] Forecast history
- [ ] Excel file downloads
- [ ] User authentication
- [ ] Saved forecasts
- [ ] Model comparison dashboard
- [ ] Advanced settings

---

## Troubleshooting

### Frontend can't connect to backend
- Check VITE_API_URL in `.env`
- Ensure backend is running
- Check browser console for CORS errors

### Worker deployment fails
- Verify account ID in wrangler.toml
- Run `npx wrangler login` to authenticate
- Check Cloudflare dashboard for errors

### Long forecasts timeout
- Use hybrid deployment with external backend
- Or implement chunked processing in Worker
- Or use Durable Objects for longer tasks

---

## Cost Estimate

### Free Tier (Cloudflare)
- Workers: 100,000 requests/day
- Pages: Unlimited bandwidth
- KV: 100,000 reads/day
- R2: 10GB storage

### With External Backend
- Railway: $5/month (Hobby plan)
- Total: ~$5-10/month

### API Costs
- Free models: $0
- Premium models: Variable based on usage

---

## Support

For issues or questions:
1. Check GitHub issues
2. Review Cloudflare Workers docs
3. Test locally first before deploying

---

**Version**: 2.0  
**Last Updated**: 2025-01-29
