"""
Service for finding routes that maximize time on curvy paved roads.

Uses a corridor-based waypoint injection algorithm:
1. Get baseline OSRM route from start to end
2. Query high-curvature segments within a corridor around the baseline
3. Score and select the best segments
4. Order them as waypoints along the route direction
5. Route through them via OSRM
6. Validate detour ratio and trim if needed
"""

import json
import logging
from typing import List, Dict

from sqlalchemy.orm import Session

from api.models.routing import WaypointRequest, RouteGeometry
from api.models.curvy_routing import (
    CurvyRouteRequest,
    CurvyRouteResponse,
    CurvySegmentInfo,
)
from api.repositories.curvature_repository import CurvatureRepository
from api.services.osrm_service import OSRMService

logger = logging.getLogger(__name__)


class CurvyRouteService:
    """Finds routes that maximize curvy road usage via waypoint injection."""

    def __init__(self, db: Session, osrm_service: OSRMService):
        self.repo = CurvatureRepository(db)
        self.osrm = osrm_service

    async def find_curvy_route(self, request: CurvyRouteRequest) -> CurvyRouteResponse:
        """
        Find a route from start to end that maximizes curvy road usage.

        Args:
            request: Start/end points and algorithm options.

        Returns:
            CurvyRouteResponse with the curvy route and metadata.
        """
        options = request.options

        # Step 1: Baseline route
        baseline = await self.osrm.calculate_route([request.start, request.end])

        # Step 2: Query corridor for curvy segments
        baseline_geojson = json.dumps({
            "type": baseline.geometry.type,
            "coordinates": baseline.geometry.coordinates,
        })

        # Reduce corridor for very short routes
        corridor_width = options.corridor_width
        max_waypoints = options.max_waypoints
        if baseline.distance < 5000:
            corridor_width = min(corridor_width, 5000)
            max_waypoints = min(max_waypoints, 10)

        segments = self.repo.get_segments_in_corridor(
            route_geojson=baseline_geojson,
            buffer_meters=corridor_width,
            min_curvature=options.min_curvature,
            min_length=options.min_segment_length,
        )

        # No curvy segments found — return baseline
        if not segments:
            return self._build_response(
                route=baseline,
                baseline=baseline,
                curvy_segments=[],
                generated_waypoints=[],
                corridor_width=corridor_width,
            )

        # Step 3: Score segments
        scored = self._score_segments(segments, corridor_width)

        # Step 4: Select with constraints
        selected = self._select_segments(scored, max_waypoints)

        if not selected:
            return self._build_response(
                route=baseline,
                baseline=baseline,
                curvy_segments=[],
                generated_waypoints=[],
                corridor_width=corridor_width,
            )

        # Step 5: Order and build waypoints
        selected.sort(key=lambda s: s["route_position"])
        waypoint_list = self._build_waypoint_list(request, selected)

        # Step 6: Final OSRM route
        final_route = await self.osrm.calculate_route(waypoint_list)

        # Step 7: Detour validation
        curvy_infos = self._build_segment_infos(selected)
        detour_ratio = final_route.distance / baseline.distance if baseline.distance > 0 else 1.0

        if detour_ratio > options.max_detour_ratio:
            final_route, selected, waypoint_list, detour_ratio = await self._trim_for_detour(
                request=request,
                baseline=baseline,
                selected=selected,
                max_detour_ratio=options.max_detour_ratio,
                max_retries=3,
            )
            curvy_infos = self._build_segment_infos(selected)

        return self._build_response(
            route=final_route,
            baseline=baseline,
            curvy_segments=curvy_infos,
            generated_waypoints=waypoint_list,
            corridor_width=corridor_width,
        )

    def _score_segments(
        self, segments: List[Dict], corridor_width: int
    ) -> List[Dict]:
        """
        Score segments by curvature (50%), length (30%), and proximity (20%).

        Normalizes each dimension to 0-1 range before weighting.
        """
        if not segments:
            return []

        max_curvature = max(s["curvature"] for s in segments)
        max_length = max(s["length"] for s in segments)

        scored = []
        for seg in segments:
            curv_norm = seg["curvature"] / max_curvature if max_curvature > 0 else 0
            len_norm = seg["length"] / max_length if max_length > 0 else 0
            # Proximity: 1.0 when on the route, 0.0 at corridor edge
            prox_norm = max(0, 1.0 - (seg["distance_from_route"] / corridor_width))

            score = (curv_norm * 0.5) + (len_norm * 0.3) + (prox_norm * 0.2)

            scored.append({**seg, "score": score})

        scored.sort(key=lambda s: s["score"], reverse=True)
        return scored

    def _select_segments(
        self, scored: List[Dict], max_waypoints: int
    ) -> List[Dict]:
        """
        Select top segments, skipping those too close to already-selected ones.

        Two segments are considered too close if their route_position values
        differ by less than 0.03 (3% of the route length).
        """
        selected = []
        for seg in scored:
            if len(selected) >= max_waypoints:
                break
            # Check minimum spacing along the route
            too_close = any(
                abs(seg["route_position"] - s["route_position"]) < 0.03
                for s in selected
            )
            if not too_close:
                selected.append(seg)
        return selected

    def _build_waypoint_list(
        self, request: CurvyRouteRequest, selected: List[Dict]
    ) -> List[WaypointRequest]:
        """Build ordered waypoint list: start + segment centroids + end."""
        waypoints = [request.start]
        for seg in selected:
            waypoints.append(
                WaypointRequest(lng=seg["centroid_lng"], lat=seg["centroid_lat"])
            )
        waypoints.append(request.end)
        return waypoints

    def _build_segment_infos(self, selected: List[Dict]) -> List[CurvySegmentInfo]:
        """Convert selected segment dicts to CurvySegmentInfo models."""
        return [
            CurvySegmentInfo(
                id=seg["id"],
                name=seg.get("name"),
                curvature=seg["curvature"],
                length=int(seg["length"]),
                score=round(seg["score"], 3),
            )
            for seg in selected
        ]

    async def _trim_for_detour(
        self,
        request: CurvyRouteRequest,
        baseline,
        selected: List[Dict],
        max_detour_ratio: float,
        max_retries: int = 3,
    ):
        """
        Iteratively remove the lowest-scored segment until detour ratio is acceptable.

        Returns (final_route, remaining_selected, waypoint_list, detour_ratio).
        """
        remaining = list(selected)

        for _ in range(max_retries):
            if len(remaining) <= 1:
                break

            # Remove lowest-scored segment
            remaining.sort(key=lambda s: s["score"])
            remaining.pop(0)

            # Re-sort by route position for waypoint ordering
            remaining.sort(key=lambda s: s["route_position"])
            waypoint_list = self._build_waypoint_list(request, remaining)

            route = await self.osrm.calculate_route(waypoint_list)
            ratio = route.distance / baseline.distance if baseline.distance > 0 else 1.0

            if ratio <= max_detour_ratio:
                return route, remaining, waypoint_list, ratio

        # Last attempt: return whatever we have
        remaining.sort(key=lambda s: s["route_position"])
        waypoint_list = self._build_waypoint_list(request, remaining)
        route = await self.osrm.calculate_route(waypoint_list)
        ratio = route.distance / baseline.distance if baseline.distance > 0 else 1.0
        return route, remaining, waypoint_list, ratio

    def _build_response(
        self,
        route,
        baseline,
        curvy_segments: List[CurvySegmentInfo],
        generated_waypoints: List[WaypointRequest],
        corridor_width: int,
    ) -> CurvyRouteResponse:
        """Assemble the final response model."""
        detour_ratio = route.distance / baseline.distance if baseline.distance > 0 else 1.0

        return CurvyRouteResponse(
            geometry=route.geometry,
            distance=route.distance,
            duration=route.duration,
            baseline_distance=baseline.distance,
            baseline_duration=baseline.duration,
            detour_ratio=round(detour_ratio, 2),
            curvy_segments=curvy_segments,
            total_curvature_score=sum(s.curvature for s in curvy_segments),
            waypoints_used=len(curvy_segments),
            corridor_width=corridor_width,
            generated_waypoints=generated_waypoints,
        )
