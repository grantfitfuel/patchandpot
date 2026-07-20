"""2-Minute Calm — weekly-rotating, seasonally-scripted mindfulness audio.

Rotation: month-of-year × hemisphere. 12 monthly variants (NH), mirrored
for SH by mapping months (Mar↔Sep, Apr↔Oct etc.). Members-only with one
free preview (March / early spring, the friendliest entry point).

Content is authored via Claude Sonnet (JSON blocks + transcript), then
narrated with ElevenLabs (default voice: Rachel). Blocks are TTS'd
individually and stitched with `pause_after_s` silences so the breath
counts land where they should. Output is a single MP3 written to
`/app/backend/data/calm/{slug}.mp3` and served with an immutable cache
header so browsers keep it locally after the first play.

Storage:
  calm_variants  {slug, month, hemisphere, season_label, title, blocks[],
                  transcript_display, duration_s, audio_generated: bool,
                  audio_size_bytes, created_at, updated_at, is_free_preview}
                 slug format: "{month_name}-{hemisphere}"  e.g. "march-nh"
"""
import io
import json
import logging
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from emergentintegrations.llm.chat import LlmChat, UserMessage
from core import make_grant_is_active

logger = logging.getLogger(__name__)

AUDIO_DIR = Path("/app/backend/data/calm")
AUDIO_DIR.mkdir(parents=True, exist_ok=True)

ADMIN_TOKEN = os.environ.get("PATCHPOT_ADMIN_TOKEN", "patchpot-admin-d3f8a2b9c4")
ELEVENLABS_KEY = os.environ.get("ELEVENLABS_API_KEY", "")
DEFAULT_VOICE_ID = os.environ.get("ELEVENLABS_VOICE_ID", "pFZP5JQG7iQjIQuC4Bku")  # Lily — velvety British female
DEFAULT_MODEL_ID = "eleven_multilingual_v2"

MONTHS_NH = [
    ("january",   1, "Deep Winter"),
    ("february",  2, "Late Winter"),
    ("march",     3, "Early Spring"),
    ("april",     4, "Mid Spring"),
    ("may",       5, "Late Spring"),
    ("june",      6, "Early Summer"),
    ("july",      7, "High Summer"),
    ("august",    8, "Late Summer"),
    ("september", 9, "Early Autumn"),
    ("october",  10, "Mid Autumn"),
    ("november", 11, "Late Autumn"),
    ("december", 12, "Early Winter"),
]

FREE_PREVIEW_SLUGS = {"march-nh", "september-sh"}  # early spring in each hemisphere


class Block(BaseModel):
    text: str
    pause_after_s: float = Field(0, ge=0, le=30)


class CalmVariant(BaseModel):
    slug: str
    month: int
    hemisphere: str  # "nh" | "sh"
    season_label: str
    title: str
    blocks: List[Block]
    transcript_display: str
    duration_s: Optional[float] = None
    audio_generated: bool = False
    audio_size_bytes: Optional[int] = None
    is_free_preview: bool = False
    created_at: str
    updated_at: str


# ─── Script author (Claude Sonnet) ──────────────────────────────────
_SCRIPT_SYSTEM_PROMPT = """You are the Patch & Pot wellbeing writer. You write
2-minute mindful breathing scripts for gardeners — the kind read softly during
a garden pause. Tone: gentle, sensory, seasonally specific, never
clinical or crystal-woo. Reference the actual garden (soil, light, birds,
scent) not abstract 'nature'. Never use the words 'journey', 'divine',
'energy', 'vibration'.

CRITICAL:
- Total spoken duration must land roughly between 90 and 130 seconds when
  read at a slow, calm pace (~130 words per minute).
- Include ONE breathing pattern per script, kept simple. Examples:
    · Inhale 4, exhale 6
    · Inhale 4, hold 2, exhale 6
    · Inhale 4, exhale 8
- Guide the listener through 3–5 breath cycles at that pattern.
- After each spoken block, specify how many seconds of silence should
  follow. Use silence generously — this is a MEDITATION, not a lecture.
  Long silences (8–15s) around the breath cycles are correct.

OUTPUT FORMAT — return ONLY minified JSON, no markdown fences:
{
  "title": "Warm Evenings",
  "blocks": [
    {"text": "Find a comfortable posture. Let your shoulders soften.", "pause_after_s": 4},
    {"text": "Notice the late amber light on the leaves nearest you.", "pause_after_s": 6},
    ...
  ],
  "transcript_display": "Full pretty transcript ready to render on the web,
    with timestamps like '[00:00]' at the start of each block. Include the
    breathing pattern line between blocks where relevant."
}
"""


async def author_calm_script(
    month_name: str, month_num: int, hemisphere: str, season_label: str, api_key: str,
) -> dict:
    """Generate one 2-minute Calm script via Claude Sonnet."""
    hemi_label = "Northern Hemisphere" if hemisphere == "nh" else "Southern Hemisphere"
    hemi_hint = (
        "Northern-hemisphere gardens — think UK / Northern Europe / North America. "
        "British allotment vocabulary is welcome (patch, beds, path, shed)."
        if hemisphere == "nh" else
        "Southern-hemisphere gardens — think Australia / New Zealand / South Africa. "
        "Use plants and light that would actually be in a southern-hemisphere "
        "backyard for this month (jacaranda, gum, tui birds, silver birch in "
        "late-summer heat, etc.). DO NOT reference bulbs pushing through in "
        "spring if the month is calendar-winter for SH. The `SEASON` line "
        "below is authoritative — trust it over the month number."
    )
    payload = (
        f"MONTH: {month_name.title()} (#{month_num})\n"
        f"HEMISPHERE: {hemi_label}\n"
        f"SEASON: {season_label}\n"
        f"REGIONAL HINT: {hemi_hint}\n\n"
        "Write the script now. Anchor 2–3 sensory details specific to this "
        "month + hemisphere. Return ONLY the JSON object."
    )
    chat = LlmChat(
        api_key=api_key,
        session_id=f"calm-{month_name}-{hemisphere}",
        system_message=_SCRIPT_SYSTEM_PROMPT,
    )
    chat.with_model("anthropic", "claude-sonnet-4-5-20250929")
    chat.with_params(max_tokens=2500)
    resp = await chat.send_message(UserMessage(text=payload))
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", resp.strip())
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]*\}", text)
        if not m:
            raise HTTPException(500, "Claude did not return JSON")
        return json.loads(m.group(0))


# ─── Ambience bed (procedural, per-season) ──────────────────────────
# We synthesise the ambience with pydub generators rather than shipping
# nature-sound WAV files. Trade-off: less realistic than real birdsong,
# but zero licensing risk and repo stays tiny. Layered at -28dB the
# effect is subtle "presence" rather than obvious wind/rain — enough
# to hide ElevenLabs artefacts and avoid dead silence.
# Ambience is season-based. For NH `january` = deep winter; for SH the same
# calendar month = high summer. Season lookup uses the ACTUAL season the
# script was written for, not the calendar month.
_SEASON_BY_MONTH_NH = {
    12: "winter", 1: "winter", 2: "winter",
    3: "spring", 4: "spring", 5: "spring",
    6: "summer", 7: "summer", 8: "summer",
    9: "autumn", 10: "autumn", 11: "autumn",
}
_SEASON_BY_MONTH_SH = {  # mirrored — SH July = deep winter
    6: "winter", 7: "winter", 8: "winter",
    9: "spring", 10: "spring", 11: "spring",
    12: "summer", 1: "summer", 2: "summer",
    3: "autumn", 4: "autumn", 5: "autumn",
}


def _season_for(month: int, hemisphere: str) -> str:
    return (_SEASON_BY_MONTH_SH if hemisphere == "sh" else _SEASON_BY_MONTH_NH)[month]


def _build_ambience_bed(duration_ms: int, season: str):
    """Return a pydub AudioSegment of `duration_ms` with a subtle,
    season-appropriate ambient texture. Voice will be overlaid on top
    of this bed so nothing drops to true silence."""
    from pydub import AudioSegment
    from pydub.generators import WhiteNoise, Sine

    # Base bed: filtered white noise (approximating brown/pink noise
    # depending on the filter cutoff). Longer chunks avoid audible loops.
    if season == "spring":
        # Bright, airy morning — high-pass filter at 1.5kHz keeps only
        # the "sparkle" band. Very quiet.
        base = WhiteNoise().to_audio_segment(duration=duration_ms).high_pass_filter(1500)
        base = base - 34  # ~ -34 dB
    elif season == "summer":
        # Warm mid-band + faint high-freq shimmer (cricket-suggestive).
        low = WhiteNoise().to_audio_segment(duration=duration_ms).low_pass_filter(3000) - 32
        shimmer = WhiteNoise().to_audio_segment(duration=duration_ms).high_pass_filter(6000) - 40
        base = low.overlay(shimmer)
    elif season == "autumn":
        # Rain-like: broadband noise, gentle low-pass to soften. Slightly
        # louder than the others (rain is naturally "present").
        base = WhiteNoise().to_audio_segment(duration=duration_ms).low_pass_filter(5000) - 30
    else:  # winter
        # Distant-wind: heavily low-passed brown noise. Add a slow LFO
        # amplitude wobble via a low-frequency Sine mixed at very low gain.
        base = WhiteNoise().to_audio_segment(duration=duration_ms).low_pass_filter(500) - 30
        lfo = Sine(0.2).to_audio_segment(duration=duration_ms) - 46
        base = base.overlay(lfo)

    # Fade in/out for a graceful start and finish.
    base = base.fade_in(2000).fade_out(3000)
    return base


def _mix_voice_with_ambience(voice_path: Path, out_path: Path, season: str) -> tuple[float, int]:
    """Read the voice-only MP3, overlay season ambience beneath it, and
    write the final mixed MP3. Returns (duration_s, size_bytes)."""
    from pydub import AudioSegment

    voice = AudioSegment.from_file(voice_path, format="mp3")
    bed = _build_ambience_bed(len(voice), season)
    # Overlay: voice is the top layer, bed sits ~28dB below.
    mixed = bed.overlay(voice)
    mixed.export(out_path, format="mp3", bitrate="96k")
    return len(mixed) / 1000.0, out_path.stat().st_size



def _synthesise_blocks_to_voice_mp3(
    blocks: List[Block], out_path: Path, voice_id: str,
) -> tuple[float, int]:
    """Synthesise each text block via ElevenLabs and stitch with pause_after_s
    silences. Writes a VOICE-ONLY MP3 to `out_path` — ambience is layered in
    a separate step by `_mix_voice_with_ambience`. Returns (duration_s, bytes)."""
    if not ELEVENLABS_KEY:
        raise HTTPException(500, "ELEVENLABS_API_KEY not configured")

    # Lazy imports so backend still starts if pydub/elevenlabs are unavailable.
    from elevenlabs import ElevenLabs, VoiceSettings
    from pydub import AudioSegment

    client = ElevenLabs(api_key=ELEVENLABS_KEY)
    voice_settings = VoiceSettings(
        stability=0.55,
        similarity_boost=0.7,
        style=0.2,
        use_speaker_boost=True,
    )

    stitched = AudioSegment.silent(duration=800)  # 0.8s lead-in
    for block in blocks:
        if not block.text.strip():
            continue
        audio_iter = client.text_to_speech.convert(
            text=block.text,
            voice_id=voice_id,
            model_id=DEFAULT_MODEL_ID,
            voice_settings=voice_settings,
        )
        raw = b"".join(audio_iter)
        seg = AudioSegment.from_file(io.BytesIO(raw), format="mp3")
        stitched += seg
        if block.pause_after_s > 0:
            stitched += AudioSegment.silent(duration=int(block.pause_after_s * 1000))

    stitched += AudioSegment.silent(duration=1200)  # 1.2s tail
    stitched.export(out_path, format="mp3", bitrate="96k")
    return len(stitched) / 1000.0, out_path.stat().st_size


def _sh_month_shift(month: int) -> int:
    """Mirror NH month → SH equivalent (Mar↔Sep etc.)."""
    return ((month - 1 + 6) % 12) + 1


def _require_admin(token: str) -> None:
    if token != ADMIN_TOKEN:
        raise HTTPException(403, "Admin token invalid.")


# ─── Public router factory ──────────────────────────────────────────
def make_router(db):
    router = APIRouter()
    grant_is_active = make_grant_is_active(db)

    async def _member_guard(token: Optional[str]) -> Optional[str]:
        """Returns the token if active-paid, else None. Never raises — callers
        decide whether to gate the response or serve a free preview."""
        if not token:
            return None
        return token if await grant_is_active(token) else None

    async def _fetch(slug: str) -> dict:
        row = await db.calm_variants.find_one({"slug": slug}, {"_id": 0})
        if not row:
            raise HTTPException(404, f"Calm variant '{slug}' not found.")
        return row

    def _current_slug(hemisphere: str) -> str:
        month = datetime.now(timezone.utc).month
        month_name = MONTHS_NH[month - 1][0]
        return f"{month_name}-{hemisphere}"

    # ── Public read endpoints ─────────────────────────────────────
    @router.get("/calm/current")
    async def get_current_calm(hemisphere: str = "nh", access_token: str = ""):
        """Return the current variant for this month + hemisphere."""
        if hemisphere not in ("nh", "sh"):
            raise HTTPException(400, "hemisphere must be 'nh' or 'sh'")
        slug = _current_slug(hemisphere)
        try:
            row = await _fetch(slug)
        except HTTPException:
            return {"slug": slug, "not_yet_authored": True, "hemisphere": hemisphere}
        member = await _member_guard(access_token)
        is_locked = not member and not row.get("is_free_preview")
        # Hide the transcript body behind the paywall — leave the title,
        # season and blurb visible so search engines and free visitors get
        # the flavour without the full script.
        if is_locked:
            row = {**row, "blocks": [], "transcript_display": "", "locked": True}
        return row

    @router.get("/calm/list")
    async def list_all(hemisphere: str = "nh"):
        """Public grid: every variant for a hemisphere, sorted by month."""
        if hemisphere not in ("nh", "sh"):
            raise HTTPException(400, "hemisphere must be 'nh' or 'sh'")
        cursor = db.calm_variants.find(
            {"hemisphere": hemisphere},
            {"_id": 0, "slug": 1, "title": 1, "month": 1, "season_label": 1,
             "audio_generated": 1, "duration_s": 1, "is_free_preview": 1},
        ).sort("month", 1)
        rows = [r async for r in cursor]
        return {"count": len(rows), "items": rows}

    @router.get("/calm/{slug}")
    async def get_by_slug(slug: str, access_token: str = ""):
        row = await _fetch(slug)
        member = await _member_guard(access_token)
        is_locked = not member and not row.get("is_free_preview")
        if is_locked:
            row = {**row, "blocks": [], "transcript_display": "", "locked": True}
        return row

    @router.get("/calm/{slug}/audio.mp3")
    @router.head("/calm/{slug}/audio.mp3")
    async def serve_audio(slug: str, access_token: str = ""):
        row = await _fetch(slug)
        member = await _member_guard(access_token)
        if not member and not row.get("is_free_preview"):
            raise HTTPException(402, "Members-only audio.")
        if not row.get("audio_generated"):
            raise HTTPException(404, "Audio not yet generated for this variant.")
        path = AUDIO_DIR / f"{slug}.mp3"
        if not path.exists():
            raise HTTPException(404, "Audio file missing on disk.")
        return FileResponse(
            path=str(path),
            media_type="audio/mpeg",
            filename=f"patch-and-pot-calm-{slug}.mp3",
            headers={
                # 30 days — MP3s are immutable per slug, we regenerate under
                # a new slug rather than mutating existing audio in place.
                "Cache-Control": "public, max-age=2592000, immutable",
            },
        )

    # ── Admin authoring endpoints ─────────────────────────────────
    @router.post("/admin/calm/author")
    async def author_variant(
        month: int, hemisphere: str, token: str,
        force_reauthor: bool = False,
    ):
        """Generate/regenerate the SCRIPT (Claude), no audio yet. Cheap.
        Sets `audio_generated=False` so the next audio call will render."""
        _require_admin(token)
        if hemisphere not in ("nh", "sh"):
            raise HTTPException(400, "hemisphere must be 'nh' or 'sh'")
        if not (1 <= month <= 12):
            raise HTTPException(400, "month must be 1..12")

        month_name, _, season_label = MONTHS_NH[month - 1]
        # For SH, we relabel the season based on the calendar-mirror month
        # so 'March SH' reads as Early Autumn.
        if hemisphere == "sh":
            _, _, season_label = MONTHS_NH[_sh_month_shift(month) - 1]

        slug = f"{month_name}-{hemisphere}"
        existing = await db.calm_variants.find_one({"slug": slug}, {"_id": 0})
        if existing and not force_reauthor:
            return {"ok": True, "already_exists": True, "slug": slug}

        api_key = os.environ.get("EMERGENT_LLM_KEY", "")
        if not api_key:
            raise HTTPException(500, "EMERGENT_LLM_KEY not configured")

        script = await author_calm_script(month_name, month, hemisphere, season_label, api_key)
        blocks = [Block(**b) for b in script.get("blocks", [])]
        if not blocks:
            raise HTTPException(500, "Script came back empty.")

        now = datetime.now(timezone.utc).isoformat()
        doc = {
            "slug": slug,
            "month": month,
            "hemisphere": hemisphere,
            "season_label": season_label,
            "title": script.get("title", f"{season_label} Calm"),
            "blocks": [b.model_dump() for b in blocks],
            "transcript_display": script.get("transcript_display", ""),
            "audio_generated": False,
            "duration_s": None,
            "audio_size_bytes": None,
            "is_free_preview": slug in FREE_PREVIEW_SLUGS,
            "created_at": (existing or {}).get("created_at", now),
            "updated_at": now,
        }
        await db.calm_variants.update_one(
            {"slug": slug}, {"$set": doc}, upsert=True,
        )
        return {"ok": True, "slug": slug, "blocks_count": len(blocks)}

    @router.post("/admin/calm/render")
    async def render_audio(slug: str, token: str, voice_id: Optional[str] = None):
        """Full render pipeline: (1) synthesise voice via ElevenLabs into
        `{slug}.voice.mp3`, (2) mix in season-matched ambience bed and
        write the final `{slug}.mp3`. Blocking, ~30–60s per 2-min audio."""
        _require_admin(token)
        row = await _fetch(slug)
        blocks = [Block(**b) for b in row.get("blocks", [])]
        if not blocks:
            raise HTTPException(400, "No blocks on this variant — author first.")

        voice_path = AUDIO_DIR / f"{slug}.voice.mp3"
        final_path = AUDIO_DIR / f"{slug}.mp3"
        _synthesise_blocks_to_voice_mp3(
            blocks, voice_path, voice_id or DEFAULT_VOICE_ID,
        )
        season = _season_for(row["month"], row["hemisphere"])
        duration, size = _mix_voice_with_ambience(voice_path, final_path, season)

        await db.calm_variants.update_one(
            {"slug": slug},
            {"$set": {
                "audio_generated": True,
                "duration_s": round(duration, 2),
                "audio_size_bytes": size,
                "voice_id": voice_id or DEFAULT_VOICE_ID,
                "ambience_season": season,
                "audio_rendered_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        return {"ok": True, "slug": slug, "duration_s": round(duration, 2),
                "size_bytes": size, "ambience_season": season}

    @router.post("/admin/calm/remix")
    async def remix_audio(slug: str, token: str):
        """Remix an EXISTING voice track with (updated) ambience bed —
        no ElevenLabs call, so free and fast. Handy for iterating on the
        bed's EQ/volume without burning credits."""
        _require_admin(token)
        row = await _fetch(slug)
        voice_path = AUDIO_DIR / f"{slug}.voice.mp3"
        final_path = AUDIO_DIR / f"{slug}.mp3"
        if not voice_path.exists():
            raise HTTPException(404, f"No voice track for {slug} — render first.")
        season = _season_for(row["month"], row["hemisphere"])
        duration, size = _mix_voice_with_ambience(voice_path, final_path, season)
        await db.calm_variants.update_one(
            {"slug": slug},
            {"$set": {
                "audio_generated": True,
                "duration_s": round(duration, 2),
                "audio_size_bytes": size,
                "ambience_season": season,
                "audio_rendered_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        return {"ok": True, "slug": slug, "ambience_season": season,
                "duration_s": round(duration, 2), "size_bytes": size}

    @router.delete("/admin/calm/{slug}")
    async def delete_variant(slug: str, token: str):
        _require_admin(token)
        row = await db.calm_variants.find_one({"slug": slug})
        if not row:
            raise HTTPException(404, "not found")
        (AUDIO_DIR / f"{slug}.mp3").unlink(missing_ok=True)
        (AUDIO_DIR / f"{slug}.voice.mp3").unlink(missing_ok=True)
        await db.calm_variants.delete_one({"slug": slug})
        return {"ok": True}

    @router.get("/admin/calm/list")
    async def admin_list(token: str):
        _require_admin(token)
        cursor = db.calm_variants.find({}, {"_id": 0}).sort([("hemisphere", 1), ("month", 1)])
        rows = [r async for r in cursor]
        return {"count": len(rows), "items": rows}

    return router
