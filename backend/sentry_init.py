"""Sentry initialisation for the FastAPI backend.

Safe to call on every app boot. If `SENTRY_DSN` is not set in the environment,
this is a silent no-op — the app keeps running, no events are buffered, and no
warnings are emitted. Drop a real DSN into backend/.env (and restart) to turn
error reporting on without code changes.
"""
import logging
import os

logger = logging.getLogger(__name__)


def init_sentry() -> bool:
    """Initialise Sentry if a DSN is configured. Returns True if it was wired up."""
    dsn = (os.environ.get("SENTRY_DSN") or "").strip()
    if not dsn:
        return False

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration

        sentry_sdk.init(
            dsn=dsn,
            environment=os.environ.get("SENTRY_ENVIRONMENT", "production"),
            release=os.environ.get("SENTRY_RELEASE") or None,
            send_default_pii=False,
            # Modest defaults — perf data is opt-in. Bump these via env if you
            # want richer traces; we don't sample by default.
            traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0") or 0),
            profiles_sample_rate=float(os.environ.get("SENTRY_PROFILES_SAMPLE_RATE", "0") or 0),
            integrations=[StarletteIntegration(), FastApiIntegration()],
        )
        logger.info(
            "Sentry initialised (env=%s)",
            os.environ.get("SENTRY_ENVIRONMENT", "production"),
        )
        return True
    except Exception as e:  # noqa: BLE001 — Sentry must never block boot
        logger.warning("Sentry init failed (continuing without it): %s", e)
        return False
