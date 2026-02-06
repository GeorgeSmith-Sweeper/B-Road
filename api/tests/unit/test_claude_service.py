"""
Unit tests for ClaudeService.

Tests AI integration with mocked Anthropic client to avoid
real API calls during testing.
"""

import json
import os
import pytest
from unittest.mock import patch, MagicMock

from api.services.claude_service import ClaudeService, FILTER_EXTRACTION_PROMPT


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
