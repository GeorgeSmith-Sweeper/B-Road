"""
Clerk JWT verification for FastAPI.

Provides dependencies for optional and required authentication
using Clerk's JWKS public keys.
"""

import os
from typing import Optional
from functools import lru_cache

import jwt
from jwt import PyJWKClient
from fastapi import Header, HTTPException


@lru_cache(maxsize=1)
def get_jwks_client() -> PyJWKClient:
    """Get a cached JWKS client for Clerk's public keys."""
    secret_key = os.environ.get("CLERK_SECRET_KEY", "")
    # Extract the Clerk instance ID from the secret key (sk_test_xxx or sk_live_xxx)
    # Clerk JWKS URL format: https://<instance>.clerk.accounts.dev/.well-known/jwks.json
    # But the simpler approach is to use the Clerk Frontend API domain
    # which can be derived from the publishable key or configured directly.
    #
    # For Clerk, the JWKS endpoint is at:
    # https://<your-clerk-frontend-api>/.well-known/jwks.json
    #
    # We use the CLERK_JWKS_URL env var if set, otherwise construct from CLERK_SECRET_KEY
    jwks_url = os.environ.get("CLERK_JWKS_URL", "")
    if not jwks_url:
        # Fallback: Clerk's JWKS can be fetched via the Backend API
        # Using the Frontend API domain from CLERK_ISSUER or a direct URL
        issuer = os.environ.get("CLERK_ISSUER", "")
        if issuer:
            jwks_url = f"{issuer.rstrip('/')}/.well-known/jwks.json"
        else:
            raise RuntimeError(
                "CLERK_ISSUER or CLERK_JWKS_URL must be set for JWT verification. "
                "Set CLERK_ISSUER to your Clerk Frontend API URL "
                "(e.g., https://your-app.clerk.accounts.dev)"
            )

    return PyJWKClient(jwks_url, cache_keys=True)


def _decode_token(token: str) -> dict:
    """Decode and verify a Clerk JWT token."""
    try:
        client = get_jwks_client()
        signing_key = client.get_signing_key_from_jwt(token)
        issuer = os.environ.get("CLERK_ISSUER", "")

        decode_options = {}
        kwargs = {
            "algorithms": ["RS256"],
            "options": decode_options,
        }
        if issuer:
            kwargs["issuer"] = issuer

        return jwt.decode(
            token,
            signing_key.key,
            **kwargs,
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


def get_optional_user_id(
    authorization: Optional[str] = Header(None),
) -> Optional[str]:
    """FastAPI dependency: extract user_id from Bearer token, or return None."""
    if not authorization:
        return None

    if not authorization.startswith("Bearer "):
        return None

    token = authorization[7:]  # Strip "Bearer "
    try:
        claims = _decode_token(token)
        return claims.get("sub")
    except HTTPException:
        # For optional auth, swallow errors and return None
        return None


def require_user_id(
    authorization: Optional[str] = Header(None),
) -> str:
    """FastAPI dependency: extract user_id from Bearer token, or raise 401."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401, detail="Authorization header with Bearer token is required"
        )

    token = authorization[7:]
    claims = _decode_token(token)
    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing user identifier")
    return user_id
