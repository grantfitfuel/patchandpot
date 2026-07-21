"""Public topic feeds — RSS 2.0 + JSON Feed 1.1 per Ask Nàdar topic.

Each topic (e.g. `/ask/topics/tomatoes`) exposes a subscribeable feed so
external gardening blogs, aggregators and reader apps can pull fresh
questions as they surface. Feeds mirror the same eligibility filter
used on the human topic page (hits >= 1, first-turn, not hidden).

Public routes:
    GET /api/ask/topics/{topic_id}/feed.rss   → application/rss+xml
    GET /api/ask/topics/{topic_id}/feed.json  → application/feed+json
"""
from __future__ import annotations

import html
from datetime import datetime, timezone
from email.utils import format_datetime
from typing import Iterable

# Cap the number of items in any single feed to keep files tiny and
# reader apps happy. 50 is generous — reflects the "top ~50 hot questions"
# ordering used on the human page.
MAX_FEED_ITEMS = 50


def _abs_url(base: str, path: str) -> str:
    base = (base or "").rstrip("/")
    if not path.startswith("/"):
        path = "/" + path
    return f"{base}{path}" if base else path


def _iso_to_rfc822(iso: str) -> str:
    """`2026-07-21T14:35:11+00:00` → `Mon, 21 Jul 2026 14:35:11 +0000`.
    RSS 2.0 spec requires RFC-822 dates. Falls back to current UTC."""
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except Exception:  # noqa: BLE001
        dt = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return format_datetime(dt)


def _one_line(text: str, max_chars: int = 320) -> str:
    if not text:
        return ""
    single = " ".join(text.split())
    if len(single) <= max_chars:
        return single
    return single[: max_chars - 1].rsplit(" ", 1)[0] + "…"


def build_rss(
    *,
    topic_id: str,
    topic_label: str,
    topic_blurb: str,
    site_base: str,
    items: Iterable[dict],
) -> str:
    """Render an RSS 2.0 feed. `items` = the ask_cache rows already sliced
    down to MAX_FEED_ITEMS by the caller (so we don't do the slicing in
    two places)."""
    now = format_datetime(datetime.now(timezone.utc))
    feed_url = _abs_url(site_base, f"/api/ask/topics/{topic_id}/feed.rss")
    topic_url = _abs_url(site_base, f"/ask/topics/{topic_id}")

    channel = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
        '  <channel>',
        f'    <title>{html.escape(f"Ask Nàdar · {topic_label} — Patch & Pot")}</title>',
        f'    <link>{html.escape(topic_url)}</link>',
        f'    <description>{html.escape(topic_blurb)}</description>',
        '    <language>en</language>',
        f'    <lastBuildDate>{now}</lastBuildDate>',
        f'    <atom:link href="{html.escape(feed_url)}" rel="self" type="application/rss+xml" />',
        f'    <generator>Patch &amp; Pot</generator>',
    ]

    for row in items:
        slug = row.get("slug", "")
        if not slug:
            continue
        q = row.get("question_normalized") or ""
        title = _one_line(q, 140).capitalize()
        answer = row.get("answer") or ""
        # Answer sometimes contains markdown. Escape once so it's safe to
        # embed inside CDATA — readers render as plain HTML text anyway.
        item_url = _abs_url(site_base, f"/ask/popular/{slug}")
        pub = _iso_to_rfc822(row.get("first_asked_at") or "")
        channel += [
            '    <item>',
            f'      <title>{html.escape(title)}</title>',
            f'      <link>{html.escape(item_url)}</link>',
            f'      <guid isPermaLink="true">{html.escape(item_url)}</guid>',
            f'      <pubDate>{pub}</pubDate>',
            f'      <description><![CDATA[{html.escape(_one_line(answer, 500))}]]></description>',
            '    </item>',
        ]

    channel += ['  </channel>', '</rss>']
    return "\n".join(channel)


def build_json_feed(
    *,
    topic_id: str,
    topic_label: str,
    topic_blurb: str,
    site_base: str,
    items: Iterable[dict],
) -> dict:
    """Render a JSON Feed 1.1 dict (https://www.jsonfeed.org/version/1.1/)."""
    feed_url = _abs_url(site_base, f"/api/ask/topics/{topic_id}/feed.json")
    topic_url = _abs_url(site_base, f"/ask/topics/{topic_id}")

    feed_items = []
    for row in items:
        slug = row.get("slug", "")
        if not slug:
            continue
        q = (row.get("question_normalized") or "").capitalize()
        answer = row.get("answer") or ""
        item_url = _abs_url(site_base, f"/ask/popular/{slug}")
        feed_items.append({
            "id": item_url,
            "url": item_url,
            "title": _one_line(q, 140),
            "content_text": answer,
            "date_published": row.get("first_asked_at") or "",
            "date_modified": row.get("last_asked_at") or row.get("first_asked_at") or "",
            "tags": [topic_label],
        })

    return {
        "version": "https://jsonfeed.org/version/1.1",
        "title": f"Ask Nàdar · {topic_label} — Patch & Pot",
        "description": topic_blurb,
        "home_page_url": topic_url,
        "feed_url": feed_url,
        "language": "en",
        "items": feed_items,
    }
