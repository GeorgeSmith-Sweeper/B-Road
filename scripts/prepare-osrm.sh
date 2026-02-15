#!/bin/bash

# prepare-osrm.sh
#
# Download and preprocess OSM data for OSRM routing engine.
# Supports any US state (Geofabrik naming) or a full US extract.
#
# Usage:
#   ./scripts/prepare-osrm.sh [options] [region]
#
# Options:
#   -f          Force reprocessing even if OSRM files exist
#   --native    Use locally installed OSRM tools instead of Docker
#               (requires: brew install osrm-backend)
#
# Examples:
#   ./scripts/prepare-osrm.sh california           # Single state
#   ./scripts/prepare-osrm.sh us                   # Full US extract (Docker)
#   ./scripts/prepare-osrm.sh --native us          # Full US extract (native, recommended)
#   ./scripts/prepare-osrm.sh -f california        # Force reprocess California
#
# The script is idempotent — if OSRM files already exist, it skips processing.
# Use -f to force reprocessing.
#
# For large extracts (e.g., full US), use --native to avoid Docker memory limits.
# Native mode requires OSRM tools installed locally: brew install osrm-backend
#
# NOTE: The full US extract requires ~60-100GB peak RAM, which exceeds most local
# machines. Use scripts/cloud-osrm-extract.sh to run the extract on a cloud VM
# (e.g., AWS EC2 r6i.2xlarge with 64GB RAM, ~$1-3 total cost).

set -e

# Configuration
REGION=""
FORCE=0
NATIVE=0

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    -f)
      FORCE=1
      shift
      ;;
    --native)
      NATIVE=1
      shift
      ;;
    *)
      REGION="$1"
      shift
      ;;
  esac
done

REGION="${REGION:-california}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OSRM_DATA_DIR="$PROJECT_DIR/data/osrm"
OSRM_IMAGE="osrm/osrm-backend:latest"
DOCKER_PLATFORM="--platform linux/amd64"

# Determine download URL based on region
if [ "$REGION" = "us" ]; then
  DOWNLOAD_URL="https://download.geofabrik.de/north-america/us-latest.osm.pbf"
  PBF_FILE="$OSRM_DATA_DIR/us-latest.osm.pbf"
  OSRM_BASE="$OSRM_DATA_DIR/us-latest"
else
  DOWNLOAD_URL="https://download.geofabrik.de/north-america/us/${REGION}-latest.osm.pbf"
  PBF_FILE="$OSRM_DATA_DIR/${REGION}-latest.osm.pbf"
  OSRM_BASE="$OSRM_DATA_DIR/${REGION}-latest"
fi

echo "=== OSRM Data Preparation ==="
echo "Region:    $REGION"
echo "Data dir:  $OSRM_DATA_DIR"
echo "Mode:      $([ "$NATIVE" -eq 1 ] && echo 'native' || echo 'docker')"
echo ""

# Check if already processed
if [ -f "${OSRM_BASE}.osrm" ] && [ "$FORCE" -eq 0 ]; then
  echo "OSRM data already exists at ${OSRM_BASE}.osrm"
  echo "Use -f flag to force reprocessing."
  echo "Done!"
  exit 0
fi

# Verify native tools if --native mode
if [ "$NATIVE" -eq 1 ]; then
  for tool in osrm-extract osrm-partition osrm-customize; do
    if ! command -v "$tool" &> /dev/null; then
      echo "ERROR: $tool not found. Install with: brew install osrm-backend"
      exit 1
    fi
  done
  echo "Native OSRM tools found."
  echo ""
fi

# Create data directory
mkdir -p "$OSRM_DATA_DIR"

# Step 1: Download PBF file
if [ -f "$PBF_FILE" ]; then
  echo "Using existing PBF file: $PBF_FILE"
else
  echo "Downloading OSM data for $REGION..."
  echo "URL: $DOWNLOAD_URL"
  echo ""
  if ! wget -q --show-progress -O "$PBF_FILE" "$DOWNLOAD_URL"; then
    echo "ERROR: Failed to download $REGION"
    echo ""
    echo "Valid US state names (matching Geofabrik):"
    echo "  alabama, alaska, arizona, arkansas, california, colorado,"
    echo "  connecticut, delaware, florida, georgia, hawaii, idaho,"
    echo "  illinois, indiana, iowa, kansas, kentucky, louisiana,"
    echo "  maine, maryland, massachusetts, michigan, minnesota,"
    echo "  mississippi, missouri, montana, nebraska, nevada,"
    echo "  new-hampshire, new-jersey, new-mexico, new-york,"
    echo "  north-carolina, north-dakota, ohio, oklahoma, oregon,"
    echo "  pennsylvania, rhode-island, south-carolina, south-dakota,"
    echo "  tennessee, texas, utah, vermont, virginia, washington,"
    echo "  west-virginia, wisconsin, wyoming"
    echo ""
    echo "For full US: ./scripts/prepare-osrm.sh us"
    rm -f "$PBF_FILE"
    exit 1
  fi
  echo "Download complete."
fi

PBF_BASENAME="$(basename "$PBF_FILE")"
OSRM_BASENAME="$(basename "$OSRM_BASE").osrm"

# Step 2: Extract
echo ""
echo "Step 1/3: Extracting road network (this may take a while)..."
if [ "$NATIVE" -eq 1 ]; then
  # Find car.lua profile - check both Apple Silicon and Intel Homebrew paths
  CAR_PROFILE=""
  for p in /opt/homebrew/opt/osrm-backend/share/osrm/profiles/car.lua \
           /usr/local/opt/osrm-backend/share/osrm/profiles/car.lua \
           /usr/local/share/osrm/profiles/car.lua; do
    if [ -f "$p" ]; then
      CAR_PROFILE="$p"
      break
    fi
  done
  if [ -z "$CAR_PROFILE" ]; then
    echo "ERROR: Could not find car.lua profile. Check your osrm-backend installation."
    exit 1
  fi
  osrm-extract -p "$CAR_PROFILE" "$PBF_FILE"
else
  docker run --rm -t $DOCKER_PLATFORM -v "$OSRM_DATA_DIR:/data" "$OSRM_IMAGE" \
    osrm-extract -p /opt/car.lua "/data/$PBF_BASENAME"
fi

# Step 3: Partition
echo ""
echo "Step 2/3: Partitioning graph..."
if [ "$NATIVE" -eq 1 ]; then
  osrm-partition "${OSRM_BASE}.osrm"
else
  docker run --rm -t $DOCKER_PLATFORM -v "$OSRM_DATA_DIR:/data" "$OSRM_IMAGE" \
    osrm-partition "/data/$OSRM_BASENAME"
fi

# Step 4: Customize
echo ""
echo "Step 3/3: Customizing weights..."
if [ "$NATIVE" -eq 1 ]; then
  osrm-customize "${OSRM_BASE}.osrm"
else
  docker run --rm -t $DOCKER_PLATFORM -v "$OSRM_DATA_DIR:/data" "$OSRM_IMAGE" \
    osrm-customize "/data/$OSRM_BASENAME"
fi

echo ""
echo "=== OSRM data prepared successfully! ==="
echo ""
echo "To start OSRM:"
echo "  OSRM_REGION=$REGION docker compose --profile routing up -d"
echo ""
echo "To test (example for California):"
echo "  curl 'http://localhost:5001/route/v1/driving/-118.2437,34.0522;-117.1611,32.7157?overview=full&geometries=geojson'"
