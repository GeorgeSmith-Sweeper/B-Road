#!/bin/bash

# prepare-osrm.sh
#
# Download and preprocess OSM data for OSRM routing engine.
# Supports any US state (Geofabrik naming) or a full US extract.
#
# Usage:
#   ./scripts/prepare-osrm.sh [region]
#
# Examples:
#   ./scripts/prepare-osrm.sh north-carolina    # Single state (default)
#   ./scripts/prepare-osrm.sh new-york           # Another state
#   ./scripts/prepare-osrm.sh us                 # Full US extract
#
# The script is idempotent — if OSRM files already exist, it skips processing.
# Use -f to force reprocessing.

set -e

# Configuration
REGION="${1:-north-carolina}"
FORCE=0

if [ "$1" = "-f" ]; then
  FORCE=1
  REGION="${2:-north-carolina}"
elif [ "$2" = "-f" ]; then
  FORCE=1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OSRM_DATA_DIR="$PROJECT_DIR/data/osrm"
OSRM_IMAGE="osrm/osrm-backend:v5.27.1"

# Determine download URL based on region
if [ "$REGION" = "us" ] || [ "$REGION" = "us-latest" ]; then
  REGION="us-latest"
  DOWNLOAD_URL="https://download.geofabrik.de/north-america/us-latest.osm.pbf"
  PBF_FILE="$OSRM_DATA_DIR/us-latest-latest.osm.pbf"
  OSRM_BASE="$OSRM_DATA_DIR/us-latest-latest"
else
  DOWNLOAD_URL="https://download.geofabrik.de/north-america/us/${REGION}-latest.osm.pbf"
  PBF_FILE="$OSRM_DATA_DIR/${REGION}-latest.osm.pbf"
  OSRM_BASE="$OSRM_DATA_DIR/${REGION}-latest"
fi

echo "=== OSRM Data Preparation ==="
echo "Region:    $REGION"
echo "Data dir:  $OSRM_DATA_DIR"
echo ""

# Check if already processed
if [ -f "${OSRM_BASE}.osrm" ] && [ "$FORCE" -eq 0 ]; then
  echo "OSRM data already exists at ${OSRM_BASE}.osrm"
  echo "Use -f flag to force reprocessing."
  echo "Done!"
  exit 0
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

# Step 2: Extract
echo ""
echo "Step 1/3: Extracting road network (this may take a while)..."
docker run --rm -t -v "$OSRM_DATA_DIR:/data" "$OSRM_IMAGE" \
  osrm-extract -p /opt/car.lua "/data/$(basename "$PBF_FILE")"

# Step 3: Partition
echo ""
echo "Step 2/3: Partitioning graph..."
docker run --rm -t -v "$OSRM_DATA_DIR:/data" "$OSRM_IMAGE" \
  osrm-partition "/data/$(basename "$OSRM_BASE").osrm"

# Step 4: Customize
echo ""
echo "Step 3/3: Customizing weights..."
docker run --rm -t -v "$OSRM_DATA_DIR:/data" "$OSRM_IMAGE" \
  osrm-customize "/data/$(basename "$OSRM_BASE").osrm"

echo ""
echo "=== OSRM data prepared successfully! ==="
echo ""
echo "To start OSRM:"
echo "  docker compose --profile routing up -d"
echo ""
echo "To test:"
echo "  curl 'http://localhost:5000/route/v1/driving/-80.8431,35.2271;-80.7933,35.2387?overview=full&geometries=geojson'"
