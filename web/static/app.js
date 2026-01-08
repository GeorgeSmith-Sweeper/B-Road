/**
 * Curvature Web Interface
 * =======================
 * JavaScript to handle Google Maps integration and API communication
 */

// Global variables
let map;  // Google Maps object
let currentData = null;  // Stores the current GeoJSON data
let dataLayer = null;  // Google Maps Data Layer for displaying roads
let appConfig = null;  // Application configuration from backend

// Route stitching global variables
let currentMode = 'browse';  // 'browse' or 'stitch'
let selectedSegments = [];  // Array of clicked segments for building route
let routePolyline = null;  // Google Maps Polyline showing current route
let currentSession = null;  // Session UUID from backend
let segmentFeatures = {};  // Map of segment IDs to map features for selection

/**
 * Load configuration from backend and initialize Google Maps
 * This runs on page load
 */
async function loadConfigAndInitialize() {
    try {
        // Fetch configuration from backend
        const response = await fetch('/config');
        if (!response.ok) {
            throw new Error('Failed to load configuration');
        }

        appConfig = await response.json();
        console.log('Configuration loaded from backend');

        // Dynamically load Google Maps JavaScript API with proper async loading
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${appConfig.google_maps_api_key}&callback=initMap&loading=async`;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);

        console.log('Google Maps script loading...');
    } catch (error) {
        console.error('Error loading configuration:', error);
        alert('Failed to load map configuration. Please check that the server is running and configured correctly.');
    }
}

/**
 * Initialize Google Maps
 * This function is called automatically by Google Maps API when it loads
 * (callback is specified in the dynamically loaded script tag)
 */
function initMap() {
    // Create the map centered on Vermont (change to your preferred location)
    map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 44.0, lng: -72.7 },  // Vermont coordinates
        zoom: 8,
        // Optional: Use a map style that highlights roads
        mapTypeId: 'terrain'
    });

    // Create a data layer for displaying GeoJSON roads
    dataLayer = new google.maps.Data();
    dataLayer.setMap(map);

    // Style the roads based on their curvature score
    dataLayer.setStyle(function(feature) {
        const curvature = feature.getProperty('curvature');
        const color = getCurvatureColor(curvature);

        return {
            strokeColor: color,
            strokeWeight: 3,
            strokeOpacity: 0.8
        };
    });

    // Add click listener to show road details
    dataLayer.addListener('click', function(event) {
        showRoadDetails(event.feature);
    });

    console.log('Map initialized successfully');
}

/**
 * Get a color based on curvature score
 * Lower curvature = yellow, higher curvature = red
 */
function getCurvatureColor(curvature) {
    if (curvature < 600) {
        return '#FFC107';  // Yellow - mild curves
    } else if (curvature < 1000) {
        return '#FF9800';  // Orange - moderate curves
    } else if (curvature < 2000) {
        return '#F44336';  // Red - very curvy
    } else {
        return '#9C27B0';  // Purple - extremely curvy!
    }
}

/**
 * Get the CSS class for curvature badge
 */
function getCurvatureClass(curvature) {
    if (curvature < 600) return 'curvature-low';
    if (curvature < 1000) return 'curvature-medium';
    return 'curvature-high';
}

/**
 * Update the curvature slider label
 */
function updateCurvatureLabel() {
    const value = document.getElementById('min-curvature').value;
    document.getElementById('curvature-value').textContent = value;
}

/**
 * Load data from a msgpack file
 * Calls the API to load the specified file into memory
 */
async function loadData() {
    const filepath = document.getElementById('filepath').value;
    const statusDiv = document.getElementById('load-status');

    // Show loading state
    statusDiv.className = 'status loading';
    statusDiv.textContent = 'Loading data...';

    try {
        // Call the API to load data
        // fetch() is JavaScript's way of making HTTP requests
        const response = await fetch('/data/load?' + new URLSearchParams({
            filepath: filepath
        }), {
            method: 'POST'
        });

        // Check if request was successful
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Parse JSON response
        const data = await response.json();

        // Show success message
        statusDiv.className = 'status success';
        statusDiv.textContent = `✓ Loaded ${data.message}`;

        console.log('Data loaded:', data);

    } catch (error) {
        // Show error message
        statusDiv.className = 'status error';
        statusDiv.textContent = `✗ Error: ${error.message}`;
        console.error('Error loading data:', error);
    }
}

/**
 * Search for roads based on filter criteria
 * Calls the API and displays results on the map
 */
async function searchRoads() {
    const minCurvature = document.getElementById('min-curvature').value;
    const surface = document.getElementById('surface').value;
    const limit = document.getElementById('limit').value;
    const statusDiv = document.getElementById('search-status');

    // Show loading state
    statusDiv.className = 'status loading';
    statusDiv.textContent = 'Searching...';

    try {
        // Build query parameters
        const params = new URLSearchParams({
            min_curvature: minCurvature,
            limit: limit
        });

        // Add surface filter if selected
        if (surface) {
            params.append('surface', surface);
        }

        // Call the API
        const response = await fetch('/roads/geojson?' + params.toString());

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Search failed');
        }

        // Parse GeoJSON response
        const geojson = await response.json();
        currentData = geojson;

        // Display results on map
        displayRoadsOnMap(geojson);

        // Display results in sidebar list
        displayRoadsList(geojson);

        // Show success message
        statusDiv.className = 'status success';
        statusDiv.textContent = `✓ Found ${geojson.features.length} roads`;

        console.log('Search results:', geojson);

    } catch (error) {
        statusDiv.className = 'status error';
        statusDiv.textContent = `✗ Error: ${error.message}`;
        console.error('Error searching roads:', error);
    }
}

/**
 * Display roads on the Google Map
 * Takes a GeoJSON FeatureCollection and adds it to the map
 */
function displayRoadsOnMap(geojson) {
    // Clear existing roads from the map
    dataLayer.forEach(function(feature) {
        dataLayer.remove(feature);
    });

    // Add new roads
    dataLayer.addGeoJson(geojson);

    // Calculate bounds to fit all roads in view
    if (geojson.features && geojson.features.length > 0) {
        const bounds = new google.maps.LatLngBounds();

        dataLayer.forEach(function(feature) {
            feature.getGeometry().forEachLatLng(function(latLng) {
                bounds.extend(latLng);
            });
        });

        // Fit the map to show all roads
        map.fitBounds(bounds);
    }
}

/**
 * Display list of roads in the sidebar
 */
function displayRoadsList(geojson) {
    const countDiv = document.getElementById('results-count');
    const listDiv = document.getElementById('results-list');

    // Update count
    countDiv.textContent = `Showing ${geojson.features.length} roads`;

    // Clear existing list
    listDiv.innerHTML = '';

    // Sort roads by curvature (highest first)
    const sortedFeatures = geojson.features.sort((a, b) =>
        b.properties.curvature - a.properties.curvature
    );

    // Create list items
    sortedFeatures.forEach(feature => {
        const props = feature.properties;

        const item = document.createElement('div');
        item.className = 'road-item';
        item.onclick = () => zoomToRoad(feature);

        item.innerHTML = `
            <div class="road-name">${props.name}</div>
            <div class="road-stats">
                <span class="curvature-badge ${getCurvatureClass(props.curvature)}">
                    ${Math.round(props.curvature)}
                </span>
                ${props.length_mi.toFixed(1)} mi
                • ${props.surface}
            </div>
        `;

        listDiv.appendChild(item);
    });
}

/**
 * Zoom the map to show a specific road
 */
function zoomToRoad(feature) {
    const bounds = new google.maps.LatLngBounds();

    // Get all coordinates for this road
    const coords = feature.geometry.coordinates;
    coords.forEach(coord => {
        bounds.extend(new google.maps.LatLng(coord[1], coord[0]));
    });

    // Zoom to fit this road with some padding
    map.fitBounds(bounds);
    map.setZoom(Math.min(map.getZoom(), 13));  // Don't zoom in too much

    // Show road info
    showRoadDetails(feature);
}

/**
 * Show detailed information about a road
 * Opens an info window on the map
 */
function showRoadDetails(feature) {
    const props = feature.properties;

    // Create info window content
    const content = `
        <div style="max-width: 300px; font-family: sans-serif;">
            <h3 style="margin-top: 0; color: #2c3e50;">${props.name}</h3>
            <table style="width: 100%; font-size: 14px;">
                <tr>
                    <td style="padding: 4px; font-weight: 600;">Curvature:</td>
                    <td style="padding: 4px;">
                        <span class="curvature-badge ${getCurvatureClass(props.curvature)}">
                            ${Math.round(props.curvature)}
                        </span>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 4px; font-weight: 600;">Length:</td>
                    <td style="padding: 4px;">${props.length_mi.toFixed(2)} mi (${props.length_km.toFixed(2)} km)</td>
                </tr>
                <tr>
                    <td style="padding: 4px; font-weight: 600;">Surface:</td>
                    <td style="padding: 4px;">${props.surface}</td>
                </tr>
            </table>
        </div>
    `;

    // Get the center point of the road
    const coords = feature.geometry.coordinates;
    const midIndex = Math.floor(coords.length / 2);
    const center = new google.maps.LatLng(coords[midIndex][1], coords[midIndex][0]);

    // Create and show info window
    const infoWindow = new google.maps.InfoWindow({
        content: content,
        position: center
    });

    infoWindow.open(map);
}

// ============================================================================
// Route Stitching and Saving Functions
// ============================================================================

/**
 * Initialize or restore user session for route building
 */
async function initSession() {
    let sessionId = localStorage.getItem('curvature_session_id');

    if (!sessionId) {
        // Create new session
        try {
            const response = await fetch('/sessions/create', {
                method: 'POST'
            });

            if (!response.ok) {
                console.error('Failed to create session');
                return;
            }

            const data = await response.json();
            sessionId = data.session_id;
            localStorage.setItem('curvature_session_id', sessionId);
            currentSession = sessionId;
            console.log('New session created:', sessionId);

            // Load saved routes for this session
            loadSavedRoutes();
        } catch (error) {
            console.error('Error creating session:', error);
        }
    } else {
        currentSession = sessionId;
        console.log('Session restored:', sessionId);

        // Validate session and load saved routes
        loadSavedRoutes();
    }
}

/**
 * Switch between browse and stitch modes
 */
function switchMode(mode) {
    // Check if switching away from stitch mode with unsaved route
    if (currentMode === 'stitch' && selectedSegments.length > 0 && mode === 'browse') {
        if (!confirm('You have an unsaved route. Discard it?')) {
            return;
        }
    }

    currentMode = mode;

    // Update UI
    document.getElementById('browse-mode-btn').classList.toggle('active', mode === 'browse');
    document.getElementById('stitch-mode-btn').classList.toggle('active', mode === 'stitch');

    // Show/hide sections
    document.getElementById('route-builder').style.display = mode === 'stitch' ? 'block' : 'none';
    document.getElementById('search-filters').style.display = mode === 'browse' ? 'block' : 'none';
    document.getElementById('results-section').style.display = mode === 'browse' ? 'block' : 'none';

    if (mode === 'stitch') {
        // Clear browse mode data and load segments
        clearMap();
        console.log('Switched to stitch mode');
        // Note: User still needs to load data and search to see segments
    } else {
        // Clear stitch mode data
        clearRoute();
        clearMap();
        console.log('Switched to browse mode');
    }
}

/**
 * Clear all features from the map
 */
function clearMap() {
    dataLayer.forEach(function(feature) {
        dataLayer.remove(feature);
    });

    if (routePolyline) {
        routePolyline.setMap(null);
        routePolyline = null;
    }
}

/**
 * Check if two segments connect (share an endpoint)
 */
function segmentsConnect(seg1, seg2) {
    const tolerance = 0.00001;  // ~1 meter

    // Check if seg1.end connects to seg2.start (forward-forward)
    const forwardForward = (
        Math.abs(seg1.end[0] - seg2.start[0]) < tolerance &&
        Math.abs(seg1.end[1] - seg2.start[1]) < tolerance
    );

    // Check if seg1.end connects to seg2.end (forward-reverse)
    const forwardReverse = (
        Math.abs(seg1.end[0] - seg2.end[0]) < tolerance &&
        Math.abs(seg1.end[1] - seg2.end[1]) < tolerance
    );

    return forwardForward || forwardReverse;
}

/**
 * Update the visual display of the current route
 */
function updateRouteDisplay() {
    // Remove old polyline
    if (routePolyline) {
        routePolyline.setMap(null);
    }

    if (selectedSegments.length === 0) {
        return;
    }

    // Build path from all segments
    const path = [];
    selectedSegments.forEach((seg, idx) => {
        if (idx === 0) {
            path.push(new google.maps.LatLng(seg.start[0], seg.start[1]));
        }
        path.push(new google.maps.LatLng(seg.end[0], seg.end[1]));
    });

    // Create new polyline
    routePolyline = new google.maps.Polyline({
        path: path,
        strokeColor: '#00ff00',  // Green for current route
        strokeOpacity: 0.8,
        strokeWeight: 5,
        map: map
    });
}

/**
 * Update route statistics display
 */
function updateRouteStats() {
    const segmentCount = selectedSegments.length;
    const totalLength = selectedSegments.reduce((sum, seg) => sum + (seg.length || 0), 0);
    const totalCurvature = selectedSegments.reduce((sum, seg) => sum + (seg.curvature || 0), 0);

    document.getElementById('route-segment-count').textContent = segmentCount;
    document.getElementById('route-distance').textContent = (totalLength / 1609.34).toFixed(2);
    document.getElementById('route-curvature').textContent = Math.round(totalCurvature);
}

/**
 * Handle click on a road segment in stitch mode
 */
function handleSegmentClick(event) {
    if (currentMode !== 'stitch') {
        return;
    }

    const feature = event.feature;
    const segmentData = {
        id: feature.getId(),
        way_id: feature.getProperty('way_id'),
        start: feature.getProperty('start'),
        end: feature.getProperty('end'),
        length: feature.getProperty('length'),
        radius: feature.getProperty('radius'),
        curvature: feature.getProperty('curvature'),
        curvature_level: feature.getProperty('curvature_level'),
        name: feature.getProperty('name'),
        highway: feature.getProperty('highway'),
        surface: feature.getProperty('surface')
    };

    // Validate connection to previous segment
    if (selectedSegments.length > 0) {
        const lastSegment = selectedSegments[selectedSegments.length - 1];

        if (!segmentsConnect(lastSegment, segmentData)) {
            showStatus('route-status', 'error', 'Segments must connect! Click on an adjacent segment.');
            return;
        }
    }

    // Add to route
    selectedSegments.push(segmentData);
    feature.setProperty('selected', true);

    // Update route display
    updateRouteDisplay();
    updateRouteStats();

    console.log('Segment added:', segmentData);
}

/**
 * Clear the current route
 */
function clearRoute() {
    selectedSegments = [];

    if (routePolyline) {
        routePolyline.setMap(null);
        routePolyline = null;
    }

    // Deselect all features
    dataLayer.forEach(function(feature) {
        feature.setProperty('selected', false);
    });

    updateRouteStats();
    document.getElementById('route-name').value = '';
    document.getElementById('route-description').value = '';
}

/**
 * Undo last segment in route
 */
function undoLastSegment() {
    if (selectedSegments.length === 0) {
        return;
    }

    const removed = selectedSegments.pop();

    // Deselect in UI
    dataLayer.forEach(function(feature) {
        if (feature.getId() === removed.id) {
            feature.setProperty('selected', false);
        }
    });

    updateRouteDisplay();
    updateRouteStats();
}

/**
 * Save the current route to the database
 */
async function saveRoute() {
    if (!currentSession) {
        showStatus('route-status', 'error', 'No session. Please refresh the page.');
        return;
    }

    if (selectedSegments.length === 0) {
        showStatus('route-status', 'error', 'No segments selected. Build a route first.');
        return;
    }

    const routeName = document.getElementById('route-name').value.trim();
    if (!routeName) {
        showStatus('route-status', 'error', 'Please enter a route name.');
        return;
    }

    const description = document.getElementById('route-description').value.trim();

    showStatus('route-status', 'loading', 'Saving route...');

    try {
        const response = await fetch('/routes/save?session_id=' + currentSession, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                route_name: routeName,
                description: description,
                segments: selectedSegments,
                is_public: false
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to save route');
        }

        const data = await response.json();
        showStatus('route-status', 'success', `Route saved! URL: ${data.share_url}`);

        console.log('Route saved:', data);

        // Clear the route builder
        clearRoute();

        // Reload saved routes list
        loadSavedRoutes();

    } catch (error) {
        showStatus('route-status', 'error', `Error: ${error.message}`);
        console.error('Error saving route:', error);
    }
}

/**
 * Load saved routes for the current session
 */
async function loadSavedRoutes() {
    if (!currentSession) {
        return;
    }

    try {
        const response = await fetch('/routes/list?session_id=' + currentSession);

        if (!response.ok) {
            // Session might be invalid, create new one
            if (response.status === 404) {
                localStorage.removeItem('curvature_session_id');
                currentSession = null;
                initSession();
            }
            return;
        }

        const data = await response.json();
        displaySavedRoutes(data.routes);

    } catch (error) {
        console.error('Error loading saved routes:', error);
    }
}

/**
 * Display saved routes in the sidebar
 */
function displaySavedRoutes(routes) {
    const listDiv = document.getElementById('saved-routes-list');
    listDiv.innerHTML = '';

    if (routes.length === 0) {
        listDiv.innerHTML = '<p class="help-text">No saved routes yet</p>';
        return;
    }

    routes.forEach(route => {
        const item = document.createElement('div');
        item.className = 'road-item';

        item.innerHTML = `
            <div class="road-name">${route.route_name}</div>
            <div class="road-stats">
                <span class="curvature-badge ${getCurvatureClass(route.total_curvature)}">
                    ${Math.round(route.total_curvature)}
                </span>
                ${route.total_length_mi.toFixed(1)} mi
                • ${route.segment_count} segments
            </div>
            <div class="route-actions">
                <button onclick="viewRoute('${route.url_slug}')" class="btn-small">View</button>
                <button onclick="exportRoute('${route.url_slug}', 'kml')" class="btn-small">KML</button>
                <button onclick="exportRoute('${route.url_slug}', 'gpx')" class="btn-small">GPX</button>
                <button onclick="deleteRoute(${route.route_id})" class="btn-small btn-danger">Delete</button>
            </div>
        `;

        listDiv.appendChild(item);
    });
}

/**
 * View a saved route on the map
 */
async function viewRoute(urlSlug) {
    try {
        const response = await fetch('/routes/' + urlSlug);

        if (!response.ok) {
            throw new Error('Failed to load route');
        }

        const data = await response.json();

        // Clear map
        clearMap();

        // Display route on map
        dataLayer.addGeoJson(data.geojson);

        // Zoom to route
        const bounds = new google.maps.LatLngBounds();
        dataLayer.forEach(function(feature) {
            feature.getGeometry().forEachLatLng(function(latLng) {
                bounds.extend(latLng);
            });
        });
        map.fitBounds(bounds);

        console.log('Viewing route:', data.route_name);

    } catch (error) {
        console.error('Error viewing route:', error);
        alert('Failed to load route');
    }
}

/**
 * Export a route to KML or GPX
 */
function exportRoute(urlSlug, format) {
    const url = `/routes/${urlSlug}/export/${format}`;
    window.open(url, '_blank');
}

/**
 * Delete a saved route
 */
async function deleteRoute(routeId) {
    if (!confirm('Delete this route?')) {
        return;
    }

    if (!currentSession) {
        alert('No session');
        return;
    }

    try {
        const response = await fetch(`/routes/${routeId}?session_id=${currentSession}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Failed to delete route');
        }

        console.log('Route deleted:', routeId);

        // Reload saved routes list
        loadSavedRoutes();

    } catch (error) {
        console.error('Error deleting route:', error);
        alert('Failed to delete route');
    }
}

/**
 * Show status message in a specific div
 */
function showStatus(elementId, type, message) {
    const statusDiv = document.getElementById(elementId);
    statusDiv.className = `status ${type}`;
    statusDiv.textContent = message;
}

/**
 * Modify the data layer click listener to handle both modes
 */
function setupDataLayerClickListener() {
    dataLayer.addListener('click', function(event) {
        if (currentMode === 'stitch') {
            handleSegmentClick(event);
        } else {
            showRoadDetails(event.feature);
        }
    });
}

/**
 * Style function for segments that handles selection state
 */
function getSegmentStyle(feature) {
    const isSelected = feature.getProperty('selected');
    const curvature = feature.getProperty('curvature') || 0;
    const color = isSelected ? '#00ff00' : getCurvatureColor(curvature);
    const weight = isSelected ? 6 : 3;
    const opacity = isSelected ? 1.0 : 0.8;

    return {
        strokeColor: color,
        strokeWeight: weight,
        strokeOpacity: opacity,
        clickable: true
    };
}

/**
 * Override search function to handle both browse and stitch modes
 */
const originalSearchRoads = searchRoads;
async function searchRoadsWithMode() {
    if (currentMode === 'stitch') {
        // Load segments instead of collections
        await loadSegments();
    } else {
        // Use original search function
        await originalSearchRoads();
    }
}

/**
 * Load individual segments for stitching mode
 */
async function loadSegments() {
    const minCurvature = document.getElementById('min-curvature').value;
    const statusDiv = document.getElementById('search-status');

    showStatus('search-status', 'loading', 'Loading segments...');

    try {
        const params = new URLSearchParams({
            min_curvature: minCurvature,
            limit: 500
        });

        const response = await fetch('/roads/segments?' + params.toString());

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to load segments');
        }

        const geojson = await response.json();

        // Clear map
        clearMap();

        // Add segments
        dataLayer.addGeoJson(geojson);

        // Apply segment styling
        dataLayer.setStyle(getSegmentStyle);

        // Zoom to fit
        if (geojson.features && geojson.features.length > 0) {
            const bounds = new google.maps.LatLngBounds();
            dataLayer.forEach(function(feature) {
                feature.getGeometry().forEachLatLng(function(latLng) {
                    bounds.extend(latLng);
                });
            });
            map.fitBounds(bounds);
        }

        showStatus('search-status', 'success', `Loaded ${geojson.features.length} segments`);

        console.log('Segments loaded:', geojson.features.length);

    } catch (error) {
        showStatus('search-status', 'error', `Error: ${error.message}`);
        console.error('Error loading segments:', error);
    }
}

// Override the searchRoads function
searchRoads = searchRoadsWithMode;

/**
 * Initialize the interface when page loads
 */
window.addEventListener('load', function() {
    console.log('Curvature web interface loaded');
    updateCurvatureLabel();

    // Load configuration from backend and initialize Google Maps
    loadConfigAndInitialize();

    // Initialize session for route building
    initSession();
});
