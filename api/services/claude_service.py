"""
Service for Claude AI integration.

Handles communication with the Anthropic API for natural language
understanding and road search parameter extraction.
"""

import os
import logging
from typing import Optional

import anthropic

logger = logging.getLogger(__name__)


class ClaudeService:
    """Service for interacting with Claude AI."""

    def __init__(self):
        """Initialize the Claude service with API credentials."""
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable not set")

        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = "claude-sonnet-4-20250514"

    async def send_message(self, message: str, max_tokens: int = 1024) -> str:
        """
        Send a simple message to Claude and get a response.

        Args:
            message: The user's message
            max_tokens: Maximum tokens in response

        Returns:
            Claude's response text
        """
        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                messages=[{"role": "user", "content": message}],
            )
            return response.content[0].text
        except anthropic.APIError as e:
            logger.error(f"Claude API error: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error calling Claude: {e}")
            raise

    def is_available(self) -> bool:
        """
        Check if Claude service is available.

        Returns:
            True if the service can be used, False otherwise
        """
        try:
            return bool(os.getenv("ANTHROPIC_API_KEY"))
        except Exception:
            return False
