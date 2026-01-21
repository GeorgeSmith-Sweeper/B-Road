#!/bin/bash

# process_us_states.sh
#
# Batch process all 50 US states through the curvature processing pipeline.
# Downloads OSM data from Geofabrik and loads into PostGIS.
#
# Usage:
#   ./scripts/process_us_states.sh [options]
#
# Options:
#   -d DATABASE   Database name (default: curvature)
#   -u USER       Database user (default: postgres)
#   -p PASSWORD   Database password (required)
#   -H HOST       Database host (default: localhost)
#   -s STATE      Process only this state (for testing)
#   -r            Resume from last failed state
#   -k            Keep downloaded PBF files (don't delete after processing)
#   -v            Verbose mode
#   -h            Show help
#
# The script tracks progress in data/osm/processing_status.txt

set -e

# Configuration defaults
DATABASE="curvature"
USER="postgres"
PASSWORD=""
HOST="localhost"
DATA_DIR="data/osm"
SINGLE_STATE=""
RESUME=0
KEEP_FILES=0
VERBOSE=""

# All 50 US states (matching Geofabrik naming)
STATES=(
  "alabama"
  "alaska"
  "arizona"
  "arkansas"
  "california"
  "colorado"
  "connecticut"
  "delaware"
  "florida"
  "georgia"
  "hawaii"
  "idaho"
  "illinois"
  "indiana"
  "iowa"
  "kansas"
  "kentucky"
  "louisiana"
  "maine"
  "maryland"
  "massachusetts"
  "michigan"
  "minnesota"
  "mississippi"
  "missouri"
  "montana"
  "nebraska"
  "nevada"
  "new-hampshire"
  "new-jersey"
  "new-mexico"
  "new-york"
  "north-carolina"
  "north-dakota"
  "ohio"
  "oklahoma"
  "oregon"
  "pennsylvania"
  "rhode-island"
  "south-carolina"
  "south-dakota"
  "tennessee"
  "texas"
  "utah"
  "vermont"
  "virginia"
  "washington"
  "west-virginia"
  "wisconsin"
  "wyoming"
)

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
STATUS_FILE="$PROJECT_DIR/$DATA_DIR/processing_status.txt"
LOG_FILE="$PROJECT_DIR/$DATA_DIR/processing.log"

# Parse command line options
while getopts "d:u:p:H:s:rkvh" opt; do
  case $opt in
    d) DATABASE="$OPTARG" ;;
    u) USER="$OPTARG" ;;
    p) PASSWORD="$OPTARG" ;;
    H) HOST="$OPTARG" ;;
    s) SINGLE_STATE="$OPTARG" ;;
    r) RESUME=1 ;;
    k) KEEP_FILES=1 ;;
    v) VERBOSE="-v" ;;
    h)
      echo "Usage: $0 [options]"
      echo "Options:"
      echo "  -d DATABASE   Database name (default: curvature)"
      echo "  -u USER       Database user (default: postgres)"
      echo "  -p PASSWORD   Database password (required)"
      echo "  -H HOST       Database host (default: localhost)"
      echo "  -s STATE      Process only this state (for testing)"
      echo "  -r            Resume from last failed state"
      echo "  -k            Keep downloaded PBF files"
      echo "  -v            Verbose mode"
      echo "  -h            Show help"
      exit 0
      ;;
    \?)
      echo "Invalid option: -$OPTARG" >&2
      exit 1
      ;;
  esac
done

# Validate password
if [ -z "$PASSWORD" ]; then
  echo "Error: Database password is required (-p PASSWORD)" >&2
  exit 1
fi

# Create data directory if it doesn't exist
mkdir -p "$PROJECT_DIR/$DATA_DIR"

# Initialize log file
echo "=== Processing started at $(date) ===" >> "$LOG_FILE"

# Function to log messages
log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
  echo "$msg" | tee -a "$LOG_FILE"
}

# Function to mark state status
mark_status() {
  local state=$1
  local status=$2
  # Remove old status for this state
  if [ -f "$STATUS_FILE" ]; then
    grep -v "^$state:" "$STATUS_FILE" > "$STATUS_FILE.tmp" 2>/dev/null || true
    mv "$STATUS_FILE.tmp" "$STATUS_FILE"
  fi
  # Add new status
  echo "$state:$status:$(date '+%Y-%m-%d %H:%M:%S')" >> "$STATUS_FILE"
}

# Function to get state status
get_status() {
  local state=$1
  if [ -f "$STATUS_FILE" ]; then
    grep "^$state:" "$STATUS_FILE" | tail -1 | cut -d: -f2
  else
    echo "pending"
  fi
}

# Function to download state data
download_state() {
  local state=$1
  local url="https://download.geofabrik.de/north-america/us/${state}-latest.osm.pbf"
  local output="$PROJECT_DIR/$DATA_DIR/${state}-latest.osm.pbf"

  if [ -f "$output" ]; then
    log "Using existing file: $output"
    return 0
  fi

  log "Downloading $state from Geofabrik..."
  if wget -q --show-progress -O "$output" "$url"; then
    log "Downloaded: $output"
    return 0
  else
    log "ERROR: Failed to download $state"
    rm -f "$output"
    return 1
  fi
}

# Function to process a single state
process_state() {
  local state=$1
  local pbf_file="$PROJECT_DIR/$DATA_DIR/${state}-latest.osm.pbf"

  log "Processing $state..."
  mark_status "$state" "processing"

  # Download if needed
  if ! download_state "$state"; then
    mark_status "$state" "download_failed"
    return 1
  fi

  # Process through curvature pipeline
  log "Running curvature processing for $state..."
  if "$PROJECT_DIR/processing_chains/to_postgis.sh" \
    $VERBOSE \
    -C \
    -H "$HOST" \
    -D "$DATABASE" \
    -U "$USER" \
    -P "$PASSWORD" \
    -S "$state" \
    "$pbf_file"; then

    mark_status "$state" "completed"
    log "SUCCESS: $state processed successfully"

    # Clean up PBF file unless -k flag is set
    if [ $KEEP_FILES -eq 0 ]; then
      rm -f "$pbf_file"
      log "Cleaned up: $pbf_file"
    fi

    return 0
  else
    mark_status "$state" "processing_failed"
    log "ERROR: Failed to process $state"
    return 1
  fi
}

# Function to find resume point
find_resume_point() {
  if [ ! -f "$STATUS_FILE" ]; then
    echo 0
    return
  fi

  local idx=0
  for state in "${STATES[@]}"; do
    local status=$(get_status "$state")
    if [ "$status" != "completed" ]; then
      echo $idx
      return
    fi
    ((idx++))
  done
  echo ${#STATES[@]}
}

# Main processing logic
main() {
  local start_idx=0
  local processed=0
  local failed=0

  # Handle single state mode
  if [ -n "$SINGLE_STATE" ]; then
    log "Single state mode: processing $SINGLE_STATE only"
    if process_state "$SINGLE_STATE"; then
      log "Completed processing $SINGLE_STATE"
    else
      log "Failed to process $SINGLE_STATE"
      exit 1
    fi
    exit 0
  fi

  # Handle resume mode
  if [ $RESUME -eq 1 ]; then
    start_idx=$(find_resume_point)
    if [ $start_idx -ge ${#STATES[@]} ]; then
      log "All states already processed!"
      exit 0
    fi
    log "Resuming from state: ${STATES[$start_idx]}"
  fi

  # Process states
  log "Starting batch processing of ${#STATES[@]} states (starting at index $start_idx)"

  for ((i=start_idx; i<${#STATES[@]}; i++)); do
    local state="${STATES[$i]}"
    local status=$(get_status "$state")

    # Skip completed states unless not in resume mode
    if [ "$status" = "completed" ] && [ $RESUME -eq 0 ]; then
      log "Skipping $state (already completed)"
      continue
    fi

    log "=== Processing ${state} (${i}/${#STATES[@]}) ==="

    if process_state "$state"; then
      ((processed++))
    else
      ((failed++))
      log "WARNING: Continuing to next state after failure"
    fi

    # Small delay between states to be nice to Geofabrik
    sleep 2
  done

  # Summary
  log "=== Processing complete ==="
  log "Processed: $processed"
  log "Failed: $failed"

  if [ $failed -gt 0 ]; then
    log "Some states failed. Use -r to resume processing."
    exit 1
  fi
}

# Run main function
main
