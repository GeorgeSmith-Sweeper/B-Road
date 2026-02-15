#!/bin/bash

# cloud-osrm-extract.sh
#
# Self-contained script to run OSRM extraction on a cloud VM (e.g., AWS EC2).
# The full US extract requires ~60-100GB peak RAM during edge-expanded graph
# generation, which exceeds typical local machine/Docker Desktop limits.
#
# Uses Docker to run OSRM tools, which on Linux has full access to host RAM
# (unlike Docker Desktop on macOS). This also ensures the OSRM version matches
# the osrm/osrm-backend:latest image used locally, avoiding format mismatches.
#
# Prerequisites:
#   - Ubuntu 22.04 or 24.04 (tested on these)
#   - At least 64GB RAM (r6i.2xlarge or larger)
#   - At least 150GB disk space
#
# Usage:
#   1. Launch an EC2 instance:
#        Instance type: r6i.2xlarge (64GB RAM, ~$0.50/hr)
#        AMI: Ubuntu 24.04 LTS
#        Storage: 150GB gp3 root volume
#        Security group: SSH only (port 22)
#
#   2. Upload and run this script:
#        scp scripts/cloud-osrm-extract.sh ubuntu@<ip>:~/
#        ssh ubuntu@<ip>
#        chmod +x cloud-osrm-extract.sh
#        ./cloud-osrm-extract.sh
#
#   3. Download the output:
#        scp ubuntu@<ip>:/tmp/us-latest-osrm.tar.gz data/osrm/
#        cd data/osrm && tar xzf us-latest-osrm.tar.gz && rm us-latest-osrm.tar.gz
#
#   4. Terminate the instance:
#        aws ec2 terminate-instances --instance-ids <instance-id>
#
# Estimated time: 30-60 minutes total
# Estimated cost: ~$1-3 (1-2 hours of r6i.2xlarge + data transfer)

set -e

WORK_DIR="/tmp/osrm"
PBF_URL="https://download.geofabrik.de/north-america/us-latest.osm.pbf"
PBF_FILE="$WORK_DIR/us-latest.osm.pbf"
OUTPUT_TARBALL="/tmp/us-latest-osrm.tar.gz"
OSRM_IMAGE="osrm/osrm-backend:latest"

echo "=== Cloud OSRM Extract for Full US ==="
echo "Work directory: $WORK_DIR"
echo ""

# Step 1: Install Docker and wget
echo "Step 1/6: Installing Docker and wget..."
sudo apt-get update -qq
sudo apt-get install -y -qq docker.io wget
echo "Docker version: $(sudo docker --version)"
echo ""

# Pull the OSRM image
echo "Pulling OSRM Docker image..."
sudo docker pull "$OSRM_IMAGE"
echo ""

# Step 2: Download US PBF
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

if [ -f "$PBF_FILE" ]; then
  echo "Step 2/6: Using existing PBF file: $PBF_FILE"
else
  echo "Step 2/6: Downloading US PBF from Geofabrik (~11GB)..."
  wget -q --show-progress -O "$PBF_FILE" "$PBF_URL"
fi
echo "PBF size: $(du -h "$PBF_FILE" | cut -f1)"
echo ""

# Step 3: Extract (the memory-hungry step)
echo "Step 3/6: Extracting road network (this is the memory-intensive step)..."
echo "Started at: $(date)"
sudo docker run --rm -t -v "$WORK_DIR:/data" "$OSRM_IMAGE" \
  osrm-extract -p /opt/car.lua /data/us-latest.osm.pbf
echo "Extract completed at: $(date)"
echo ""

# Step 4: Partition
echo "Step 4/6: Partitioning graph..."
echo "Started at: $(date)"
sudo docker run --rm -t -v "$WORK_DIR:/data" "$OSRM_IMAGE" \
  osrm-partition /data/us-latest.osrm
echo "Partition completed at: $(date)"
echo ""

# Step 5: Customize
echo "Step 5/6: Customizing weights..."
echo "Started at: $(date)"
sudo docker run --rm -t -v "$WORK_DIR:/data" "$OSRM_IMAGE" \
  osrm-customize /data/us-latest.osrm
echo "Customize completed at: $(date)"
echo ""

# Remove PBF to save disk space before creating tarball
echo "Removing PBF to save space..."
rm -f "$PBF_FILE"

# Step 6: Create tarball
echo "Step 6/6: Creating compressed tarball..."
echo "Started at: $(date)"
tar czf "$OUTPUT_TARBALL" us-latest.osrm*
echo "Tarball completed at: $(date)"
echo ""

echo "=== Done! ==="
echo "Output: $OUTPUT_TARBALL"
echo "Size: $(du -h "$OUTPUT_TARBALL" | cut -f1)"
echo ""
echo "Next steps:"
echo "  1. Download: scp ubuntu@<this-ip>:$OUTPUT_TARBALL data/osrm/"
echo "  2. Extract:  cd data/osrm && tar xzf us-latest-osrm.tar.gz && rm us-latest-osrm.tar.gz"
echo "  3. Update:   Set OSRM_REGION=us in .env"
echo "  4. Restart:  docker compose --profile routing up -d"
echo "  5. Terminate this EC2 instance!"
