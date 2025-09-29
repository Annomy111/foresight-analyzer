/**
 * Cloudflare Worker for AI Foresight Analyzer
 * Routes requests to Python backend and handles static assets
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }
    
    // API routes - proxy to Python backend (Durable Objects)
    if (url.pathname.startsWith('/api/')) {
      return handleAPI(request, env);
    }
    
    // WebSocket connections
    if (url.pathname.startsWith('/ws/')) {
      return handleWebSocket(request, env);
    }
    
    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        service: 'foresight-analyzer-worker',
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Default response
    return new Response('AI Foresight Analyzer API', {
      headers: { 'Content-Type': 'text/plain' }
    });
  }
};

function handleCORS() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
  });
}

async function handleAPI(request, env) {
  // In production, this would route to Durable Objects or Python runtime
  // For now, return placeholder response
  
  const url = new URL(request.url);
  
  // List models endpoint
  if (url.pathname === '/api/models') {
    return new Response(JSON.stringify({
      free_models: [
        'x-ai/grok-4-fast:free',
        'deepseek/deepseek-chat-v3.1:free',
        'meta-llama/llama-3.3-70b-instruct:free',
        'qwen/qwen-2.5-72b-instruct:free',
        'mistralai/mistral-nemo:free'
      ],
      premium_models: [
        'google/gemini-2.5-pro-preview',
        'openai/gpt-5-chat',
        'anthropic/claude-opus-4.1',
        'x-ai/grok-4',
        'deepseek/deepseek-chat-v3.1'
      ]
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
  
  // Create forecast endpoint - forward to backend if configured
  if (url.pathname === '/api/forecast/custom' && request.method === 'POST') {
    if (env.BACKEND_URL) {
      // Forward to external FastAPI backend
      return fetch(`${env.BACKEND_URL}${url.pathname}`, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
    }
    return new Response(JSON.stringify({
      error: 'Backend service not configured. Please set BACKEND_URL environment variable.'
    }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
  
  return new Response(JSON.stringify({
    message: 'AI Foresight Analyzer API',
    version: '2.0',
    endpoints: [
      'GET /api/models - List available models',
      'POST /api/forecast/custom - Create custom forecast',
      'POST /api/forecast/ukraine - Create Ukraine forecast',
      'GET /api/jobs/{id} - Get job status',
      'GET /api/jobs - List all jobs'
    ]
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

async function handleWebSocket(request, env) {
  // WebSocket upgrade for real-time updates
  const upgradeHeader = request.headers.get('Upgrade');
  if (!upgradeHeader || upgradeHeader !== 'websocket') {
    return new Response('Expected Upgrade: websocket', { status: 426 });
  }
  
  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);
  
  // Accept the WebSocket connection
  server.accept();
  
  // Handle WebSocket messages
  server.addEventListener('message', event => {
    server.send(JSON.stringify({
      type: 'pong',
      timestamp: new Date().toISOString()
    }));
  });
  
  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}
