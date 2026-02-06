"""
Unit tests for CurvatureQueryBuilder.

Tests filter construction, validation, and parameter normalization
for the natural language search pipeline.
"""

import pytest

from api.services.query_builder import CurvatureQueryBuilder


class TestBuildFilters:
    """Tests for CurvatureQueryBuilder.build_filters()"""

    def test_no_parameters_returns_empty(self):
        """Should return empty dict when no parameters provided."""
        filters = CurvatureQueryBuilder.build_filters()
        assert filters == {}

    # --- Curvature filters ---

    def test_min_curvature(self):
        """Should include min_curvature when provided."""
        filters = CurvatureQueryBuilder.build_filters(min_curvature=1000)
        assert filters["min_curvature"] == 1000

    def test_max_curvature(self):
        """Should include max_curvature when provided."""
        filters = CurvatureQueryBuilder.build_filters(max_curvature=5000)
        assert filters["max_curvature"] == 5000

    def test_min_and_max_curvature(self):
        """Should include both curvature bounds."""
        filters = CurvatureQueryBuilder.build_filters(
            min_curvature=1000, max_curvature=5000
        )
        assert filters["min_curvature"] == 1000
        assert filters["max_curvature"] == 5000

    # --- Curvature levels ---

    @pytest.mark.parametrize(
        "level,expected_min,expected_max",
        [
            ("mild", 300, 600),
            ("moderate", 600, 1000),
            ("curvy", 1000, 2000),
            ("very_curvy", 2000, 5000),
            ("extreme", 5000, 10000),
        ],
    )
    def test_curvature_level_with_upper_bound(
        self, level, expected_min, expected_max
    ):
        """Should map curvature level to min/max range."""
        filters = CurvatureQueryBuilder.build_filters(curvature_level=level)
        assert filters["min_curvature"] == expected_min
        assert filters["max_curvature"] == expected_max

    def test_curvature_level_epic_no_upper_bound(self):
        """Epic level should have min but no max curvature."""
        filters = CurvatureQueryBuilder.build_filters(curvature_level="epic")
        assert filters["min_curvature"] == 10000
        assert "max_curvature" not in filters

    def test_curvature_level_overrides_explicit_values(self):
        """Curvature level should take precedence over explicit min/max."""
        filters = CurvatureQueryBuilder.build_filters(
            min_curvature=100,
            max_curvature=200,
            curvature_level="extreme",
        )
        assert filters["min_curvature"] == 5000
        assert filters["max_curvature"] == 10000

    def test_invalid_curvature_level_falls_through(self):
        """Unknown curvature level should fall through to explicit values."""
        filters = CurvatureQueryBuilder.build_filters(
            min_curvature=500,
            curvature_level="imaginary",
        )
        assert filters["min_curvature"] == 500

    def test_invalid_curvature_level_without_explicit(self):
        """Unknown curvature level with no explicit values returns empty."""
        filters = CurvatureQueryBuilder.build_filters(curvature_level="imaginary")
        assert filters == {}

    # --- Length filters ---

    def test_min_length_converts_miles_to_meters(self):
        """Should convert min_length from miles to meters."""
        filters = CurvatureQueryBuilder.build_filters(min_length=10)
        assert filters["min_length_meters"] == pytest.approx(16093.4, rel=1e-3)

    def test_max_length_converts_miles_to_meters(self):
        """Should convert max_length from miles to meters."""
        filters = CurvatureQueryBuilder.build_filters(max_length=5)
        assert filters["max_length_meters"] == pytest.approx(8046.7, rel=1e-3)

    def test_length_keys_are_meters(self):
        """Output keys should be min/max_length_meters, not miles."""
        filters = CurvatureQueryBuilder.build_filters(min_length=1, max_length=2)
        assert "min_length" not in filters
        assert "max_length" not in filters
        assert "min_length_meters" in filters
        assert "max_length_meters" in filters

    # --- Surface type normalization ---

    @pytest.mark.parametrize("surface", ["paved", "asphalt", "concrete"])
    def test_paved_surface_normalized(self, surface):
        """Paved-family surface types should normalize to 'paved'."""
        filters = CurvatureQueryBuilder.build_filters(surface_types=[surface])
        assert "paved" in filters["surface_types"]

    @pytest.mark.parametrize("surface", ["gravel", "unpaved", "dirt"])
    def test_unpaved_surface_normalized(self, surface):
        """Unpaved-family surface types should normalize to 'unpaved'."""
        filters = CurvatureQueryBuilder.build_filters(surface_types=[surface])
        assert "unpaved" in filters["surface_types"]

    def test_surface_deduplication(self):
        """Duplicate normalized surfaces should be deduplicated."""
        filters = CurvatureQueryBuilder.build_filters(
            surface_types=["paved", "asphalt", "concrete"]
        )
        assert filters["surface_types"] == ["paved"]

    def test_unknown_surface_passed_through(self):
        """Unknown surface types should be passed through as-is."""
        filters = CurvatureQueryBuilder.build_filters(surface_types=["cobblestone"])
        assert "cobblestone" in filters["surface_types"]

    def test_surface_case_insensitive(self):
        """Surface normalization should be case-insensitive."""
        filters = CurvatureQueryBuilder.build_filters(surface_types=["PAVED"])
        assert "paved" in filters["surface_types"]

    # --- Source normalization ---

    def test_sources_lowercased(self):
        """Source names should be lowercased."""
        filters = CurvatureQueryBuilder.build_filters(sources=["Vermont"])
        assert filters["sources"] == ["vermont"]

    def test_sources_spaces_to_underscores(self):
        """Spaces in source names should become underscores."""
        filters = CurvatureQueryBuilder.build_filters(sources=["New Hampshire"])
        assert filters["sources"] == ["new_hampshire"]

    def test_multiple_sources(self):
        """Should handle multiple source names."""
        filters = CurvatureQueryBuilder.build_filters(
            sources=["Vermont", "New Hampshire"]
        )
        assert filters["sources"] == ["vermont", "new_hampshire"]

    # --- Location ---

    def test_location_stored_as_is(self):
        """Location string should be stored unchanged."""
        filters = CurvatureQueryBuilder.build_filters(location="northeast")
        assert filters["location"] == "northeast"

    # --- Combined parameters ---

    def test_all_parameters(self):
        """Should correctly build filters with all parameters."""
        filters = CurvatureQueryBuilder.build_filters(
            min_curvature=1000,
            max_curvature=5000,
            min_length=5,
            max_length=20,
            surface_types=["paved"],
            sources=["Vermont"],
            location="mountains",
        )
        assert filters["min_curvature"] == 1000
        assert filters["max_curvature"] == 5000
        assert "min_length_meters" in filters
        assert "max_length_meters" in filters
        assert filters["surface_types"] == ["paved"]
        assert filters["sources"] == ["vermont"]
        assert filters["location"] == "mountains"


class TestGetDefaultFilters:
    """Tests for CurvatureQueryBuilder.get_default_filters()"""

    def test_returns_dict(self):
        """Should return a dictionary."""
        defaults = CurvatureQueryBuilder.get_default_filters()
        assert isinstance(defaults, dict)

    def test_includes_min_curvature(self):
        """Should include a default min_curvature."""
        defaults = CurvatureQueryBuilder.get_default_filters()
        assert "min_curvature" in defaults
        assert defaults["min_curvature"] == 300

    def test_includes_limit(self):
        """Should include a default limit."""
        defaults = CurvatureQueryBuilder.get_default_filters()
        assert "limit" in defaults
        assert defaults["limit"] == 20


class TestValidateFilters:
    """Tests for CurvatureQueryBuilder.validate_filters()"""

    def test_valid_filters_no_errors(self):
        """Valid filters should produce no errors."""
        errors = CurvatureQueryBuilder.validate_filters(
            {"min_curvature": 1000, "max_curvature": 5000}
        )
        assert errors == []

    def test_empty_filters_no_errors(self):
        """Empty filter dict should produce no errors."""
        errors = CurvatureQueryBuilder.validate_filters({})
        assert errors == []

    def test_negative_min_curvature(self):
        """Negative min_curvature should produce an error."""
        errors = CurvatureQueryBuilder.validate_filters({"min_curvature": -1})
        assert len(errors) == 1
        assert "min_curvature" in errors[0]

    def test_negative_max_curvature(self):
        """Negative max_curvature should produce an error."""
        errors = CurvatureQueryBuilder.validate_filters({"max_curvature": -1})
        assert len(errors) == 1
        assert "max_curvature" in errors[0]

    def test_min_exceeds_max_curvature(self):
        """min_curvature > max_curvature should produce an error."""
        errors = CurvatureQueryBuilder.validate_filters(
            {"min_curvature": 5000, "max_curvature": 1000}
        )
        assert any("cannot exceed" in e for e in errors)

    def test_negative_min_length(self):
        """Negative min_length_meters should produce an error."""
        errors = CurvatureQueryBuilder.validate_filters({"min_length_meters": -100})
        assert len(errors) == 1
        assert "min_length" in errors[0]

    def test_negative_max_length(self):
        """Negative max_length_meters should produce an error."""
        errors = CurvatureQueryBuilder.validate_filters({"max_length_meters": -100})
        assert len(errors) == 1
        assert "max_length" in errors[0]

    def test_multiple_errors(self):
        """Should return all validation errors, not just the first."""
        errors = CurvatureQueryBuilder.validate_filters(
            {"min_curvature": -1, "max_curvature": -1}
        )
        assert len(errors) == 2
