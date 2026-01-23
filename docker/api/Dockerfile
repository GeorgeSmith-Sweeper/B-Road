# =============================================================================
# B-Road API Dockerfile
# Multi-stage build: base -> deps -> dev / prod / test
# =============================================================================

# -----------------------------------------------------------------------------
# Base stage: System dependencies
# -----------------------------------------------------------------------------
FROM python:3.11-slim-bookworm AS base

# Install system dependencies for PostGIS and geospatial libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libgeos-c1v5 \
    libproj25 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash appuser

# -----------------------------------------------------------------------------
# Dependencies stage: Install Python packages
# -----------------------------------------------------------------------------
FROM base AS deps

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libgeos-dev \
    libproj-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY api/requirements.txt ./requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# -----------------------------------------------------------------------------
# Development stage: Hot-reload enabled
# -----------------------------------------------------------------------------
FROM deps AS dev

# Install development tools
RUN pip install --no-cache-dir \
    pytest \
    pytest-asyncio \
    pytest-cov \
    httpx

# Set environment for development
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app

# Switch to non-root user
USER appuser

EXPOSE 8000

# Development server with hot-reload
CMD ["uvicorn", "api.server:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# -----------------------------------------------------------------------------
# Production stage: Optimized for deployment
# -----------------------------------------------------------------------------
FROM base AS prod

# Copy only runtime dependencies from deps stage
COPY --from=deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin

# Copy application code
COPY api/ ./api/
COPY curvature/ ./curvature/

# Set environment for production
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app

# Change ownership to non-root user
RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

# Production server with multiple workers
CMD ["uvicorn", "api.server:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]

# -----------------------------------------------------------------------------
# Test stage: For running tests
# -----------------------------------------------------------------------------
FROM deps AS test

# Install test dependencies
RUN pip install --no-cache-dir \
    pytest \
    pytest-asyncio \
    pytest-cov \
    httpx

# Set environment for testing
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app

# Copy application code
COPY api/ ./api/
COPY curvature/ ./curvature/

USER appuser

# Default command runs tests
CMD ["pytest", "-v", "--cov=api", "--cov-report=term-missing"]
