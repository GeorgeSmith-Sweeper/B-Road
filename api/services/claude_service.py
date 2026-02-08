"""
Service for Claude AI integration.

Handles communication with the Anthropic API for natural language
understanding and road search parameter extraction.
"""

import json
import os
import logging
from typing import Optional, Dict, Any, List

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

IMPORTANT: Only include "sources" when the user explicitly names a US state. Do not guess or default to any state. If no state is mentioned, omit "sources" entirely.

Respond ONLY with a valid JSON object containing the extracted parameters.
If a parameter is not mentioned or cannot be inferred, omit it from the response.
Do not include any explanation, just the JSON object.

Examples:

User: "Find twisty roads in Vermont"
{"min_curvature": 1000, "sources": ["vermont"]}

User: "Show me epic curvy mountain roads"
{"min_curvature": 8000}

User: "I want short, super twisty paved roads in North Carolina"
{"min_curvature": 5000, "max_length": 5, "surface_types": ["paved"], "sources": ["north_carolina"]}

User: "What are the curviest roads in the southeast?"
{"min_curvature": 2000, "location": "southeast"}

User: "Find roads over 10000 curvature that are at least 20 miles long"
{"min_curvature": 10000, "min_length": 20}

User: "Show me curvy roads in Colorado and Utah"
{"min_curvature": 1000, "sources": ["colorado", "utah"]}

User: "Long twisty roads in Texas"
{"min_curvature": 1000, "min_length": 10, "sources": ["texas"]}
"""

# System prompt for generating conversational responses about road search results
RESPONSE_GENERATION_PROMPT = """You are an enthusiastic road trip advisor who helps people find amazing driving roads. You love curvy, twisty roads and get genuinely excited about great drives.

When the user asks about roads and you receive search results, describe the roads in an engaging, conversational way:
- Highlight the most interesting roads by name
- Interpret curvature scores: 300-600 mild, 600-1000 moderate, 1000-2000 very curvy, 2000-5000 highly twisty, 5000-10000 extreme, 10000+ epic/world-class
- Mention road lengths in miles
- Note surface types when relevant (paved vs unpaved)
- Mention which state/region the roads are in
- Keep responses concise (2-4 sentences for small result sets, up to a short paragraph for larger ones)
- If no roads were found, suggest broadening the search or trying different states

Do NOT list roads in a numbered format - describe them naturally in prose. Focus on what makes the roads special and exciting to drive."""


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

    async def extract_filters(
        self, user_query: str, history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        Extract search filters from a natural language query.

        Args:
            user_query: The user's natural language query about finding roads
            history: Optional conversation history for context-aware extraction

        Returns:
            Dictionary of extracted filter parameters
        """
        try:
            messages = []
            if history:
                messages.extend(history)
            messages.append({"role": "user", "content": user_query})

            response = self.client.messages.create(
                model=self.model,
                max_tokens=1024,
                system=FILTER_EXTRACTION_PROMPT,
                messages=messages,
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

    async def generate_response(
        self,
        user_query: str,
        search_results: Dict[str, Any],
        history: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        """
        Generate a conversational response describing search results.

        Args:
            user_query: The user's original query
            search_results: GeoJSON FeatureCollection from the database
            history: Optional conversation history for context

        Returns:
            Claude's conversational description of the results
        """
        try:
            # Extract just properties (strip geometry to save tokens)
            features = search_results.get("features", [])
            road_summaries = []
            for feature in features[:10]:
                props = feature.get("properties", {})
                road_summaries.append(props)

            count = search_results.get("metadata", {}).get("count", len(features))

            context = (
                f"The user asked: \"{user_query}\"\n\n"
                f"Search returned {count} road(s). "
                f"Here are the top results:\n"
                f"{json.dumps(road_summaries, indent=2)}"
            )

            messages = []
            if history:
                messages.extend(history)
            messages.append({"role": "user", "content": context})

            response = self.client.messages.create(
                model=self.model,
                max_tokens=1024,
                system=RESPONSE_GENERATION_PROMPT,
                messages=messages,
            )

            return response.content[0].text

        except anthropic.APIError as e:
            logger.error(f"Claude API error during response generation: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error generating response: {e}")
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
