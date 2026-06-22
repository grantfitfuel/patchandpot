"""Stripe checkout + webhook + access verification.

The Stripe `session_id` IS the passwordless access token — we store it in
`access_grants` once payment is confirmed, then the frontend keeps it in
localStorage and sends it to `POST /api/access/check` to gate premium features.
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, Response

from emergentintegrations.payments.stripe.checkout import CheckoutSessionRequest

from core import (
    AccessCheckRequest, CheckoutRequest,
    DEFAULT_PACKAGE_ID, FOUNDING_TOTAL, PAYWALL_PACKAGES,
    _expiry_for, _stripe_checkout,
)

# Whitelist: lowercase letters, digits, dot, hyphen, underscore. Anything
# else (control chars, slashes, scripts) is silently dropped. Capped at 64
# chars so a malicious blog can't fill our Mongo with garbage.
_REF_ALLOWED = set("abcdefghijklmnopqrstuvwxyz0123456789.-_")


def _sanitize_ref(raw):
    """Coerce an arbitrary `ref` value to a safe attribution token.
    Returns None for empty/None/garbage inputs."""
    if not raw or not isinstance(raw, str):
        return None
    cleaned = "".join(c for c in raw.strip().lower() if c in _REF_ALLOWED)
    if not cleaned:
        return None
    return cleaned[:64]

logger = logging.getLogger(__name__)


def make_router(db) -> APIRouter:
    router = APIRouter()

    @router.get("/founding-status")
    async def founding_status():
        """How many of the limited Founding Member lifetime spots remain.
        Counts paid `lifetime_founding` rows in `access_grants` (one grant per
        successful checkout). When `available == 0`, the homepage banner
        switches to a thank-you state and checkout routes to regular lifetime."""
        sold = await db.access_grants.count_documents({"package_id": "lifetime_founding"})
        available = max(0, FOUNDING_TOTAL - int(sold))
        return {
            "total": FOUNDING_TOTAL,
            "sold": int(sold),
            "available": available,
            "active": available > 0,
        }

    @router.get("/founding-status/widget", response_class=HTMLResponse)
    async def founding_status_widget(request: Request):
        """Self-contained HTML snippet that any external site can embed via
        `<iframe src="https://patchandpot.app/api/founding-status/widget">`.
        Renders the live spots-remaining count with a single-click CTA that
        deep-links into the Founding checkout flow. Returns 204 when the
        cohort is sold out so embedders can hide the iframe gracefully."""
        sold = await db.access_grants.count_documents({"package_id": "lifetime_founding"})
        available = max(0, FOUNDING_TOTAL - int(sold))
        if available <= 0:
            return Response(status_code=204)

        # Resolve the public site origin from the request — prefer the
        # X-Forwarded-Host header (set by user-facing ingress) over the
        # raw Host (which can be the internal cluster name behind a proxy).
        host = (
            request.headers.get("x-forwarded-host")
            or request.headers.get("host")
            or "patchandpot.app"
        ).split(",")[0].strip()
        scheme = request.headers.get("x-forwarded-proto", "https").split(",")[0].strip()
        site_url = f"{scheme}://{host}".rstrip("/")

        # Attribution: derive a `ref` token from the embedding page's host
        # (the Referer header is the URL of the page that loaded this iframe).
        # Falls back gracefully — a missing Referer just means the visitor
        # bookmarked the widget URL directly.
        referer = request.headers.get("referer") or ""
        ref_token = None
        if referer:
            try:
                from urllib.parse import urlparse
                ref_host = (urlparse(referer).hostname or "").lower()
                # Drop our own host so on-site previews don't count as embeds.
                if ref_host and ref_host != host.lower().split(":")[0]:
                    ref_token = _sanitize_ref(f"embed-{ref_host}")
            except Exception:  # noqa: BLE001
                ref_token = None
        cta_url = f"{site_url}/?founding=1"
        if ref_token:
            cta_url += f"&ref={ref_token}"

        html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Patch &amp; Pot — Founding Member</title>
<style>
  :root {{ color-scheme: light; }}
  html, body {{ margin: 0; padding: 0; background: transparent; }}
  body {{
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    color: #2a2a26;
  }}
  .pp-card {{
    box-sizing: border-box;
    width: 100%;
    max-width: 480px;
    margin: 0 auto;
    padding: 18px 20px;
    background: #3A4A3A;
    color: #E8DDC9;
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }}
  .pp-eyebrow {{
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    opacity: 0.75;
  }}
  .pp-title {{
    font-size: 15px;
    line-height: 1.45;
    margin: 0;
  }}
  .pp-title b {{ font-weight: 600; }}
  .pp-spots {{ color: #E8B07A; font-weight: 600; }}
  .pp-cta {{
    display: inline-block;
    background: #C57B57;
    color: #E8DDC9;
    text-decoration: none;
    padding: 8px 14px;
    font-size: 13px;
    font-weight: 600;
    border-radius: 2px;
    align-self: flex-start;
  }}
  .pp-cta:hover {{ background: #b66e4b; }}
  .pp-footnote {{ font-size: 10px; opacity: 0.6; margin: 0; }}
</style>
</head>
<body>
<div class="pp-card" role="region" aria-label="Patch and Pot Founding Member offer">
  <span class="pp-eyebrow">Patch &amp; Pot · Founding Member</span>
  <p class="pp-title">
    Lifetime access for <b>£35</b> (normally £50) —
    <span class="pp-spots">{available} of {FOUNDING_TOTAL} spots left</span>.
  </p>
  <a class="pp-cta" href="{cta_url}" target="_top" rel="noopener">Claim my spot →</a>
  <p class="pp-footnote">One-time payment. No subscription. No login.</p>
</div>
</body>
</html>"""
        return HTMLResponse(
            content=html,
            headers={
                "Cache-Control": "public, max-age=60",
                # Embeddable from anywhere — that's the whole point.
                "Content-Security-Policy": "frame-ancestors *",
            },
        )

    @router.post("/checkout/session")
    async def create_checkout(payload: CheckoutRequest, request: Request):
        """Create a Stripe Checkout session for the chosen access tier."""
        try:
            sc = _stripe_checkout(str(request.base_url))
        except Exception as e:  # noqa: BLE001
            # Most likely: STRIPE_API_KEY env var missing or malformed.
            # Surface it as 503 so the frontend's diagnostic tag shows
            # something human-readable instead of a generic 500.
            logger.error("checkout._stripe_checkout failed: %s", e, exc_info=True)
            raise HTTPException(503, f"Stripe client init failed: {type(e).__name__}")

        pkg_id = (payload.package_id or DEFAULT_PACKAGE_ID).strip()

        # Founding Member redirect: if cohort is full, silently downgrade the
        # buyer to regular lifetime so the link in a stale tab still works.
        if pkg_id == "lifetime_founding":
            sold = await db.access_grants.count_documents({"package_id": "lifetime_founding"})
            if sold >= FOUNDING_TOTAL:
                pkg_id = "lifetime"

        pkg = PAYWALL_PACKAGES.get(pkg_id)
        if not pkg:
            raise HTTPException(400, "Unknown package_id")

        origin = payload.origin_url.rstrip("/")
        success_url = f"{origin}/checkout/success?session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{origin}/checkout/cancel"
        metadata = {"package_id": pkg["id"], "source": "web"}
        if payload.email:
            metadata["email"] = payload.email[:120]
        ref_token = _sanitize_ref(payload.ref)
        if ref_token:
            # Stripe metadata is the durable source of truth — webhook event
            # carries it back even if our DB row is missing for any reason.
            metadata["ref"] = ref_token

        req = CheckoutSessionRequest(
            amount=pkg["amount"],
            currency=pkg["currency"],
            success_url=success_url,
            cancel_url=cancel_url,
            metadata=metadata,
        )
        try:
            session = await sc.create_checkout_session(req)
        except Exception as e:  # noqa: BLE001
            # Real Stripe failures (rate limit, invalid key, network) bubble
            # here. We log the full traceback for prod log inspection and
            # return a clean 502 with the exception class so the modal's
            # diagnostic tag shows e.g. "HTTP 502: StripeAuthenticationError".
            logger.error("Stripe create_checkout_session failed: %s", e, exc_info=True)
            raise HTTPException(502, f"Stripe API error: {type(e).__name__}")

        try:
            await db.payment_transactions.insert_one({
                "session_id": session.session_id,
                "amount": pkg["amount"],
                "currency": pkg["currency"],
                "package_id": pkg["id"],
                "payment_status": "pending",
                "status": "open",
                "metadata": metadata,
                "ref": ref_token,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "access_granted": False,
            })
        except Exception as e:  # noqa: BLE001
            # DB write fails are non-fatal — the Stripe session is still
            # live and the webhook will re-create the txn row when paid.
            # Log loudly but don't break the user's checkout flow.
            logger.error("payment_transactions.insert_one failed: %s", e, exc_info=True)

        return {"url": session.url, "session_id": session.session_id, "package_id": pkg["id"]}

    @router.get("/checkout/status/{session_id}")
    async def get_checkout_status(session_id: str, request: Request):
        """Poll Stripe, update our record, and grant access on first 'paid' result."""
        sc = _stripe_checkout(str(request.base_url))
        status = await sc.get_checkout_status(session_id)

        update = {
            "status": status.status,
            "payment_status": status.payment_status,
            "checked_at": datetime.now(timezone.utc).isoformat(),
        }
        txn = await db.payment_transactions.find_one_and_update(
            {"session_id": session_id},
            {"$set": update},
            return_document=True,
        )

        paid = status.payment_status == "paid"
        if paid and txn and not txn.get("access_granted"):
            flipped = await db.payment_transactions.update_one(
                {"session_id": session_id, "access_granted": {"$ne": True}},
                {"$set": {"access_granted": True}},
            )
            if flipped.modified_count == 1:
                pkg_id = txn.get("package_id") or (status.metadata or {}).get("package_id") or DEFAULT_PACKAGE_ID
                ref_token = txn.get("ref") or _sanitize_ref((status.metadata or {}).get("ref"))
                # Tip purchases are pure gratitude — no access grant created.
                if pkg_id != "tip":
                    await db.access_grants.update_one(
                        {"token": session_id},
                        {"$set": {
                            "token": session_id,
                            "email": (status.metadata or {}).get("email"),
                            "package_id": pkg_id,
                            "expires_at": _expiry_for(pkg_id),
                            "granted_at": datetime.now(timezone.utc).isoformat(),
                            "ref": ref_token,
                        }},
                        upsert=True,
                    )

        return {
            "session_id": session_id,
            "status": status.status,
            "payment_status": status.payment_status,
            "amount_total": status.amount_total,
            "currency": status.currency,
            "paid": paid,
            "package_id": (txn or {}).get("package_id"),
        }

    @router.post("/webhook/stripe")
    async def stripe_webhook(request: Request):
        """Idempotent webhook — backstop for cases where the user closes the success tab."""
        sc = _stripe_checkout(str(request.base_url))
        body = await request.body()
        signature = request.headers.get("Stripe-Signature", "")
        try:
            evt = await sc.handle_webhook(body, signature)
        except Exception as e:  # noqa: BLE001
            logger.warning("stripe webhook verification failed: %s", e)
            raise HTTPException(400, "Invalid webhook")

        if evt.payment_status == "paid" and evt.session_id:
            txn = await db.payment_transactions.find_one_and_update(
                {"session_id": evt.session_id, "access_granted": {"$ne": True}},
                {"$set": {
                    "payment_status": "paid",
                    "access_granted": True,
                    "webhook_at": datetime.now(timezone.utc).isoformat(),
                }},
                return_document=True,
            )
            if txn:
                pkg_id = txn.get("package_id") or (evt.metadata or {}).get("package_id") or DEFAULT_PACKAGE_ID
                ref_token = txn.get("ref") or _sanitize_ref((evt.metadata or {}).get("ref"))
                # Tip purchases are pure gratitude — no access grant created.
                if pkg_id != "tip":
                    await db.access_grants.update_one(
                        {"token": evt.session_id},
                        {"$set": {
                            "token": evt.session_id,
                            "email": (evt.metadata or {}).get("email"),
                            "package_id": pkg_id,
                            "expires_at": _expiry_for(pkg_id),
                            "granted_at": datetime.now(timezone.utc).isoformat(),
                            "ref": ref_token,
                        }},
                        upsert=True,
                    )
        return {"ok": True}

    @router.post("/access/check")
    async def check_access(payload: AccessCheckRequest):
        """Validate that a session_id has been granted access AND that any expiry
        has not yet passed. Lifetime grants have expires_at=None and never expire."""
        token = (payload.token or "").strip()
        if not token:
            return {"paid": False}
        grant = await db.access_grants.find_one({"token": token}, {"_id": 0})
        if not grant:
            return {"paid": False}
        expires_at = grant.get("expires_at")
        now_iso = datetime.now(timezone.utc).isoformat()
        expired = bool(expires_at) and now_iso > expires_at
        return {
            "paid": not expired,
            "expired": expired,
            "package_id": grant.get("package_id"),
            "granted_at": grant.get("granted_at"),
            "expires_at": expires_at,
        }

    return router
