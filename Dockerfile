# Multi-stage build for RPG Generator
FROM node:20-alpine AS backend-builder

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/ ./

FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Production image
FROM node:20-alpine

LABEL maintainer="RPG Generator"
LABEL description="AI-powered RPG Game Generator"

# Create non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy backend with node_modules
COPY --from=backend-builder /app/backend ./backend

# Copy built frontend to backend/public
COPY --from=frontend-builder /app/frontend/dist ./backend/public

# Create data directory with proper ownership
RUN mkdir -p /app/backend/data && chown -R appuser:appgroup /app/backend/data

# Set environment defaults
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

# Switch to non-root user
USER appuser

WORKDIR /app/backend
CMD ["node", "server.js"]
