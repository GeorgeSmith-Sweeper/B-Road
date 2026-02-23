"""
Query builder for curvature road searches.

Builds SQL filters from structured parameters extracted from natural language queries.
"""

from typing import Dict, Any, Optional, List


class CurvatureQueryBuilder:
    """Builds SQL filters from structured search parameters."""

    # Curvature level thresholds for natural language interpretation
    CURVATURE_LEVELS = {
        "relaxed": (300, 600),
        "spirited": (600, 1000),
        "engaging": (1000, 2000),
        "technical": (2000, 5000),
        "expert": (5000, 10000),
        "legendary": (10000, None),  # No upper limit
    }

    @staticmethod
    def build_filters(
        min_curvature: Optional[int] = None,
        max_curvature: Optional[int] = None,
        min_length: Optional[float] = None,
        max_length: Optional[float] = None,
        surface_types: Optional[List[str]] = None,
        sources: Optional[List[str]] = None,
        location: Optional[str] = None,
        curvature_level: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Build a filter dictionary from search parameters.

        Args:
            min_curvature: Minimum curvature score (0-10000+)
            max_curvature: Maximum curvature score
            min_length: Minimum road length in miles
            max_length: Maximum road length in miles
            surface_types: List of surface types (paved, asphalt, gravel, etc.)
            sources: List of data sources (state names)
            location: General location string (for future geocoding)
            curvature_level: Natural language level (relaxed, spirited, engaging, technical, expert, legendary)

        Returns:
            Dictionary of filters for database query
        """
        filters: Dict[str, Any] = {}

        # Handle curvature level (overrides min/max if provided)
        if (
            curvature_level
            and curvature_level in CurvatureQueryBuilder.CURVATURE_LEVELS
        ):
            level_min, level_max = CurvatureQueryBuilder.CURVATURE_LEVELS[
                curvature_level
            ]
            filters["min_curvature"] = level_min
            if level_max:
                filters["max_curvature"] = level_max
        else:
            # Use explicit min/max values
            if min_curvature is not None:
                filters["min_curvature"] = min_curvature
            if max_curvature is not None:
                filters["max_curvature"] = max_curvature

        # Length filters (convert miles to meters for database)
        if min_length is not None:
            filters["min_length_meters"] = min_length * 1609.34
        if max_length is not None:
            filters["max_length_meters"] = max_length * 1609.34

        # Surface type filter
        if surface_types:
            # Normalize surface types
            normalized = []
            for surface in surface_types:
                surface_lower = surface.lower()
                if surface_lower in ("paved", "asphalt", "concrete"):
                    normalized.append("paved")
                elif surface_lower in ("gravel", "unpaved", "dirt"):
                    normalized.append("unpaved")
                else:
                    normalized.append(surface_lower)
            filters["surface_types"] = list(set(normalized))

        # Source filter (state names)
        if sources:
            # Normalize state names to lowercase
            filters["sources"] = [s.lower().replace(" ", "_") for s in sources]

        # Location (for future geocoding integration)
        if location:
            filters["location"] = location

        return filters

    @staticmethod
    def get_default_filters() -> Dict[str, Any]:
        """
        Get default filter values for a general search.

        Returns:
            Dictionary with sensible defaults
        """
        return {
            "min_curvature": 300,  # Minimum interesting curvature
            "limit": 20,
        }

    @staticmethod
    def validate_filters(filters: Dict[str, Any]) -> List[str]:
        """
        Validate filter values and return any errors.

        Args:
            filters: Filter dictionary to validate

        Returns:
            List of validation error messages (empty if valid)
        """
        errors = []

        if "min_curvature" in filters and filters["min_curvature"] < 0:
            errors.append("min_curvature must be non-negative")

        if "max_curvature" in filters and filters["max_curvature"] < 0:
            errors.append("max_curvature must be non-negative")

        if (
            "min_curvature" in filters
            and "max_curvature" in filters
            and filters["min_curvature"] > filters["max_curvature"]
        ):
            errors.append("min_curvature cannot exceed max_curvature")

        if "min_length_meters" in filters and filters["min_length_meters"] < 0:
            errors.append("min_length must be non-negative")

        if "max_length_meters" in filters and filters["max_length_meters"] < 0:
            errors.append("max_length must be non-negative")

        return errors
