/**
 * Durable Object for processing forecast jobs
 * Handles long-running forecast tasks beyond Worker CPU limits
 */

export class ForecastProcessor {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.jobs = new Map();
  }
  
  async fetch(request) {
    const url = new URL(request.url);
    
    // Create new forecast job
    if (url.pathname === '/api/forecast/custom' && request.method === 'POST') {
      return this.createForecast(request);
    }
    
    // Get job status
    if (url.pathname.startsWith('/api/jobs/')) {
      const jobId = url.pathname.split('/').pop();
      return this.getJobStatus(jobId);
    }
    
    return new Response('Not found', { status: 404 });
  }
  
  async createForecast(request) {
    try {
      const body = await request.json();
      const jobId = crypto.randomUUID();
      
      // Create job record
      const job = {
        jobId,
        status: 'pending',
        progress: 0,
        message: 'Job created',
        request: body,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Store in Durable Object state
      await this.state.storage.put(`job:${jobId}`, job);
      this.jobs.set(jobId, job);
      
      // Start processing (non-blocking)
      this.processForecast(jobId, body);
      
      return new Response(JSON.stringify(job), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
      
    } catch (error) {
      return new Response(JSON.stringify({
        error: error.message
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
  
  async processForecast(jobId, request) {
    try {
      // Update job status
      await this.updateJob(jobId, {
        status: 'running',
        progress: 0.1,
        message: 'Starting forecast processing...'
      });
      
      // IMPORTANT: Cloudflare Workers Python runtime is in beta
      // For now, we'll simulate the process or use an external service
      
      // Option 1: Call external FastAPI service (Railway/Fly.io)
      if (this.env.BACKEND_URL) {
        const response = await fetch(`${this.env.BACKEND_URL}/api/forecast/custom`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request)
        });
        
        const externalJob = await response.json();
        
        // Poll external service for updates
        await this.pollExternalService(jobId, externalJob.job_id);
        return;
      }
      
      // Option 2: Simulate processing (for testing)
      await this.simulateProcessing(jobId);
      
    } catch (error) {
      await this.updateJob(jobId, {
        status: 'failed',
        progress: 0,
        message: `Error: ${error.message}`
      });
    }
  }
  
  async simulateProcessing(jobId) {
    // Simulate forecast processing steps
    const steps = [
      { progress: 0.2, message: 'Initializing models...', delay: 1000 },
      { progress: 0.4, message: 'Querying LLMs...', delay: 3000 },
      { progress: 0.6, message: 'Processing responses...', delay: 2000 },
      { progress: 0.8, message: 'Aggregating results...', delay: 1500 },
      { progress: 1.0, message: 'Completed!', delay: 500 }
    ];
    
    for (const step of steps) {
      await new Promise(resolve => setTimeout(resolve, step.delay));
      await this.updateJob(jobId, {
        status: step.progress < 1.0 ? 'running' : 'completed',
        progress: step.progress,
        message: step.message,
        result: step.progress === 1.0 ? {
          ensemble_probability: 0.45,
          total_queries: 50,
          successful_queries: 48,
          statistics: {
            mean: 0.45,
            median: 0.44,
            std: 0.08,
            min: 0.32,
            max: 0.59
          }
        } : undefined
      });
    }
  }
  
  async pollExternalService(jobId, externalJobId) {
    // Poll external service for job completion
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes max
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      try {
        const response = await fetch(`${this.env.BACKEND_URL}/api/jobs/${externalJobId}`);
        const externalJob = await response.json();
        
        await this.updateJob(jobId, {
          status: externalJob.status,
          progress: externalJob.progress,
          message: externalJob.message,
          result: externalJob.result
        });
        
        if (externalJob.status === 'completed' || externalJob.status === 'failed') {
          break;
        }
      } catch (error) {
        console.error('Error polling external service:', error);
      }
      
      attempts++;
    }
  }
  
  async updateJob(jobId, updates) {
    const job = await this.state.storage.get(`job:${jobId}`);
    if (!job) return;
    
    const updatedJob = {
      ...job,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    await this.state.storage.put(`job:${jobId}`, updatedJob);
    this.jobs.set(jobId, updatedJob);
    
    // Broadcast to connected WebSockets
    this.state.getWebSockets().forEach(ws => {
      try {
        ws.send(JSON.stringify({
          type: 'job_update',
          jobId,
          data: updatedJob
        }));
      } catch (error) {
        console.error('Error sending WebSocket update:', error);
      }
    });
  }
  
  async getJobStatus(jobId) {
    const job = await this.state.storage.get(`job:${jobId}`);
    
    if (!job) {
      return new Response(JSON.stringify({
        error: 'Job not found'
      }), {
        status: 404,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    return new Response(JSON.stringify(job), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
  
  async webSocketMessage(ws, message) {
    // Handle WebSocket messages from clients
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'subscribe') {
        // Client subscribing to job updates
        const jobId = data.jobId;
        const job = await this.state.storage.get(`job:${jobId}`);
        
        if (job) {
          ws.send(JSON.stringify({
            type: 'job_update',
            jobId,
            data: job
          }));
        }
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }
  
  async webSocketClose(ws, code, reason, wasClean) {
    // Clean up when WebSocket closes
    ws.close(code, 'Durable Object is closing WebSocket');
  }
}
