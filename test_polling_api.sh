#!/bin/bash

API_KEY="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"
WORKER_URL="https://foresight-analyzer-api.dieter-meier82.workers.dev"

echo "🚀 Creating forecast with FREE model..."
JOB_RESPONSE=$(curl -s -X POST "$WORKER_URL/api/forecast/custom" \
  -H "Content-Type: application/json" \
  -d "{\"question\":\"Test polling question\",\"definition\":\"Test definition\",\"iterations\":1,\"api_key\":\"$API_KEY\",\"enhanced_prompts\":false,\"models\":[\"deepseek/deepseek-chat-v3.1:free\"]}")

echo "$JOB_RESPONSE" | jq .

JOB_ID=$(echo "$JOB_RESPONSE" | jq -r '.job_id')
echo ""
echo "📋 Job ID: $JOB_ID"
echo ""
echo "👀 Polling for updates (simulating frontend polling)..."
echo ""

for i in {1..15}; do
  echo "[$i] Polling at $(date +%H:%M:%S)..."
  
  STATUS_RESPONSE=$(curl -s "$WORKER_URL/api/jobs/$JOB_ID")
  
  STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status')
  PROGRESS=$(echo "$STATUS_RESPONSE" | jq -r '.progress')
  MESSAGE=$(echo "$STATUS_RESPONSE" | jq -r '.message')
  
  echo "    Status: $STATUS | Progress: $PROGRESS | Message: $MESSAGE"
  
  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
    echo ""
    echo "✅ Forecast finished!"
    echo ""
    echo "📊 Final result:"
    echo "$STATUS_RESPONSE" | jq '.result'
    break
  fi
  
  sleep 2
done
