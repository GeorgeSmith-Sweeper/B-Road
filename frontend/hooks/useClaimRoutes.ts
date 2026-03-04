'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useWaypointRouteStore } from '@/store/useWaypointRouteStore';
import { claimRoutes } from '@/lib/routes-api';
import toast from 'react-hot-toast';

/**
 * On sign-in, automatically claims any anonymous session routes
 * for the authenticated user.
 */
export function useClaimRoutes() {
  const { isSignedIn, getToken } = useAuth();
  const sessionId = useWaypointRouteStore((s) => s.sessionId);
  const hasClaimed = useRef(false);

  useEffect(() => {
    if (!isSignedIn || !sessionId || hasClaimed.current) return;

    const claim = async () => {
      try {
        const token = await getToken();
        if (!token) return;

        const result = await claimRoutes(sessionId, token);
        hasClaimed.current = true;

        if (result.claimed_count > 0) {
          toast.success(`${result.claimed_count} route(s) added to your account`);
        }
      } catch (err) {
        // Silent failure - don't block user flow for claim errors
        console.error('Failed to claim routes:', err);
      }
    };

    claim();
  }, [isSignedIn, sessionId, getToken]);
}
