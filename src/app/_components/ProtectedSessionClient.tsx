"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const WARNING_AFTER_MS = 2 * 60 * 1000;
const LOGOUT_AFTER_MS = 3 * 60 * 1000;
const HEARTBEAT_MIN_GAP_MS = 30 * 1000;

function isProtectedPath(pathname: string) {
  return pathname.startsWith("/admin") || pathname.startsWith("/dashboard");
}

export default function ProtectedSessionClient() {
  const pathname = usePathname() || "/";
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const warningTimerRef = useRef<number | null>(null);
  const logoutTimerRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  const lastHeartbeatAtRef = useRef(0);

  const protectedView = isProtectedPath(pathname);

  const clearTimers = useCallback(() => {
    if (warningTimerRef.current) window.clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) window.clearTimeout(logoutTimerRef.current);
    if (countdownRef.current) window.clearInterval(countdownRef.current);
  }, []);

  const goLogout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", cache: "no-store" });
    } catch {
      // Ignore errors and redirect anyway.
    } finally {
      const next = encodeURIComponent(pathname || "/dashboard/targets");
      window.location.href = `/auth/login?next=${next}`;
    }
  }, [pathname]);

  const pingHeartbeat = useCallback(async () => {
    const now = Date.now();
    if (now - lastHeartbeatAtRef.current < HEARTBEAT_MIN_GAP_MS) return;
    lastHeartbeatAtRef.current = now;
    try {
      const res = await fetch("/api/auth/heartbeat", { method: "POST", cache: "no-store" });
      if (res.status === 401) await goLogout();
    } catch {
      // No-op: temporary network hiccup should not force immediate logout.
    }
  }, [goLogout]);

  const resetIdleTimers = useCallback(() => {
    if (!protectedView) return;
    clearTimers();
    setShowWarning(false);
    setCountdown(60);

    warningTimerRef.current = window.setTimeout(() => {
      setShowWarning(true);
      const warningShownAt = Date.now();
      countdownRef.current = window.setInterval(() => {
        const remainingMs = Math.max(0, LOGOUT_AFTER_MS - (Date.now() - warningShownAt) - WARNING_AFTER_MS);
        setCountdown(Math.ceil(remainingMs / 1000));
      }, 250);
    }, WARNING_AFTER_MS);

    logoutTimerRef.current = window.setTimeout(() => {
      void goLogout();
    }, LOGOUT_AFTER_MS);
  }, [clearTimers, goLogout, protectedView]);

  useEffect(() => {
    if (!protectedView) {
      clearTimers();
      setShowWarning(false);
      return;
    }

    const onActivity = () => {
      void pingHeartbeat();
      resetIdleTimers();
    };

    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "scroll", "mousemove", "touchstart"];
    events.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));
    onActivity();

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, onActivity));
      clearTimers();
    };
  }, [clearTimers, pingHeartbeat, protectedView, resetIdleTimers]);

  if (!protectedView) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => void goLogout()}
        className="fixed bottom-4 right-4 z-[1300] rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold text-neutral-800 shadow-sm hover:bg-neutral-50"
      >
        Log Out
      </button>

      {showWarning ? (
        <div className="fixed inset-0 z-[1400] grid place-items-center bg-black/35 p-4">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-5 shadow-lg">
            <h2 className="text-lg font-semibold text-neutral-900">Still working?</h2>
            <p className="mt-2 text-sm text-neutral-700">
              You will be logged out in about {countdown}s due to inactivity.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
                onClick={() => {
                  void pingHeartbeat();
                  resetIdleTimers();
                }}
              >
                Keep Working
              </button>
              <button
                type="button"
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
                onClick={() => void goLogout()}
              >
                Log Out Now
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

