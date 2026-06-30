"""Structured event logging — one-line JSON events for business-significant
moments (a plant promoted, a checkout paid, rate limit hit, budget breached).

Sits ALONGSIDE the standard `logging.getLogger(__name__)` calls — not a
replacement. Normal log output stays human-readable; event lines go to the
same stdout stream tagged with `event=` so a future log-aggregator
(Datadog / Logtail / Better Stack) can scoop them out with one filter.

Usage:
    from eventlog import emit
    emit("admin.promote.ok", plant_id="yarrow", source_slug="ai-yarrow")
    emit("ai.budget.over", spend_gbp=18.4, cap_gbp=15.0)

Why not python-json-logger or structlog? Two reasons:
  • Adding a dependency for ~30 lines of code is overkill.
  • This stays a no-op in tests because we emit through the standard
    `logging` module — tests that use `caplog` capture events too.
"""
import json
import logging
from datetime import datetime, timezone

# Dedicated logger so consumers can filter on `pp.events` alone (without the
# rest of the app's INFO chatter). Inherits the root config — events stream
# to the same stdout uvicorn already captures.
_EVENT_LOGGER = logging.getLogger("pp.events")


def emit(event: str, **fields) -> None:
    """Log a single business event. Adds `event=NAME ts=ISO …` to the line
    so a regex or JSON parser can pull a structured record without us
    having to wire a custom formatter.

    Values must be JSON-serialisable scalars (str/int/float/bool/None) —
    nested dicts and lists are allowed but discouraged (harder to query).
    """
    payload = {
        "event": event,
        "ts": datetime.now(timezone.utc).isoformat(),
        **{k: _coerce(v) for k, v in fields.items() if v is not None},
    }
    # Use the message itself as the JSON payload — most aggregators
    # auto-parse JSON in the message field, and grep/jq friendly.
    try:
        _EVENT_LOGGER.info(json.dumps(payload, separators=(",", ":"), default=str))
    except Exception:  # noqa: BLE001
        # Never let a logging failure crash a request — fall back to a
        # printf-ish line so we don't lose the event entirely.
        _EVENT_LOGGER.info("event=%s %s", event, fields)


def _coerce(v):
    """Last-resort serialisation for non-JSON types (datetime, ObjectId,
    Pydantic). Keeps emit() resilient when callers forget to stringify."""
    if isinstance(v, (str, int, float, bool, type(None))):
        return v
    if isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, (list, tuple)):
        return [_coerce(x) for x in v]
    if isinstance(v, dict):
        return {k: _coerce(val) for k, val in v.items()}
    return str(v)
