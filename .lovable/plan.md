

## Fix: Monitor Trader Matchbook Connection

### Problem Identified

The edge function proxy works correctly (confirmed by direct testing - returns `session-token` successfully). However, the browser connection fails due to two issues:

1. **Duplicate auto-login race condition**: Both `MonitorTrader.tsx` (line 128-135) AND `useMatchbookMonitor.ts` (line 243-249) have auto-login `useEffect` hooks that fire simultaneously, causing 2+ concurrent calls to the proxy during cold boot, resulting in "Failed to fetch" errors.

2. **Missing error feedback**: When login fails, the error message is stored in state but never displayed to the user -- the UI just resets to the login form silently.

### Changes

**1. `src/hooks/useMatchbookMonitor.ts`**
- Remove the duplicate auto-login `useEffect` (lines 243-249). Login should only be triggered from the page component, not from the hook itself.
- Add `console.log` in `doLogin` to trace the proxy response for debugging.
- Improve error handling in `matchbookFetch` to handle cases where `supabase.functions.invoke` returns `data` with an error status.

**2. `src/pages/MonitorTrader.tsx`**
- Remove the duplicate `loadCreds`/`saveCreds`/`clearCreds` functions (already defined in the hook file).
- Display `monitor.error` message in the login card so the user can see why connection failed.
- Add a toast notification on login failure so the user gets immediate feedback.
- Keep the auto-login logic only here (single source of truth).

### Technical Details

The root cause: when `MonitorTrader` mounts, two `useEffect` hooks fire simultaneously:
- Hook's auto-login: `useMatchbookMonitor` line 243
- Page's auto-login: `MonitorTrader` line 128

Both call `monitor.login()` at the same time, triggering 2 concurrent `POST` requests to the edge function. During cold boot, the edge function may not handle concurrent requests well, causing "Failed to fetch".

The fix removes the hook-level auto-login and keeps it only in the page component, ensuring a single login attempt.

