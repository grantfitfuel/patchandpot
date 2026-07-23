"""Stripe checkout + webhook + access verification.

The Stripe `session_id` IS the passwordless access token — we store it in
`access_grants` once payment is confirmed, then the frontend keeps it in
localStorage and sends it to `POST /api/access/check` to gate premium features.
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request

from emergentintegrations.payments.stripe.checkout import CheckoutSessionRequest

from eventlog import emit

from core import (
    AccessCheckRequest, CheckoutRequest,
    DEFAULT_PACKAGE_ID, FOUNDING_TOTAL, PAYWALL_PACKAGES,
    _expiry_for, _stripe_checkout,
)

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

    @router.post("/checkout/session")
    async def create_checkout(payload: CheckoutRequest, request: Request):
        """Create a Stripe Checkout session for the chosen access tier."""
        sc = _stripe_checkout(str(request.base_url))
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

        req = CheckoutSessionRequest(
            amount=pkg["amount"],
            currency=pkg["currency"],
            success_url=success_url,
            cancel_url=cancel_url,
            metadata=metadata,
        )
        session = await sc.create_checkout_session(req)

        await db.payment_transactions.insert_one({
            "session_id": session.session_id,
            "amount": pkg["amount"],
            "currency": pkg["currency"],
            "package_id": pkg["id"],
            "payment_status": "pending",
            "status": "open",
            "metadata": metadata,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "access_granted": False,
        })
        emit("checkout.created",
             session_id=session.session_id, package_id=pkg["id"],
             amount=pkg["amount"], currency=pkg["currency"])
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
                emit("checkout.paid",
                     session_id=session_id, package_id=pkg_id,
                     amount=txn.get("amount"), currency=txn.get("currency"),
                     ref=txn.get("ref"))
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
            # `package_id` is needed by the frontend so it can:
            #   1. Show the tip-jar thank-you page instead of the paywall
            #      success page for `tip` purchases.
            #   2. Attach the correct tier label to the GA4 `purchase` /
            #      `checkout_success` conversion event for funnel reports.
            "package_id": (txn or {}).get("package_id") or (status.metadata or {}).get("package_id"),
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
                        }},
                        upsert=True,
                    )
        return {"ok": True}

    @router.post("/access/check")
    async def check_access(payload: AccessCheckRequest):
        """Validate that a session_id has been granted access AND that any expiry
        has not yet passed. Lifetime grants have expires_at=None and never expire.
        Also reports the multi-patch cap (5 free / 25 paid) on the same response
        so the frontend can adjust `canAdd` without a second round-trip."""
        from core import FREE_PATCH_LIMIT, PAID_PATCH_LIMIT
        token = (payload.token or "").strip()
        if not token:
            return {"paid": False, "patch_limit": FREE_PATCH_LIMIT}
        grant = await db.access_grants.find_one({"token": token}, {"_id": 0})
        if not grant:
            return {"paid": False, "patch_limit": FREE_PATCH_LIMIT}
        expires_at = grant.get("expires_at")
        now_iso = datetime.now(timezone.utc).isoformat()
        expired = bool(expires_at) and now_iso > expires_at
        paid = not expired
        return {
            "paid": paid,
            "expired": expired,
            "package_id": grant.get("package_id"),
            "granted_at": grant.get("granted_at"),
            "expires_at": expires_at,
            "patch_limit": PAID_PATCH_LIMIT if paid else FREE_PATCH_LIMIT,
        }

    return router
