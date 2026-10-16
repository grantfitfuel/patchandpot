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
import asyncio
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
from core import make_grant_is_active, _enforce_budget_or_503
from routers.admin._shared import require_admin as _require_admin

logger = logging.getLogger(__name__)

AUDIO_DIR = Path("/app/backend/data/calm")
AUDIO_DIR.mkdir(parents=True, exist_ok=True)
SAMPLES_DIR = AUDIO_DIR / "samples"
SAMPLES_DIR.mkdir(parents=True, exist_ok=True)

# The line every voice sample says. Short, sensory, and characteristic
# of the actual meditation delivery so members can judge the fit.
VOICE_SAMPLE_TEXT = "Take a slow breath in, and settle where you are."

ADMIN_TOKEN = None  # (removed) — auth via `require_admin` from routers.admin._shared,
#                    which reads ADMIN_TOKEN from env and fails closed if unset.
ELEVENLABS_KEY = os.environ.get("ELEVENLABS_API_KEY", "")

# Two curated voices. Members pick between them on the /calm page and
# the choice is persisted in localStorage. Both are middle-aged British
# so they pair well with Patch & Pot's overall voice, but they differ
# in gender/timbre so the choice matters.
VOICES = {
    "lily": {
        "voice_id": "pFZP5JQG7iQjIQuC4Bku",
        "label": "Lily",
        "accent": "British female",
        "tagline": "Velvety and unhurried — the original P&P narrator.",
    },
    "george": {
        "voice_id": "JBFqnCBsd6RMkjVDRZzb",
        "label": "George",
        "accent": "British male",
        "tagline": "Warm and steady — like a friend at the potting bench.",
    },
    "clyde": {
        "voice_id": "2EiwWnXFnvU5JabPnv8n",
        "label": "Clyde",
        "accent": "American male",
        "tagline": "Deep Southern baritone — think back-porch storyteller.",
    },
    "nicole": {
        "voice_id": "piTKgcLEGmPE4e6mEKli",
        "label": "Nicole",
        "accent": "American female",
        "tagline": "Whispery and dreamlike — a lullaby for the garden.",
    },
    "daisy": {
        "voice_id": "3eeY9rFz1akxkQTWoYXs",
        "label": "Daisy",
        "accent": "Scottish female",
        "tagline": "Young, lilting Scots — a walk through misty glens.",
    },
    "robert": {
        "voice_id": "U5UjeJMsOvyhYhXfZdvZ",
        "label": "Robert",
        "accent": "Scottish male",
        "tagline": "Deep, gravelly Highlander — clan-elder around the fire.",
    },
}
DEFAULT_VOICE_KEY = "lily"


def _voice_id_for(key: str) -> str:
    return VOICES.get(key, VOICES[DEFAULT_VOICE_KEY])["voice_id"]


def _voice_key(key: Optional[str]) -> str:
    """Normalise / validate the voice choice — anything unrecognised
    silently falls back to Lily so old clients keep working."""
    return key if key in VOICES else DEFAULT_VOICE_KEY


def _audio_file(slug: str, voice_key: str, kind: str) -> Path:
    """Path helper. Lily is the default and its files use the plain
    naming (`{slug}.mp3`) for backwards compatibility with content
    rendered in earlier iterations. Any other voice namespaces its
    files under `{slug}.{voice_key}.mp3`."""
    if voice_key == DEFAULT_VOICE_KEY:
        return AUDIO_DIR / (f"{slug}.voice.mp3" if kind == "voice" else f"{slug}.mp3")
    return AUDIO_DIR / (
        f"{slug}.{voice_key}.voice.mp3" if kind == "voice" else f"{slug}.{voice_key}.mp3"
    )


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

FREE_PREVIEW_SLUGS = {"march-nh-w1", "september-sh-w1"}  # first week of early spring in each hemisphere
WEEKS_PER_MONTH = 4  # w1..w4 — day-of-month-clamped rotation


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
short, mindful breathing scripts for gardeners — the kind read softly during
a garden pause. Tone: gentle, sensory, seasonally specific, never
clinical or crystal-woo. Reference the actual garden (soil, light, birds,
scent) not abstract 'nature'. Never use the words 'journey', 'divine',
'energy', 'vibration'.

STRICT LENGTH RULES — final total duration (spoken + pauses) MUST land
between 100 and 150 seconds. Follow every constraint:

- BLOCK COUNT: exactly 10 to 14 blocks. NEVER more than 14.
- BLOCK LENGTH: each block 6 to 14 words, one thought.
- PAUSE VALUES: total of all `pause_after_s` across the whole script
  MUST sum to between 55 and 85 seconds. NEVER over 90.
- Typical pause values: 4–8 s. Reserve 8–12 s for the exhale-count line
  and one or two silence beats. The final block should end with a 6–10 s
  pause (not longer — the ambience carries the tail).

BREATHING PATTERN — include ONE simple pattern per script:
    · Inhale 4, exhale 6
    · Inhale 4, hold 2, exhale 6
    · Inhale 4, exhale 8
Guide the listener through 2–4 breath cycles at that pattern.

OUTPUT FORMAT — return ONLY minified JSON, no markdown fences:
{
  "title": "Warm Evenings",
  "blocks": [
    {"text": "Find a comfortable seat. Let your shoulders soften.", "pause_after_s": 5},
    {"text": "Notice the late amber light.", "pause_after_s": 6},
    ...
  ],
  "transcript_display": "Full pretty transcript with timestamps like
    '[00:00]' at the start of each block. Include the breathing pattern
    line between blocks where relevant."
}
"""


async def author_calm_script(
    month_name: str, month_num: int, hemisphere: str, season_label: str,
    week: int, api_key: str,
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
    week_stage = {
        1: ("start-of-month",
            "the first days of the month — earliest signs, tentative openings, "
            "quiet edges of change"),
        2: ("mid-early-month",
            "the second week of the month — the season taking hold, movement "
            "becoming visible"),
        3: ("mid-late-month",
            "the third week of the month — the season at its middle depth, "
            "settled into its character"),
        4: ("end-of-month",
            "the closing days of the month — the season fully expressed, "
            "beginning to hint at what comes next"),
    }[week]
    payload = (
        f"MONTH: {month_name.title()} (#{month_num})\n"
        f"HEMISPHERE: {hemi_label}\n"
        f"SEASON: {season_label}\n"
        f"WEEK-STAGE: Week {week} of {WEEKS_PER_MONTH} — {week_stage[0]}: "
        f"{week_stage[1]}.\n"
        f"REGIONAL HINT: {hemi_hint}\n\n"
        "Write the script now. Anchor 2–3 sensory details specific to THIS "
        "week-stage — a Week 4 script must feel materially different from "
        "the same month's Week 1 (crocus tips vs. crocus fully open, first "
        "green shoots vs. beds filling in, etc.). Return ONLY the JSON."
    )
    chat = LlmChat(
        api_key=api_key,
        session_id=f"calm-{month_name}-{hemisphere}-w{week}",
        system_message=_SCRIPT_SYSTEM_PROMPT,
    )
    chat.with_model("anthropic", "claude-sonnet-5-5")
    chat.with_params(max_tokens=8000)
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


def _slow_voice(voice, factor: float = 0.94):
    """Slow the voice track by `factor` while preserving pitch reasonably.
    Pydub doesn't ship a phase vocoder, so we approximate: change the
    reported frame rate (which slows AND drops pitch), then resample
    back to the original rate. Result: same duration change, near-
    original pitch (a very slight deepening remains, which reads as
    'more resonant / measured' — actually welcome for meditation).

    factor 0.94 = ~6.4% slower delivery, which lands the "considered"
    feel without sounding sedated."""
    if factor >= 0.999:
        return voice
    original_rate = voice.frame_rate
    slowed = voice._spawn(voice.raw_data, overrides={
        "frame_rate": int(original_rate * factor),
    })
    return slowed.set_frame_rate(original_rate)


def _mix_voice_with_ambience(voice_path: Path, out_path: Path, season: str) -> tuple[float, int]:
    """Read the voice-only MP3, apply a gentle slow-down for meditation
    pacing, overlay season ambience beneath, and write the final mixed
    MP3. Returns (duration_s, size_bytes)."""
    from pydub import AudioSegment

    voice = AudioSegment.from_file(voice_path, format="mp3")
    voice = _slow_voice(voice, factor=0.94)
    bed = _build_ambience_bed(len(voice), season)
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
        # Higher stability + lower style = calmer, more measured delivery
        # (less prosodic variation, better for meditation).
        stability=0.72,
        similarity_boost=0.72,
        style=0.15,
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
        now = datetime.now(timezone.utc)
        month_name = MONTHS_NH[now.month - 1][0]
        # Week 1-4 based on day-of-month (days 1-7 → w1, 8-14 → w2, 15-21
        # → w3, everything from 22 onward → w4). Months with a "5th week"
        # fold into w4 so we never end up on an unrendered slug.
        week = min(((now.day - 1) // 7) + 1, WEEKS_PER_MONTH)
        return f"{month_name}-{hemisphere}-w{week}"

    # ── Public read endpoints ─────────────────────────────────────
    @router.get("/calm/voices")
    async def list_voices():
        """Public — the two curated voice options for the /calm player.
        Includes a `slugs_ready` array per voice so the picker can hide
        or disable options that haven't been rendered for the currently
        selected slug. `sample_url` is the ~6s narrated sample so
        members can preview before committing to a full session."""
        cursor = db.calm_variants.find({}, {"_id": 0, "slug": 1, "voices": 1, "audio_generated": 1})
        per_voice_ready: dict = {vk: [] for vk in VOICES}
        async for r in cursor:
            for vk in VOICES:
                if vk == DEFAULT_VOICE_KEY:
                    if r.get("audio_generated") or (r.get("voices", {}).get(vk, {}) or {}).get("audio_generated"):
                        per_voice_ready[vk].append(r["slug"])
                else:
                    if (r.get("voices", {}).get(vk, {}) or {}).get("audio_generated"):
                        per_voice_ready[vk].append(r["slug"])
        return {
            "default": DEFAULT_VOICE_KEY,
            "voices": [
                {
                    "key": vk,
                    "label": v["label"],
                    "accent": v.get("accent", ""),
                    "tagline": v.get("tagline", ""),
                    "slugs_ready": per_voice_ready[vk],
                    "sample_ready": (SAMPLES_DIR / f"{vk}.sample.mp3").exists(),
                    "sample_url": f"/api/calm/voices/{vk}/sample.mp3",
                }
                for vk, v in VOICES.items()
            ],
        }

    @router.get("/calm/voices/{voice_key}/sample.mp3")
    @router.head("/calm/voices/{voice_key}/sample.mp3")
    async def serve_voice_sample(voice_key: str):
        """Serve the ~6s narrated sample for a voice. Public (no
        paywall) — this IS the "try before you buy" preview."""
        voice_key = _voice_key(voice_key)
        path = SAMPLES_DIR / f"{voice_key}.sample.mp3"
        if not path.exists():
            raise HTTPException(404, "Sample not yet rendered.")
        return FileResponse(
            path=str(path),
            media_type="audio/mpeg",
            filename=f"patch-and-pot-calm-sample-{voice_key}.mp3",
            headers={"Cache-Control": "public, max-age=2592000, immutable"},
        )

    @router.post("/admin/calm/render-sample")
    async def render_voice_sample(voice: str, token: str):
        """Author-side: render a ~6s spoken sample of VOICE_SAMPLE_TEXT
        for the given voice key. Costs a trivial ElevenLabs credit
        (single short synthesis, no ambience/mix)."""
        _require_admin(token)
        voice_key = _voice_key(voice)
        out_path = SAMPLES_DIR / f"{voice_key}.sample.mp3"
        _enforce_budget_or_503()
        # Single-block synthesis: reuse the block pipeline with one entry
        # + no trailing pause. The 6s target follows naturally from the
        # sample text length.
        sample_block = [Block(text=VOICE_SAMPLE_TEXT, pause_after_s=0)]
        _synthesise_blocks_to_voice_mp3(
            sample_block, out_path, _voice_id_for(voice_key),
        )
        return {"ok": True, "voice": voice_key, "size_bytes": out_path.stat().st_size}

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
        """Public grid: every variant for a hemisphere, sorted by month then
        week. Each item includes month, week, season_label, is_free_preview
        and audio_generated so the picker can render + gate accordingly."""
        if hemisphere not in ("nh", "sh"):
            raise HTTPException(400, "hemisphere must be 'nh' or 'sh'")
        cursor = db.calm_variants.find(
            {"hemisphere": hemisphere},
            {"_id": 0, "slug": 1, "title": 1, "month": 1, "week": 1,
             "season_label": 1, "audio_generated": 1, "duration_s": 1,
             "is_free_preview": 1, "voices": 1},
        ).sort([("month", 1), ("week", 1)])
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
    async def serve_audio(slug: str, access_token: str = "", voice: Optional[str] = None):
        row = await _fetch(slug)
        member = await _member_guard(access_token)
        if not member and not row.get("is_free_preview"):
            raise HTTPException(402, "Members-only audio.")
        voice_key = _voice_key(voice)
        # If the requested voice hasn't been rendered yet for this slug,
        # transparently fall back to Lily so members never see a broken
        # player. The frontend also disables voice-picker options that
        # aren't ready for the current slug.
        path = _audio_file(slug, voice_key, "final")
        if not path.exists():
            voice_key = DEFAULT_VOICE_KEY
            path = _audio_file(slug, voice_key, "final")
        if not path.exists():
            raise HTTPException(404, "Audio file missing on disk.")
        return FileResponse(
            path=str(path),
            media_type="audio/mpeg",
            filename=f"patch-and-pot-calm-{slug}-{voice_key}.mp3",
            headers={
                "Cache-Control": "public, max-age=2592000, immutable",
            },
        )

    # ── Admin authoring endpoints ─────────────────────────────────
    @router.post("/admin/calm/author")
    async def author_variant(
        month: int, hemisphere: str, token: str,
        week: int = 1, force_reauthor: bool = False,
    ):
        """Generate/regenerate the SCRIPT (Claude), no audio yet. Cheap.
        `week` (1-4) picks which weekly variant within the month. Weeks
        are progression stages: w1=start of month, w4=end — Claude is
        told which stage to write for so anchors evolve week-to-week."""
        _require_admin(token)
        if hemisphere not in ("nh", "sh"):
            raise HTTPException(400, "hemisphere must be 'nh' or 'sh'")
        if not (1 <= month <= 12):
            raise HTTPException(400, "month must be 1..12")
        if not (1 <= week <= WEEKS_PER_MONTH):
            raise HTTPException(400, f"week must be 1..{WEEKS_PER_MONTH}")

        month_name, _, season_label = MONTHS_NH[month - 1]
        if hemisphere == "sh":
            _, _, season_label = MONTHS_NH[_sh_month_shift(month) - 1]

        slug = f"{month_name}-{hemisphere}-w{week}"
        existing = await db.calm_variants.find_one({"slug": slug}, {"_id": 0})
        if existing and not force_reauthor:
            return {"ok": True, "already_exists": True, "slug": slug}

        api_key = os.environ.get("EMERGENT_LLM_KEY", "")
        if not api_key:
            raise HTTPException(500, "EMERGENT_LLM_KEY not configured")
        _enforce_budget_or_503()

        script = await author_calm_script(
            month_name, month, hemisphere, season_label, week, api_key,
        )
        blocks = [Block(**b) for b in script.get("blocks", [])]
        if not blocks:
            raise HTTPException(500, "Script came back empty.")

        now = datetime.now(timezone.utc).isoformat()
        doc = {
            "slug": slug,
            "month": month,
            "week": week,
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
    async def render_audio(slug: str, token: str, voice: Optional[str] = None):
        """Full render pipeline: (1) synthesise voice via ElevenLabs into
        the voice-only MP3, (2) mix in season-matched ambience bed and
        write the final MP3. `voice` picks between the curated Voice keys
        (`lily`, `george`). Blocking, ~30–60s per 2-min audio, but run
        in a threadpool so the FastAPI event loop stays responsive for
        other requests (list/current/serve) while a render is in flight."""
        _require_admin(token)
        voice_key = _voice_key(voice)
        row = await _fetch(slug)
        blocks = [Block(**b) for b in row.get("blocks", [])]
        if not blocks:
            raise HTTPException(400, "No blocks on this variant — author first.")
        # Guard the paid ElevenLabs spend behind the same daily budget
        # circuit-breaker used elsewhere in the app — a leaked admin
        # token can no longer drain credits indefinitely.
        _enforce_budget_or_503()

        voice_path = _audio_file(slug, voice_key, "voice")
        final_path = _audio_file(slug, voice_key, "final")
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            _synthesise_blocks_to_voice_mp3,
            blocks, voice_path, _voice_id_for(voice_key),
        )
        season = _season_for(row["month"], row["hemisphere"])
        duration, size = await loop.run_in_executor(
            None, _mix_voice_with_ambience, voice_path, final_path, season,
        )

        # Track per-voice render state in a nested dict so the primary
        # `audio_generated` flag remains truthy whenever Lily (default)
        # is ready. UI shows a matrix per row.
        voices_state = dict(row.get("voices", {}))
        voices_state[voice_key] = {
            "audio_generated": True,
            "duration_s": round(duration, 2),
            "audio_size_bytes": size,
            "rendered_at": datetime.now(timezone.utc).isoformat(),
        }
        update: dict = {
            "voices": voices_state,
            "ambience_season": season,
        }
        if voice_key == DEFAULT_VOICE_KEY:
            # Keep legacy top-level fields in sync for Lily (default).
            update.update({
                "audio_generated": True,
                "duration_s": round(duration, 2),
                "audio_size_bytes": size,
                "voice_id": _voice_id_for(voice_key),
                "audio_rendered_at": datetime.now(timezone.utc).isoformat(),
            })
        await db.calm_variants.update_one({"slug": slug}, {"$set": update})
        return {"ok": True, "slug": slug, "voice": voice_key,
                "duration_s": round(duration, 2), "size_bytes": size,
                "ambience_season": season}

    @router.post("/admin/calm/remix")
    async def remix_audio(slug: str, token: str, voice: Optional[str] = None):
        """Remix an EXISTING voice track with (updated) ambience bed —
        no ElevenLabs call, so free and fast."""
        _require_admin(token)
        voice_key = _voice_key(voice)
        row = await _fetch(slug)
        voice_path = _audio_file(slug, voice_key, "voice")
        final_path = _audio_file(slug, voice_key, "final")
        if not voice_path.exists():
            raise HTTPException(404, f"No {voice_key} voice track for {slug}.")
        season = _season_for(row["month"], row["hemisphere"])
        duration, size = _mix_voice_with_ambience(voice_path, final_path, season)

        voices_state = dict(row.get("voices", {}))
        voices_state.setdefault(voice_key, {})
        voices_state[voice_key].update({
            "audio_generated": True,
            "duration_s": round(duration, 2),
            "audio_size_bytes": size,
            "rendered_at": datetime.now(timezone.utc).isoformat(),
        })
        update: dict = {"voices": voices_state, "ambience_season": season}
        if voice_key == DEFAULT_VOICE_KEY:
            update.update({
                "audio_generated": True,
                "duration_s": round(duration, 2),
                "audio_size_bytes": size,
                "audio_rendered_at": datetime.now(timezone.utc).isoformat(),
            })
        await db.calm_variants.update_one({"slug": slug}, {"$set": update})
        return {"ok": True, "slug": slug, "voice": voice_key,
                "ambience_season": season, "duration_s": round(duration, 2),
                "size_bytes": size}

    @router.delete("/admin/calm/{slug}")
    async def delete_variant(slug: str, token: str):
        _require_admin(token)
        row = await db.calm_variants.find_one({"slug": slug})
        if not row:
            raise HTTPException(404, "not found")
        for vk in VOICES:
            _audio_file(slug, vk, "voice").unlink(missing_ok=True)
            _audio_file(slug, vk, "final").unlink(missing_ok=True)
        await db.calm_variants.delete_one({"slug": slug})
        return {"ok": True}

    @router.get("/admin/calm/list")
    async def admin_list(token: str):
        _require_admin(token)
        cursor = db.calm_variants.find({}, {"_id": 0}).sort([("hemisphere", 1), ("month", 1)])
        rows = [r async for r in cursor]
        return {"count": len(rows), "items": rows}

    return router
