"""LLM-generated, platform-tuned social-media captions for a shared patch.

Caching strategy
----------------
Captions are cached in MongoDB keyed by `(share_id, version)` exactly like
the OG card cache — bumped automatically on every snapshot edit. That
means the first kit download per snapshot costs four short LLM calls
(~$0.001 with Claude Haiku) and every subsequent download is free.

We deliberately reuse the same Claude Sonnet 4.5 model used elsewhere
in the app (masterclass router) so the budget envelope is predictable.
Captions are short (~100 words each) so cost per kit is low (~$0.003).
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Dict

from emergentintegrations.llm.chat import LlmChat, UserMessage

from core import EMERGENT_LLM_KEY

log = logging.getLogger("share_social_captions")


_PLATFORMS = (
    # (key, human label, hashtag style hint, length budget)
    ("instagram_square",
     "Instagram square feed post",
     "End with 6-8 niche gardening hashtags (#smallspacegarden style, not generic #love).",
     "120-180 words"),
    ("instagram_portrait",
     "Instagram portrait feed post",
     "End with 6-8 niche gardening hashtags. Slightly more storytelling because the image is taller.",
     "150-220 words"),
    ("reels_story",
     "Reels / TikTok / Stories caption",
     "Punchy hook in the first line (mobile users see only that). Max 3 hashtags. Add 1-2 tasteful emojis.",
     "30-60 words"),
    ("youtube_twitter",
     "Twitter / YouTube cover caption",
     "Twitter format: a single tight line under 220 chars, no hashtags except 1 brand-relevant one. Conversational.",
     "Under 220 characters"),
)


def _fallback_captions(patch_name: str, region_name: str, plant_count: int) -> Dict[str, str]:
    """Used when the LLM is unavailable / budget exhausted. Better to ship
    a usable seed than to fail the whole download."""
    region_clause = f" in {region_name}" if region_name else ""
    plant_clause = f"{plant_count} plant" + ("" if plant_count == 1 else "s")
    return {
        "instagram_square": (
            f"Meet {patch_name}{region_clause} — {plant_clause} growing along with "
            "the season, one quiet patch at a time. 🌱 What's coming up in your "
            "garden this month?\n\n"
            "#smallspacegarden #containergardening #balconygarden "
            "#growwhatyoueat #gardendiary #patchandpot"
        ),
        "instagram_portrait": (
            f"This is {patch_name}{region_clause}. {plant_clause} tracked, "
            "one month at a time. Nothing fancy — just sun, soil, and the joy "
            "of watching tiny things become dinner.\n\n"
            "Patch & Pot keeps the calendar so I don't have to remember when "
            "to sow what. It just tells me, gently, on the day it matters.\n\n"
            "#smallspacegarden #containergardening #balconygarden "
            "#growwhatyoueat #gardendiary #urbangarden"
        ),
        "reels_story": (
            f"{patch_name}{region_clause} — {plant_clause} and counting. 🌿\n"
            "Link in bio for the live patch.\n#patchandpot"
        ),
        "youtube_twitter": (
            f"Tracking {plant_clause} on {patch_name}{region_clause} — "
            "month by month with @patchandpot."
        ),
    }


async def generate_captions(
    *, patch_name: str, region_name: str, plant_count: int, share_url: str,
) -> Dict[str, str]:
    """Generate one caption per platform via Claude Haiku.

    Returns dict keyed by `_PLATFORMS[i][0]`. On any error (missing key,
    LLM failure, malformed JSON) we fall back to a deterministic
    template-driven set — the user still gets a usable kit.
    """
    if not EMERGENT_LLM_KEY:
        log.info("No EMERGENT_LLM_KEY — returning template captions")
        return _fallback_captions(patch_name, region_name, plant_count)

    plant_word = "plant" if plant_count == 1 else "plants"

    sys_msg = (
        "You write short, warm, on-brand social-media captions for "
        "Patch & Pot — a calm, regional, season-led gardening companion "
        "for renters and small-space gardeners. Voice: quiet, encouraging, "
        "specific, never hype-y. No 'Discover the magic of...' style. "
        "British English spelling. Never claim a result we can't deliver."
    )

    platform_lines = "\n".join(
        f"  - {key}: {label}. {hint} Length: {budget}."
        for key, label, hint, budget in _PLATFORMS
    )

    user_msg = (
        f"Write a caption per platform for the patch below.\n\n"
        f"PATCH NAME: {patch_name}\n"
        f"REGION: {region_name or '—'}\n"
        f"PLANTS TRACKED: {plant_count} {plant_word}\n"
        f"LINK (use exactly as written, don't shorten): {share_url}\n\n"
        f"PLATFORMS:\n{platform_lines}\n\n"
        "Each caption stands alone — readers see only one. Include the LINK "
        "naturally where it helps clicks (Stories caption: tell viewers to "
        "use the link sticker; Twitter: include the URL inline).\n\n"
        "Output ONLY a single JSON object whose keys are the platform keys "
        "above and whose values are the caption strings. No prose, no "
        "markdown fences."
    )

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"social-captions-{share_url[-20:]}",
            system_message=sys_msg,
        )
        chat.with_model("anthropic", "claude-sonnet-4-5-20250929")
        chat.with_params(max_tokens=1500)
        resp = await asyncio.wait_for(
            chat.send_message(UserMessage(text=user_msg)), timeout=30,
        )
    except Exception as e:  # noqa: BLE001 — fall back rather than 500
        log.warning("Caption LLM call failed: %r — using templates", e)
        return _fallback_captions(patch_name, region_name, plant_count)

    text = (resp or "").strip()
    # Strip optional ```json fences
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]*\}", text)
        if not m:
            log.warning("Caption LLM returned non-JSON — using templates")
            return _fallback_captions(patch_name, region_name, plant_count)
        try:
            data = json.loads(m.group(0))
        except json.JSONDecodeError:
            return _fallback_captions(patch_name, region_name, plant_count)

    # Backfill any missing platforms from the fallback set so the ZIP
    # always has a complete captions.txt.
    fallback = _fallback_captions(patch_name, region_name, plant_count)
    return {key: str(data.get(key) or fallback[key]).strip() for key, *_ in _PLATFORMS}
