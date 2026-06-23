import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Trash2, Sprout, Download, ArrowLeft, Ear, Eye, Wind, Hand, Apple } from "lucide-react";
import { useWellbeingJournal } from "@/hooks/useWellbeingJournal";
import { usePatches } from "@/hooks/usePatches";
import { momentForMonth, WELLBEING_PRINCIPLES } from "@/data/wellbeing";
import { useI18n } from "@/i18n";

const MOOD_FACES = ["😞", "🙁", "😐", "🙂", "😊"];

// Five sensory invitations. Each card encourages the user to spend a
// minute sitting in their patch and noticing one specific kind of life.
// The icons map onto the senses; copy comes from i18n so all 58 locales
// pick it up.
const SENSE_PROMPTS = [
  { id: "hear",  Icon: Ear,    title_key: "wellbeing.sense.hear.title",  body_key: "wellbeing.sense.hear.body"  },
  { id: "see",   Icon: Eye,    title_key: "wellbeing.sense.see.title",   body_key: "wellbeing.sense.see.body"   },
  { id: "smell", Icon: Wind,   title_key: "wellbeing.sense.smell.title", body_key: "wellbeing.sense.smell.body" },
  { id: "touch", Icon: Hand,   title_key: "wellbeing.sense.touch.title", body_key: "wellbeing.sense.touch.body" },
  { id: "taste", Icon: Apple,  title_key: "wellbeing.sense.taste.title", body_key: "wellbeing.sense.taste.body" },
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

  // When the user switches active patch, useWellbeingJournal re-loads
  // entries and `today` re-derives. Re-seed the local form state to
  // match — otherwise the form keeps the previous patch's mood/note and
  // the "Update today's check-in" label can lie. We watch the patch id
  // (not `today` itself) so local edits don't get clobbered while a user
  // is mid-form.
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
    <div className="container-narrow py-12 md:py-16 animate-fade-up">
      <header className="mb-12">
        <Link
          to="/"
          className="text-xs text-moss hover:text-forest underline-offset-4 hover:underline inline-flex items-center gap-1.5 mb-4"
          data-testid="wellbeing-back-link"
        >
          <ArrowLeft strokeWidth={1.5} className="w-3.5 h-3.5" />
          {t("wellbeing.back_home")}
        </Link>
        <p className="overline">{t("wellbeing.eyebrow")}{activePatch ? ` · ${activePatch.name}` : ""}</p>
        <h1 className="font-serif text-5xl md:text-6xl text-forest mt-3 tracking-tight">
          {t("wellbeing.title")}
        </h1>
        <p className="mt-4 text-ink/75 max-w-xl leading-relaxed">
          {t("wellbeing.subtitle")}
        </p>
      </header>

      {/* Mindful moment */}
      <section
        className="card-flat p-8 md:p-10 mb-12 bg-sand/40 border-l-4 border-terracotta"
        data-testid="wellbeing-moment"
      >
        <p className="overline">{t("wellbeing.moment.eyebrow")}</p>
        <h2 className="font-serif text-3xl md:text-4xl text-forest mt-3 leading-tight">
          {t(moment.title_key)}
        </h2>
        <p className="mt-4 text-ink/75 leading-relaxed max-w-2xl">
          {t(moment.body_key)}
        </p>
      </section>

      {/* Sit and notice — sensory immersion. The whole point of having a
          patch is the chance to BE in it. Five small sensory invitations,
          one per sense, that the user can practise in any week of the year. */}
      <section className="mb-16" data-testid="wellbeing-sense">
        <div className="max-w-2xl mb-8">
          <p className="overline">{t("wellbeing.sense.eyebrow")}</p>
          <h2 className="font-serif text-3xl md:text-4xl text-forest mt-3 leading-tight">
            {t("wellbeing.sense.title")}
          </h2>
          <p className="mt-4 text-ink/75 leading-relaxed">
            {t("wellbeing.sense.body")}
          </p>
        </div>
        <ul className="grid md:grid-cols-2 gap-5">
          {SENSE_PROMPTS.map(({ id, Icon, title_key, body_key }) => (
            <li
              key={id}
              data-testid={`wellbeing-sense-${id}`}
              className="card-flat p-6 flex gap-4"
            >
              <Icon strokeWidth={1.4} className="w-6 h-6 text-terracotta flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-serif text-lg text-forest mb-1.5">{t(title_key)}</h3>
                <p className="text-sm text-ink/75 leading-relaxed">{t(body_key)}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Soul band — the deeper "why". Patch & Pot is about more than food. */}
      <section
        className="mb-16 bg-forest/5 border border-forest/15 p-8 md:p-10"
        data-testid="wellbeing-soul"
      >
        <p className="overline">{t("wellbeing.soul.eyebrow")}</p>
        <h2 className="font-serif text-3xl md:text-4xl text-forest mt-3 leading-tight max-w-2xl">
          {t("wellbeing.soul.title")}
        </h2>
        <p className="mt-4 text-ink/75 leading-relaxed max-w-2xl">
          {t("wellbeing.soul.body")}
        </p>
      </section>

      {/* Today's check-in */}
      <section className="mb-16" data-testid="wellbeing-checkin">
        <p className="overline">{t("wellbeing.checkin.eyebrow")}</p>
        <h2 className="font-serif text-3xl text-forest mt-3 mb-6">
          {t("wellbeing.checkin.title")}
        </h2>

        <form onSubmit={save} className="card-flat p-6 md:p-8 space-y-6">
          <div>
            <label className="text-sm text-ink/75 block mb-3">
              {t("wellbeing.checkin.mood_label")}
            </label>
            <div className="flex gap-2 md:gap-3" role="radiogroup" data-testid="wellbeing-mood-group">
              {MOOD_FACES.map((face, i) => {
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
                    className={`text-3xl md:text-4xl w-12 h-12 md:w-14 md:h-14 flex items-center justify-center border transition-all ${
                      active
                        ? "border-terracotta bg-sand scale-110"
                        : "border-border opacity-60 hover:opacity-100"
                    }`}
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
              className="w-full px-3 py-2 bg-surface border border-border focus:border-terracotta focus:outline-none text-sm leading-relaxed"
            />
            <p className="mt-1 text-xs text-moss text-right">{note.length}/280</p>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="submit"
              data-testid="wellbeing-save"
              className="btn-terracotta inline-flex items-center gap-2"
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

      {/* Three principles */}
      <section className="mb-16">
        <p className="overline">{t("wellbeing.principles.eyebrow")}</p>
        <h2 className="font-serif text-3xl text-forest mt-3 mb-6">
          {t("wellbeing.principles.title")}
        </h2>
        <div className="grid md:grid-cols-3 gap-6" data-testid="wellbeing-principles">
          {WELLBEING_PRINCIPLES.map((p) => (
            <article key={p.id} className="card-flat p-6">
              <Sprout strokeWidth={1.4} className="w-5 h-5 text-terracotta mb-3" />
              <h3 className="font-serif text-xl text-forest mb-2">{t(p.title_key)}</h3>
              <p className="text-sm text-ink/75 leading-relaxed">{t(p.body_key)}</p>
            </article>
          ))}
        </div>
      </section>

      {/* History */}
      {entries.length > 0 && (
        <section data-testid="wellbeing-history">
          <div className="flex items-end justify-between mb-6">
            <div>
              <p className="overline">{t("wellbeing.history.eyebrow")}</p>
              <h2 className="font-serif text-3xl text-forest mt-3">
                {t("wellbeing.history.title")}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              data-testid="wellbeing-print"
              className="btn-ghost inline-flex items-center gap-2 print:hidden"
            >
              <Download strokeWidth={1.5} className="w-4 h-4" />
              {t("wellbeing.history.print")}
            </button>
          </div>
          <ul className="space-y-3">
            {entries.map((e) => (
              <li
                key={e.date}
                className="card-flat p-4 flex items-start gap-4"
                data-testid={`wellbeing-entry-${e.date}`}
              >
                <span className="text-3xl flex-shrink-0" aria-hidden>
                  {MOOD_FACES[e.mood - 1]}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-moss">
                    {new Date(e.date).toLocaleDateString(undefined, {
                      weekday: "long", year: "numeric", month: "long", day: "numeric",
                    })}
                  </p>
                  {e.note && (
                    <p className="mt-1 text-sm text-ink/85 leading-relaxed whitespace-pre-wrap">
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
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
