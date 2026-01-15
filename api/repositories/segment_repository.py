"""
Repository for RouteSegment database operations.
"""

from typing import List
from sqlalchemy.orm import Session

from api.models.orm import RouteSegment
from api.repositories.base import BaseRepository


class SegmentRepository(BaseRepository[RouteSegment]):
    """Repository for segment operations."""

    def __init__(self, db: Session):
        super().__init__(RouteSegment, db)

    def get_by_route(self, route_id: int) -> List[RouteSegment]:
        """Get all segments for a route, ordered by position"""
        return (
            self.db.query(RouteSegment)
            .filter_by(route_id=route_id)
            .order_by(RouteSegment.position)
            .all()
        )

    def create_segments(self, segments: List[RouteSegment]) -> List[RouteSegment]:
        """Bulk create segments"""
        self.db.add_all(segments)
        self.db.flush()
        return segments
