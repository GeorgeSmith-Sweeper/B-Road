"""
Unit tests for ClaudeService.

Tests AI integration with mocked Anthropic client to avoid
real API calls during testing.
"""

import json
import os
import pytest
from unittest.mock import patch, MagicMock

from api.services.claude_service import (
    ClaudeService,
    FILTER_EXTRACTION_PROMPT,
    RESPONSE_GENERATION_PROMPT,
)


class TestClaudeServiceInit:
    """Tests for ClaudeService initialization."""

    def test_raises_without_api_key(self):
        """Should raise ValueError when ANTHROPIC_API_KEY is not set."""
        with patch.dict(os.environ, {}, clear=True):
            # Ensure the key is removed
            os.environ.pop("ANTHROPIC_API_KEY", None)
            with pytest.raises(ValueError, match="ANTHROPIC_API_KEY"):
                ClaudeService()

    @patch("api.services.claude_service.anthropic.Anthropic")
    def test_creates_client_with_key(self, mock_anthropic):
        """Should create Anthropic client when API key is set."""
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key-123"}):
            service = ClaudeService()
            mock_anthropic.assert_called_once_with(api_key="test-key-123")
            assert service.model == "claude-sonnet-4-20250514"


class TestIsAvailable:
    """Tests for ClaudeService.is_available()"""

    @patch("api.services.claude_service.anthropic.Anthropic")
    def test_available_when_key_set(self, mock_anthropic):
        """Should return True when API key is set."""
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key-123"}):
            service = ClaudeService()
            assert service.is_available() is True

    @patch("api.services.claude_service.anthropic.Anthropic")
    def test_not_available_when_key_removed(self, mock_anthropic):
        """Should return False when API key is absent."""
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key-123"}):
            service = ClaudeService()

        # Now remove the key after construction
        with patch.dict(os.environ, {}, clear=True):
            os.environ.pop("ANTHROPIC_API_KEY", None)
            assert service.is_available() is False


class TestSendMessage:
    """Tests for ClaudeService.send_message()"""

    @patch("api.services.claude_service.anthropic.Anthropic")
    @pytest.mark.asyncio
    async def test_returns_response_text(self, mock_anthropic_cls):
        """Should return the text content from Claude's response."""
        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client

        # Mock the API response
        mock_content = MagicMock()
        mock_content.text = "Hello! I'm Claude."
        mock_response = MagicMock()
        mock_response.content = [mock_content]
        mock_client.messages.create.return_value = mock_response

        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"}):
            service = ClaudeService()
            result = await service.send_message("Hello")

        assert result == "Hello! I'm Claude."
        mock_client.messages.create.assert_called_once_with(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=[{"role": "user", "content": "Hello"}],
        )

    @patch("api.services.claude_service.anthropic.Anthropic")
    @pytest.mark.asyncio
    async def test_custom_max_tokens(self, mock_anthropic_cls):
        """Should pass custom max_tokens to API."""
        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client

        mock_content = MagicMock()
        mock_content.text = "response"
        mock_response = MagicMock()
        mock_response.content = [mock_content]
        mock_client.messages.create.return_value = mock_response

        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"}):
            service = ClaudeService()
            await service.send_message("Hello", max_tokens=256)

        call_kwargs = mock_client.messages.create.call_args[1]
        assert call_kwargs["max_tokens"] == 256

    @patch("api.services.claude_service.anthropic.Anthropic")
    @pytest.mark.asyncio
    async def test_raises_on_api_error(self, mock_anthropic_cls):
        """Should re-raise anthropic API errors."""
        import anthropic

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.side_effect = anthropic.APIError(
            message="Rate limited",
            request=MagicMock(),
            body=None,
        )

        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"}):
            service = ClaudeService()
            with pytest.raises(anthropic.APIError):
                await service.send_message("Hello")


class TestExtractFilters:
    """Tests for ClaudeService.extract_filters()"""

    def _make_service_with_mock(self, response_text):
        """Helper to create a ClaudeService with a mocked API response."""
        mock_client = MagicMock()
        mock_content = MagicMock()
        mock_content.text = response_text
        mock_response = MagicMock()
        mock_response.content = [mock_content]
        mock_client.messages.create.return_value = mock_response
        return mock_client

    @patch("api.services.claude_service.anthropic.Anthropic")
    @pytest.mark.asyncio
    async def test_extracts_valid_json(self, mock_anthropic_cls):
        """Should parse valid JSON filter response."""
        response = json.dumps({"min_curvature": 1000, "sources": ["vermont"]})
        mock_client = self._make_service_with_mock(response)
        mock_anthropic_cls.return_value = mock_client

        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"}):
            service = ClaudeService()
            filters = await service.extract_filters("Find curvy roads in Vermont")

        assert filters == {"min_curvature": 1000, "sources": ["vermont"]}

    @patch("api.services.claude_service.anthropic.Anthropic")
    @pytest.mark.asyncio
    async def test_uses_system_prompt(self, mock_anthropic_cls):
        """Should pass the filter extraction system prompt."""
        mock_client = self._make_service_with_mock('{"min_curvature": 1000}')
        mock_anthropic_cls.return_value = mock_client

        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"}):
            service = ClaudeService()
            await service.extract_filters("Find curvy roads")

        call_kwargs = mock_client.messages.create.call_args[1]
        assert call_kwargs["system"] == FILTER_EXTRACTION_PROMPT

    @patch("api.services.claude_service.anthropic.Anthropic")
    @pytest.mark.asyncio
    async def test_handles_markdown_code_block(self, mock_anthropic_cls):
        """Should extract JSON from markdown code blocks."""
        response = '```json\n{"min_curvature": 2000}\n```'
        mock_client = self._make_service_with_mock(response)
        mock_anthropic_cls.return_value = mock_client

        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"}):
            service = ClaudeService()
            filters = await service.extract_filters("Find very curvy roads")

        assert filters == {"min_curvature": 2000}

    @patch("api.services.claude_service.anthropic.Anthropic")
    @pytest.mark.asyncio
    async def test_handles_plain_code_block(self, mock_anthropic_cls):
        """Should extract JSON from plain code blocks (no language tag)."""
        response = '```\n{"min_curvature": 3000}\n```'
        mock_client = self._make_service_with_mock(response)
        mock_anthropic_cls.return_value = mock_client

        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"}):
            service = ClaudeService()
            filters = await service.extract_filters("Find very curvy roads")

        assert filters == {"min_curvature": 3000}

    @patch("api.services.claude_service.anthropic.Anthropic")
    @pytest.mark.asyncio
    async def test_returns_empty_for_invalid_json(self, mock_anthropic_cls):
        """Should return empty dict when Claude returns invalid JSON."""
        mock_client = self._make_service_with_mock("This is not JSON at all")
        mock_anthropic_cls.return_value = mock_client

        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"}):
            service = ClaudeService()
            filters = await service.extract_filters("something weird")

        assert filters == {}

    @patch("api.services.claude_service.anthropic.Anthropic")
    @pytest.mark.asyncio
    async def test_returns_empty_for_non_dict_response(self, mock_anthropic_cls):
        """Should return empty dict when Claude returns a JSON array or primitive."""
        mock_client = self._make_service_with_mock("[1, 2, 3]")
        mock_anthropic_cls.return_value = mock_client

        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"}):
            service = ClaudeService()
            filters = await service.extract_filters("something")

        assert filters == {}

    @patch("api.services.claude_service.anthropic.Anthropic")
    @pytest.mark.asyncio
    async def test_returns_empty_dict_for_string_response(self, mock_anthropic_cls):
        """Should return empty dict when Claude returns a JSON string."""
        mock_client = self._make_service_with_mock('"just a string"')
        mock_anthropic_cls.return_value = mock_client

        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"}):
            service = ClaudeService()
            filters = await service.extract_filters("something")

        assert filters == {}

    @patch("api.services.claude_service.anthropic.Anthropic")
    @pytest.mark.asyncio
    async def test_handles_whitespace_in_response(self, mock_anthropic_cls):
        """Should strip whitespace from response before parsing."""
        response = '  \n  {"min_curvature": 1000}  \n  '
        mock_client = self._make_service_with_mock(response)
        mock_anthropic_cls.return_value = mock_client

        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"}):
            service = ClaudeService()
            filters = await service.extract_filters("Find curvy roads")

        assert filters == {"min_curvature": 1000}

    @patch("api.services.claude_service.anthropic.Anthropic")
    @pytest.mark.asyncio
    async def test_raises_on_api_error(self, mock_anthropic_cls):
        """Should re-raise API errors from extract_filters."""
        import anthropic

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.side_effect = anthropic.APIError(
            message="Service unavailable",
            request=MagicMock(),
            body=None,
        )

        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"}):
            service = ClaudeService()
            with pytest.raises(anthropic.APIError):
                await service.extract_filters("Find roads")

    @patch("api.services.claude_service.anthropic.Anthropic")
    @pytest.mark.asyncio
    async def test_complex_filter_response(self, mock_anthropic_cls):
        """Should handle a response with multiple filter types."""
        response = json.dumps(
            {
                "min_curvature": 5000,
                "max_length": 5,
                "surface_types": ["paved"],
                "sources": ["new_hampshire"],
            }
        )
        mock_client = self._make_service_with_mock(response)
        mock_anthropic_cls.return_value = mock_client

        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"}):
            service = ClaudeService()
            filters = await service.extract_filters(
                "Short, super twisty paved roads in NH"
            )

        assert filters["min_curvature"] == 5000
        assert filters["max_length"] == 5
        assert filters["surface_types"] == ["paved"]
        assert filters["sources"] == ["new_hampshire"]

    @patch("api.services.claude_service.anthropic.Anthropic")
    @pytest.mark.asyncio
    async def test_empty_json_object(self, mock_anthropic_cls):
        """Should handle empty JSON object (no filters extracted)."""
        mock_client = self._make_service_with_mock("{}")
        mock_anthropic_cls.return_value = mock_client

        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"}):
            service = ClaudeService()
            filters = await service.extract_filters("Tell me about roads")

        assert filters == {}

    @patch("api.services.claude_service.anthropic.Anthropic")
    @pytest.mark.asyncio
    async def test_extract_filters_with_history(self, mock_anthropic_cls):
        """Should prepend history to messages when provided."""
        mock_client = self._make_service_with_mock(
            '{"min_curvature": 1000, "max_length": 5}'
        )
        mock_anthropic_cls.return_value = mock_client

        history = [
            {"role": "user", "content": "Find curvy roads in Vermont"},
            {"role": "assistant", "content": "Found 5 roads..."},
        ]

        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"}):
            service = ClaudeService()
            await service.extract_filters("Show me shorter ones", history=history)

        call_kwargs = mock_client.messages.create.call_args[1]
        messages = call_kwargs["messages"]
        assert len(messages) == 3
        assert messages[0] == {"role": "user", "content": "Find curvy roads in Vermont"}
        assert messages[1] == {"role": "assistant", "content": "Found 5 roads..."}
        assert messages[2] == {"role": "user", "content": "Show me shorter ones"}

    @patch("api.services.claude_service.anthropic.Anthropic")
    @pytest.mark.asyncio
    async def test_extract_filters_without_history(self, mock_anthropic_cls):
        """Should send only the user query when no history is provided."""
        mock_client = self._make_service_with_mock('{"min_curvature": 1000}')
        mock_anthropic_cls.return_value = mock_client

        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"}):
            service = ClaudeService()
            await service.extract_filters("Find curvy roads")

        call_kwargs = mock_client.messages.create.call_args[1]
        messages = call_kwargs["messages"]
        assert len(messages) == 1
        assert messages[0] == {"role": "user", "content": "Find curvy roads"}


class TestGenerateResponse:
    """Tests for ClaudeService.generate_response()"""

    def _make_mock_client(self, response_text):
        """Helper to create a mock client with a preset response."""
        mock_client = MagicMock()
        mock_content = MagicMock()
        mock_content.text = response_text
        mock_response = MagicMock()
        mock_response.content = [mock_content]
        mock_client.messages.create.return_value = mock_response
        return mock_client

    def _make_search_results(self, features=None):
        """Helper to create mock search results."""
        if features is None:
            features = [
                {
                    "type": "Feature",
                    "geometry": {"type": "LineString", "coordinates": [[0, 0], [1, 1]]},
                    "properties": {
                        "id": 1,
                        "name": "Mountain Pass Rd",
                        "curvature": 5000,
                        "length_mi": 12.5,
                        "source": "vermont",
                        "surface": "paved",
                    },
                }
            ]
        return {
            "type": "FeatureCollection",
            "features": features,
            "metadata": {"count": len(features)},
        }

    @patch("api.services.claude_service.anthropic.Anthropic")
    @pytest.mark.asyncio
    async def test_generates_response_with_results(self, mock_anthropic_cls):
        """Should generate a conversational response from search results."""
        mock_client = self._make_mock_client(
            "Great news! Mountain Pass Rd in Vermont is an incredible drive."
        )
        mock_anthropic_cls.return_value = mock_client

        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"}):
            service = ClaudeService()
            result = await service.generate_response(
                "Find curvy roads in Vermont", self._make_search_results()
            )

        assert "Mountain Pass Rd" in result
        mock_client.messages.create.assert_called_once()

    @patch("api.services.claude_service.anthropic.Anthropic")
    @pytest.mark.asyncio
    async def test_handles_empty_results(self, mock_anthropic_cls):
        """Should handle empty search results gracefully."""
        mock_client = self._make_mock_client(
            "No roads found. Try broadening your search."
        )
        mock_anthropic_cls.return_value = mock_client

        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"}):
            service = ClaudeService()
            result = await service.generate_response(
                "Find roads", self._make_search_results(features=[])
            )

        assert "No roads" in result

    @patch("api.services.claude_service.anthropic.Anthropic")
    @pytest.mark.asyncio
    async def test_strips_geometry_from_context(self, mock_anthropic_cls):
        """Should send only properties to Claude, not geometry data."""
        mock_client = self._make_mock_client("Great roads!")
        mock_anthropic_cls.return_value = mock_client

        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"}):
            service = ClaudeService()
            await service.generate_response(
                "Find roads", self._make_search_results()
            )

        call_kwargs = mock_client.messages.create.call_args[1]
        user_message = call_kwargs["messages"][-1]["content"]
        # Should contain properties but not raw coordinates
        assert "Mountain Pass Rd" in user_message
        assert "LineString" not in user_message

    @patch("api.services.claude_service.anthropic.Anthropic")
    @pytest.mark.asyncio
    async def test_caps_results_at_10(self, mock_anthropic_cls):
        """Should only include up to 10 roads in the context."""
        mock_client = self._make_mock_client("Found many roads!")
        mock_anthropic_cls.return_value = mock_client

        features = [
            {
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": [[0, 0], [1, 1]]},
                "properties": {"id": i, "name": f"Road {i}", "curvature": 1000 + i},
            }
            for i in range(15)
        ]
        results = {
            "type": "FeatureCollection",
            "features": features,
            "metadata": {"count": 15},
        }

        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"}):
            service = ClaudeService()
            await service.generate_response("Find roads", results)

        call_kwargs = mock_client.messages.create.call_args[1]
        user_message = call_kwargs["messages"][-1]["content"]
        # Should mention total count of 15 but only include 10 road details
        assert "15 road(s)" in user_message
        assert "Road 9" in user_message
        assert "Road 10" not in user_message

    @patch("api.services.claude_service.anthropic.Anthropic")
    @pytest.mark.asyncio
    async def test_passes_history(self, mock_anthropic_cls):
        """Should prepend history to messages."""
        mock_client = self._make_mock_client("Here are shorter roads!")
        mock_anthropic_cls.return_value = mock_client

        history = [
            {"role": "user", "content": "Find curvy roads in Vermont"},
            {"role": "assistant", "content": "Found some great roads!"},
        ]

        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"}):
            service = ClaudeService()
            await service.generate_response(
                "Show me shorter ones",
                self._make_search_results(),
                history=history,
            )

        call_kwargs = mock_client.messages.create.call_args[1]
        messages = call_kwargs["messages"]
        assert len(messages) == 3
        assert messages[0]["role"] == "user"
        assert messages[1]["role"] == "assistant"
        assert messages[2]["role"] == "user"

    @patch("api.services.claude_service.anthropic.Anthropic")
    @pytest.mark.asyncio
    async def test_uses_response_generation_prompt(self, mock_anthropic_cls):
        """Should use the response generation system prompt."""
        mock_client = self._make_mock_client("Great roads!")
        mock_anthropic_cls.return_value = mock_client

        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"}):
            service = ClaudeService()
            await service.generate_response(
                "Find roads", self._make_search_results()
            )

        call_kwargs = mock_client.messages.create.call_args[1]
        assert call_kwargs["system"] == RESPONSE_GENERATION_PROMPT

    @patch("api.services.claude_service.anthropic.Anthropic")
    @pytest.mark.asyncio
    async def test_raises_on_api_error(self, mock_anthropic_cls):
        """Should re-raise API errors."""
        import anthropic

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.side_effect = anthropic.APIError(
            message="Service unavailable",
            request=MagicMock(),
            body=None,
        )

        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"}):
            service = ClaudeService()
            with pytest.raises(anthropic.APIError):
                await service.generate_response(
                    "Find roads", self._make_search_results()
                )
