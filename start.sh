#!/bin/bash
# RPG Generator - Start Script (Linux/Mac)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== 叙游工坊 (RPG Generator) ===${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    exit 1
fi

echo -e "${YELLOW}Node.js version: $(node --version)${NC}"

# Install backend dependencies if needed
if [ ! -d "backend/node_modules" ]; then
    echo -e "${YELLOW}Installing backend dependencies...${NC}"
    cd backend && npm install && cd ..
fi

# Install frontend dependencies and build if needed
if [ ! -d "frontend/node_modules" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    cd frontend && npm install && cd ..
fi

if [ ! -d "backend/public/assets" ]; then
    echo -e "${YELLOW}Building frontend...${NC}"
    cd frontend && npm run build && cd ..
fi

# Load .env if exists
if [ -f ".env" ]; then
    echo -e "${YELLOW}Loading .env configuration...${NC}"
    set -a
    source .env
    set +a
fi

# Start backend
echo -e "${GREEN}Starting server on port ${PORT:-3000}...${NC}"
cd backend
node server.js
