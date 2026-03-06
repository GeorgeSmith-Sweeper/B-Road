# Clerk Dark Theme Fix

## Problem
Clerk UI components (user popover, profile modal) render with dark/low-contrast text on our dark background. The user's name, email, "Manage account", "Sign out", email addresses under profile, and connected accounts text are all nearly invisible.

## Root Cause (Suspected)
Clerk's components inherit or override text colors in a way that doesn't respect our dark app theme. The exact mechanism is unclear — multiple approaches to override the colors have failed.

## What We Tried

### 1. ClerkProvider `variables` only
Set `colorText`, `colorTextSecondary`, `colorNeutral` in the `appearance.variables` prop.
- **Result**: No effect on most text elements.

### 2. ClerkProvider `elements` with Tailwind classes
Targeted `userButtonPopoverCard`, `userButtonPopoverActionButtonText`, etc. with Tailwind class strings like `"text-[#E8E8E8]"`.
- **Result**: Only icons changed color, text did not.

### 3. ClerkProvider `elements` with inline style objects
Switched from Tailwind classes to `{ color: "#E8E8E8" }` style objects on the same element keys, plus added `userPreviewMainIdentifier`, `userPreviewSecondaryIdentifier`.
- **Result**: Popover text fixed, but profile modal text (email addresses, connected accounts) still dark.

### 4. Additional profile element keys
Added `profileSectionItemList`, `formattedEmail`, `badge`, `accountSwitcherTrigger` etc.
- **Result**: No effect — these element keys likely don't match Clerk v7's internal structure.

### 5. `@clerk/themes` dark base theme
Installed `@clerk/themes`, used `baseTheme: dark` with minimal variable overrides.
- **Result**: No visible change — text still dark.

### 6. Global CSS `--foreground` variable fix
Changed `:root { --foreground: #171717 }` to `#F5F4F2` since the body inherits this color and it cascades into Clerk.
- **Result**: No visible change.

## Next Steps to Try
- **Inspect rendered DOM**: Use browser dev tools to find the actual CSS class names or inline styles Clerk applies, then target those specifically with global CSS `!important` overrides.
- **Check Clerk v7 docs**: The element key API may have changed significantly in v7. Review https://clerk.com/docs/customization/overview for v7-specific guidance.
- **CSS specificity**: Try adding global CSS rules targeting Clerk's `cl-` prefixed class names with `!important`.
- **Contact Clerk support**: If the dark theme package genuinely doesn't work, this may be a Clerk bug worth reporting.
- **Consider `<UserProfile>` routing**: Instead of the modal, use a dedicated `/account` page with `<UserProfile />` where we have more control over the surrounding styles.

## Clerk Version
- `@clerk/nextjs`: ^7.0.1
- `@clerk/themes`: installed (latest)
- Next.js: 16.1.1
