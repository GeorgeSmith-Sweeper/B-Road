'use client';

import { SignInButton, UserButton, useAuth } from '@clerk/nextjs';
import { User } from 'lucide-react';

export default function AuthButton() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <div className="w-8 h-8 rounded-full bg-bg-muted border border-border-subtle flex items-center justify-center">
        <User className="w-4 h-4 text-text-disabled" />
      </div>
    );
  }

  if (isSignedIn) {
    return <UserButton />;
  }

  return (
    <SignInButton mode="redirect">
      <button className="font-bebas text-sm tracking-[2px] text-text-secondary hover:text-text-primary transition-colors">
        SIGN IN
      </button>
    </SignInButton>
  );
}
