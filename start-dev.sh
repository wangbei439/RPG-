#!/bin/bash
# Start both servers for development
export AUTH_DISABLED=true
export PORT=3000

echo "Starting 叙游工坊 development servers..."

# Start backend
cd "$(dirname "$0")/backend"
node server.js &
BE_PID=$!

# Start frontend
cd "$(dirname "$0")/frontend"
npx vite --port 5173 --host 0.0.0.0 &
FE_PID=$!

echo "Backend PID: $BE_PID"
echo "Frontend PID: $FE_PID"
echo "Backend: http://localhost:3000"
echo "Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for any child to exit
wait
