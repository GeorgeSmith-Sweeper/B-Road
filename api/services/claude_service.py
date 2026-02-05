"""
Service for Claude AI integration.

Handles communication with the Anthropic API for natural language
understanding and road search parameter extraction.
"""

import json
import os
import logging
from typing import Optional, Dict, Any

import anthropic

logger = logging.getLogger(__name__)

# System prompt for extracting road search parameters from natural language
FILTER_EXTRACTION_PROMPT = """You are a helpful assistant that extracts road search parameters from natural language queries about finding curvy/twisty roads.

Extract these parameters if mentioned by the user:
- min_curvature: minimum curvature score (integer, typically 300-15000)
- max_curvature: maximum curvature score (integer)
- min_length: minimum road length in miles (number)
- max_length: maximum road length in miles (number)
- surface_types: road surface types (list of strings: "paved", "unpaved", "gravel")
- sources: US state names to search in (list of strings, e.g., ["vermont", "new_hampshire"])
- location: general location description if specific state not mentioned (string)

Curvature score guidelines:
- 300-600: mild curves, pleasant driving
- 600-1000: moderate curves, enjoyable twists
- 1000-2000: very curvy, fun driving roads
- 2000-5000: highly twisty, enthusiast favorite
- 5000-10000: extreme curves, mountain switchbacks
- 10000+: epic, world-class twisty roads

Interpret natural language cues:
- "twisty", "curvy" -> min_curvature: 1000
- "very twisty", "really curvy" -> min_curvature: 2000
- "super twisty", "extremely curvy" -> min_curvature: 5000
- "epic", "legendary", "amazing" -> min_curvature: 8000
- "short" -> max_length: 5
- "long" -> min_length: 10
- State names should be lowercase with underscores (e.g., "new_york", "north_carolina")

Respond ONLY with a valid JSON object containing the extracted parameters.
If a parameter is not mentioned or cannot be inferred, omit it from the response.
Do not include any explanation, just the JSON object.

Examples:

User: "Find twisty roads in Vermont"
{"min_curvature": 1000, "sources": ["vermont"]}

User: "Show me epic curvy mountain roads"
{"min_curvature": 8000}

User: "I want short, super twisty paved roads in New Hampshire"
{"min_curvature": 5000, "max_length": 5, "surface_types": ["paved"], "sources": ["new_hampshire"]}

User: "What are the curviest roads in the northeast?"
{"min_curvature": 2000, "location": "northeast"}

User: "Find roads over 10000 curvature that are at least 20 miles long"
{"min_curvature": 10000, "min_length": 20}
"""


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

    async def extract_filters(self, user_query: str) -> Dict[str, Any]:
        """
        Extract search filters from a natural language query.

        Args:
            user_query: The user's natural language query about finding roads

        Returns:
            Dictionary of extracted filter parameters
        """
        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=1024,
                system=FILTER_EXTRACTION_PROMPT,
                messages=[{"role": "user", "content": user_query}],
            )

            response_text = response.content[0].text.strip()

            # Parse JSON response
            try:
                # Handle potential markdown code blocks
                if response_text.startswith("```"):
                    # Extract JSON from code block
                    lines = response_text.split("\n")
                    json_lines = []
                    in_block = False
                    for line in lines:
                        if line.startswith("```"):
                            in_block = not in_block
                            continue
                        if in_block or not line.startswith("```"):
                            json_lines.append(line)
                    response_text = "\n".join(json_lines)

                filters = json.loads(response_text)

                # Validate that we got a dictionary
                if not isinstance(filters, dict):
                    logger.warning(
                        f"Claude returned non-dict response: {response_text}"
                    )
                    return {}

                return filters

            except json.JSONDecodeError as e:
                logger.warning(
                    f"Failed to parse Claude filter response: {response_text}, error: {e}"
                )
                return {}

        except anthropic.APIError as e:
            logger.error(f"Claude API error during filter extraction: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error extracting filters: {e}")
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
