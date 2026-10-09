import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Trash2, Download, ArrowLeft, Ear, Eye, Wind, Hand, Apple } from "lucide-react";
import { motion } from "framer-motion";
import { useWellbeingJournal } from "@/hooks/useWellbeingJournal";
import { usePatches } from "@/hooks/usePatches";
import { momentForMonth, WELLBEING_PRINCIPLES } from "@/data/wellbeing";
import {
  SunriseMotif,
  SeedlingMotif,
  HarvestMotif,
  PoppyMotif,
  BeeMotif,
} from "@/components/illustrations/VibrantMotifs";
import PageHero from "@/components/PageHero";
import { useI18n } from "@/i18n";

// Vibrant motif per principle id — replaces the old stroke-only line
// drawings the user described as stale. Each lands on its own colour
// swatch inside the principles band.
const PRINCIPLE_MOTIFS = {
  notice:  SunriseMotif,
  slow:    SeedlingMotif,
  nourish: HarvestMotif,
};

// Colour-blocked tile for each principle so the band itself feels like
// a seasonal strip rather than a row of white cards.
const PRINCIPLE_TILES = {
  notice:  { bg: "bg-moss",       accent: "text-butter",     title: "text-sand", body: "text-sand/85",  swatch: "rgba(207,225,213,0.25)" },
  slow:    { bg: "bg-terracotta", accent: "text-sand",       title: "text-sand", body: "text-sand/90",  swatch: "rgba(247,245,240,0.18)" },
  nourish: { bg: "bg-forest",     accent: "text-butter",     title: "text-sand", body: "text-sand/85",  swatch: "rgba(244,201,107,0.14)" },
};

// Five sensory invitations. Each card lands on its own colour swatch
// (not plain cream) so the whole "Sit and notice" band feels alive.
const SENSE_PROMPTS = [
  { id: "hear",  Icon: Ear,   title_key: "wellbeing.sense.hear.title",  body_key: "wellbeing.sense.hear.body",  tile: "bg-forest text-sand",       dot: "#F4C96B" },
  { id: "see",   Icon: Eye,   title_key: "wellbeing.sense.see.title",   body_key: "wellbeing.sense.see.body",   tile: "bg-sand text-forest",       dot: "#C65D47" },
  { id: "smell", Icon: Wind,  title_key: "wellbeing.sense.smell.title", body_key: "wellbeing.sense.smell.body", tile: "bg-moss text-sand",         dot: "#F4C96B" },
  { id: "touch", Icon: Hand,  title_key: "wellbeing.sense.touch.title", body_key: "wellbeing.sense.touch.body", tile: "bg-terracotta text-sand",   dot: "#F7F5F0" },
  { id: "taste", Icon: Apple, title_key: "wellbeing.sense.taste.title", body_key: "wellbeing.sense.taste.body", tile: "bg-sand text-forest",       dot: "#2D4A22" },
];

// Mood faces + their matching colour swatch so the mood selector feels
// like a cheerful chip rail instead of five grey boxes.
const MOOD_FACES = [
  { face: "😞", color: "#5C6B52" },  // moss
  { face: "🙁", color: "#8A9480" },  // soft moss
  { face: "😐", color: "#CFE1D5" },  // sky
  { face: "🙂", color: "#F4C96B" },  // butter
  { face: "😊", color: "#C65D47" },  // terracotta
];

export default function WellbeingPage() {
  const { entries, today, addEntry, removeEntry } = useWellbeingJournal();
  const { activePatch } = usePatches();
  const { t } = useI18n();

  const month = new Date().getMonth() + 1;
  const moment = momentForMonth(month);
  const [mood, setMood] = useState(today?.mood ?? 3);
  const [note, setNote] = useState(today?.note ?? "");
  const [justSaved, setJustSaved] = useState(false);

  // Re-seed form state when the user switches patch so the form reflects
  // the active patch's existing entry (if any).
  useEffect(() => {
    setMood(today?.mood ?? 3);
    setNote(today?.note ?? "");
    setJustSaved(false);
  }, [activePatch?.id]);

  function save(e) {
    e?.preventDefault();
    addEntry({ mood, note });
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  }

  return (
    <div className="animate-fade-up">
      <PageHero
        variant="terracotta"
        eyebrow={`${t("wellbeing.eyebrow")}${activePatch ? ` · ${activePatch.name}` : ""}`}
        title={t("wellbeing.title")}
        blurb={t("wellbeing.subtitle")}
        Motif={PoppyMotif}
        actions={
          <>
            <Link
              to="/calm"
              data-testid="wellbeing-calm-link"
              className="inline-flex items-center gap-2 py-2.5 px-4 bg-sand text-forest hover:bg-butter transition-colors text-sm font-medium"
              style={{ borderRadius: "9999px" }}
            >
              <span>{t("wellbeing.calm_cta")}</span>
              <span aria-hidden>→</span>
            </Link>
            <Link
              to="/"
              className="text-xs text-sand/80 hover:text-sand underline-offset-4 hover:underline inline-flex items-center gap-1.5 self-center"
              data-testid="wellbeing-back-link"
            >
              <ArrowLeft strokeWidth={1.5} className="w-3.5 h-3.5" />
              {t("wellbeing.back_home")}
            </Link>
          </>
        }
      />

      {/* ── Mindful moment — moss band ──────────────────────────── */}
      <section className="bg-moss text-sand" data-testid="wellbeing-moment">
        <div className="container-narrow py-14 md:py-16 grid md:grid-cols-12 gap-10 items-center">
          <div className="md:col-span-4 flex justify-center md:justify-start">
            <div className="w-32 h-32 md:w-44 md:h-44 rounded-full p-5 bg-sand/10 border border-sand/20 flex items-center justify-center">
              <SunriseMotif />
            </div>
          </div>
          <div className="md:col-span-8">
            <p className="overline" style={{ color: "#F4C96B" }}>
              {t("wellbeing.moment.eyebrow")}
            </p>
            <h2 className="font-serif text-3xl md:text-4xl text-sand mt-3 leading-tight text-balance">
              {t(moment.title_key)}
            </h2>
            <p className="mt-4 text-sand/85 leading-relaxed max-w-2xl">
              {t(moment.body_key)}
            </p>
          </div>
        </div>
      </section>

      {/* ── Sit and notice — colour-blocked sense tiles ────────── */}
      <section className="container-narrow py-14 md:py-16" data-testid="wellbeing-sense">
        <div className="max-w-2xl mb-10">
          <p className="overline">{t("wellbeing.sense.eyebrow")}</p>
          <h2 className="font-serif text-4xl md:text-5xl text-forest mt-3 leading-tight">
            {t("wellbeing.sense.title")}
          </h2>
          <p className="mt-4 text-ink/75 leading-relaxed">
            {t("wellbeing.sense.body")}
          </p>
        </div>
        <ul className="grid md:grid-cols-4 lg:grid-cols-5 gap-4">
          {SENSE_PROMPTS.map(({ id, Icon, title_key, body_key, tile, dot }, i) => (
            <motion.li
              key={id}
              data-testid={`wellbeing-sense-${id}`}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: i * 0.06, ease: [0.2, 0.7, 0.2, 1] }}
              className={`${tile} p-5 flex flex-col gap-3`}
              style={{ borderRadius: "20px" }}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: dot, color: tile.includes("bg-sand") ? "#F7F5F0" : "#2D4A22" }}
              >
                <Icon strokeWidth={1.6} className="w-4 h-4" />
              </div>
              <h3 className="font-serif text-xl leading-tight">{t(title_key)}</h3>
              <p className={`text-sm leading-relaxed ${tile.includes("bg-sand") ? "text-ink/75" : "opacity-90"}`}>
                {t(body_key)}
              </p>
            </motion.li>
          ))}
        </ul>
      </section>

      {/* ── Soul band — forest with poppy motif ─────────────────── */}
      <section className="bg-forest text-sand relative overflow-hidden" data-testid="wellbeing-soul">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(50% 60% at 85% 50%, rgba(198,93,71,0.25), transparent 65%)",
          }}
        />
        <div className="container-narrow py-14 md:py-18 grid md:grid-cols-12 gap-10 items-center relative">
          <div className="md:col-span-8">
            <p className="overline" style={{ color: "#F4C96B" }}>
              {t("wellbeing.soul.eyebrow")}
            </p>
            <h2 className="font-serif text-3xl md:text-5xl text-sand mt-3 leading-[1.05] tracking-tight text-balance">
              {t("wellbeing.soul.title")}
            </h2>
            <p className="mt-5 text-sand/85 leading-relaxed max-w-2xl">
              {t("wellbeing.soul.body")}
            </p>
          </div>
          <div className="md:col-span-4 flex justify-center md:justify-end">
            <div className="w-36 h-36 md:w-48 md:h-48">
              <BeeMotif />
            </div>
          </div>
        </div>
      </section>

      {/* ── Today's check-in — cream reader card (sand base) ────── */}
      <section className="container-narrow py-14 md:py-16" data-testid="wellbeing-checkin">
        <div className="max-w-2xl mb-8">
          <p className="overline">{t("wellbeing.checkin.eyebrow")}</p>
          <h2 className="font-serif text-4xl md:text-5xl text-forest mt-3 leading-tight">
            {t("wellbeing.checkin.title")}
          </h2>
        </div>

        <form
          onSubmit={save}
          className="bg-surface border border-border p-6 md:p-8 space-y-6"
          style={{ borderRadius: "20px" }}
        >
          <div>
            <label className="text-sm text-ink/75 block mb-3">
              {t("wellbeing.checkin.mood_label")}
            </label>
            <div className="flex gap-2 md:gap-3" role="radiogroup" data-testid="wellbeing-mood-group">
              {MOOD_FACES.map(({ face, color }, i) => {
                const value = i + 1;
                const active = mood === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setMood(value)}
                    data-testid={`wellbeing-mood-${value}`}
                    className={`text-3xl md:text-4xl w-14 h-14 md:w-16 md:h-16 flex items-center justify-center transition-all ${
                      active ? "scale-110 shadow-md" : "opacity-60 hover:opacity-100"
                    }`}
                    style={{
                      background: active ? color : "#F7F5F0",
                      border: active ? `2px solid ${color}` : "1px solid rgba(45,74,34,0.18)",
                      borderRadius: "16px",
                    }}
                  >
                    {face}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="wellbeing-note" className="text-sm text-ink/75 block mb-3">
              {t("wellbeing.checkin.note_label")}
            </label>
            <textarea
              id="wellbeing-note"
              data-testid="wellbeing-note-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={280}
              rows={3}
              placeholder={t("wellbeing.checkin.note_placeholder")}
              className="w-full px-3 py-2 bg-sand border border-border focus:border-terracotta focus:outline-none text-sm leading-relaxed"
              style={{ borderRadius: "12px" }}
            />
            <p className="mt-1 text-xs text-moss text-right">{note.length}/280</p>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="submit"
              data-testid="wellbeing-save"
              className="btn-terracotta inline-flex items-center gap-2"
              style={{ borderRadius: "9999px" }}
            >
              <Heart strokeWidth={1.5} className="w-4 h-4" />
              {today ? t("wellbeing.checkin.update") : t("wellbeing.checkin.save")}
            </button>
            {justSaved && (
              <span className="text-sm text-forest" data-testid="wellbeing-saved-flag">
                {t("wellbeing.checkin.saved")}
              </span>
            )}
          </div>
        </form>
      </section>

      {/* ── Three principles — colour-blocked tile row ──────────── */}
      <section className="container-narrow pb-14 md:pb-16">
        <div className="max-w-2xl mb-8">
          <p className="overline">{t("wellbeing.principles.eyebrow")}</p>
          <h2 className="font-serif text-4xl md:text-5xl text-forest mt-3 leading-tight">
            {t("wellbeing.principles.title")}
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5" data-testid="wellbeing-principles">
          {WELLBEING_PRINCIPLES.map((p, i) => {
            const Motif = PRINCIPLE_MOTIFS[p.id];
            const tile = PRINCIPLE_TILES[p.id] || PRINCIPLE_TILES.notice;
            return (
              <motion.article
                key={p.id}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: [0.2, 0.7, 0.2, 1] }}
                className={`${tile.bg} p-6 md:p-7 relative overflow-hidden`}
                style={{ borderRadius: "20px" }}
              >
                <div
                  className="w-20 h-20 mb-5 rounded-full p-3 flex items-center justify-center"
                  style={{ background: tile.swatch }}
                >
                  {Motif ? <Motif /> : null}
                </div>
                <p className={`overline ${tile.accent}`} style={{ color: tile.accent === "text-butter" ? "#F4C96B" : undefined }}>
                  0{i + 1}
                </p>
                <h3 className={`font-serif text-2xl md:text-3xl ${tile.title} mt-2 leading-snug text-balance`}>
                  {t(p.title_key)}
                </h3>
                <p className={`text-sm leading-relaxed mt-3 ${tile.body}`}>
                  {t(p.body_key)}
                </p>
              </motion.article>
            );
          })}
        </div>
      </section>

      {/* ── History ─────────────────────────────────────────────── */}
      {entries.length > 0 && (
        <section className="container-narrow pb-16 md:pb-20" data-testid="wellbeing-history">
          <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
            <div>
              <p className="overline">{t("wellbeing.history.eyebrow")}</p>
              <h2 className="font-serif text-3xl md:text-4xl text-forest mt-3">
                {t("wellbeing.history.title")}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              data-testid="wellbeing-print"
              className="btn-ghost inline-flex items-center gap-2 print:hidden"
              style={{ borderRadius: "9999px" }}
            >
              <Download strokeWidth={1.5} className="w-4 h-4" />
              {t("wellbeing.history.print")}
            </button>
          </div>
          <ul className="space-y-3">
            {entries.map((e, i) => {
              const face = MOOD_FACES[e.mood - 1] || MOOD_FACES[2];
              return (
                <motion.li
                  key={e.date}
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3) }}
                  className="bg-surface border border-border p-4 flex items-start gap-4"
                  style={{ borderRadius: "16px", borderLeft: `6px solid ${face.color}` }}
                  data-testid={`wellbeing-entry-${e.date}`}
                >
                  <span
                    className="text-3xl flex-shrink-0 w-12 h-12 flex items-center justify-center"
                    style={{ background: `${face.color}22`, borderRadius: "12px" }}
                    aria-hidden
                  >
                    {face.face}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-moss uppercase tracking-wider">
                      {new Date(e.date).toLocaleDateString(undefined, {
                        weekday: "long", year: "numeric", month: "long", day: "numeric",
                      })}
                    </p>
                    {e.note && (
                      <p className="mt-1.5 text-sm text-ink/85 leading-relaxed whitespace-pre-wrap">
                        {e.note}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeEntry(e.date)}
                    data-testid={`wellbeing-entry-delete-${e.date}`}
                    className="text-moss hover:text-terracotta print:hidden"
                    aria-label={t("wellbeing.history.delete")}
                  >
                    <Trash2 strokeWidth={1.5} className="w-4 h-4" />
                  </button>
                </motion.li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
