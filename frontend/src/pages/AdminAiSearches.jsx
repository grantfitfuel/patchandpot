import { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  AlertTriangle, CheckCircle2, LogOut, RefreshCw, Sparkles,
  Undo2, X, ExternalLink, Star, Wand2,
} from "lucide-react";
import {
  clearPlantGuideCache, fetchAdminAiSearches, fetchPlantGuide,
  promoteAiPlant, unpromoteAiPlant,
} from "@/lib/api";
import AdminTokenGate, { useAdminToken } from "@/components/AdminTokenGate";

/**
 * Internal dashboard: review the top AI-generated plant guides and decide
 * which ones graduate into the permanent curated catalogue. Each row shows
 * the original AI guide JSON; the "Promote" modal lets the admin lightly
 * edit the schema fields before saving. Already-promoted rows are listed
 * in a second tab so a mistake can be reversed without touching the DB.
 *
 * Reads:  GET  /api/admin/ai-searches?include_promoted=&limit=
 * Writes: POST /api/admin/promote-plant
 *         POST /api/admin/unpromote-plant
 */
const CATEGORIES = [
  "Vegetable", "Herb", "Leafy green", "Fruit", "Root",
  "Allium", "Flower", "Brassica", "Squash", "Other",
];
const DIFFICULTIES = ["Very easy", "Easy", "Medium", "Hard"];
const SUN_LEVELS = ["Full sun", "Full to partial", "Partial sun", "Shade"];
const WATER_LEVELS = ["Low", "Moderate", "Regular", "Frequent"];

export default function AdminAiSearchesPage() {
  const { token, signIn, signOut } = useAdminToken();
  const [tab, setTab] = useState("candidates"); // candidates | promoted
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null); // slug currently being mutated
  const [toast, setToast] = useState(null);
  const [editing, setEditing] = useState(null); // item being promoted
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const d = await fetchAdminAiSearches(token, {
        limit: 100,
        includePromoted: tab === "promoted",
      });
      setData(d);
    } catch (e) {
      const status = e?.response?.status;
      if (status === 403) setError("Invalid admin token.");
      else if (status === 503) setError("ADMIN_TOKEN is not configured on the backend.");
      else setError(e?.message || "Failed to load AI searches.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token, tab]);

  useEffect(() => { load(); }, [load, reloadKey]);

  const items = useMemo(() => {
    if (!data?.items) return [];
    if (tab === "promoted") return data.items.filter((i) => i.promoted);
    return data.items.filter((i) => !i.promoted);
  }, [data, tab]);

  const flash = (msg, kind = "ok") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2800);
  };

  async function onSavePromote(payload) {
    setBusy(payload.source_slug);
    try {
      await promoteAiPlant(token, payload);
      setEditing(null);
      flash(`Added "${payload.name}" to the curated library.`, "ok");
      setReloadKey((k) => k + 1);
    } catch (e) {
      const detail = e?.response?.data?.detail || e?.message || "Promote failed.";
      flash(detail, "err");
    } finally {
      setBusy(null);
    }
  }

  async function onUnpromote(plantId) {
    if (!plantId) return;
    if (!window.confirm(`Remove "${plantId}" from the curated catalogue?`)) return;
    setBusy(plantId);
    try {
      await unpromoteAiPlant(token, plantId);
      flash(`Removed "${plantId}" from the curated library.`, "ok");
      setReloadKey((k) => k + 1);
    } catch (e) {
      const detail = e?.response?.data?.detail || e?.message || "Unpromote failed.";
      flash(detail, "err");
    } finally {
      setBusy(null);
    }
  }

  if (!token) {
    return (
      <AdminTokenGate
        title="Promote AI searches"
        blurb="Review the top AI-generated plant guides and add the best of them to the permanent curated catalogue."
        onSubmit={signIn}
        testIdPrefix="admin-ai-searches"
      />
    );
  }

  return (
    <div
      className="container-narrow py-12 md:py-16 animate-fade-up"
      data-testid="admin-ai-searches"
    >
      <Helmet>
        <title>Admin · Promote AI Searches — Patch & Pot</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <header className="flex flex-wrap items-center justify-between gap-4 mb-10">
        <div>
          <p className="overline">Admin · Internal</p>
          <h1 className="font-serif text-4xl md:text-5xl text-forest mt-2">
            Promote AI searches
          </h1>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <Link
              to="/admin/ai-usage"
              data-testid="admin-link-usage"
              className="text-moss hover:text-terracotta underline-offset-4 hover:underline"
            >
              → AI usage
            </Link>
            <Link
              to="/admin/referrals"
              data-testid="admin-link-referrals"
              className="text-moss hover:text-terracotta underline-offset-4 hover:underline"
            >
              → Referrals
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex border border-border bg-surface" role="tablist">
            <button
              type="button"
              onClick={() => setTab("candidates")}
              data-testid="admin-tab-candidates"
              className={`px-4 py-2 text-sm tracking-wider uppercase transition-colors ${
                tab === "candidates" ? "bg-forest text-sand" : "text-ink/70 hover:text-forest"
              }`}
            >Candidates</button>
            <button
              type="button"
              onClick={() => setTab("promoted")}
              data-testid="admin-tab-promoted"
              className={`px-4 py-2 text-sm tracking-wider uppercase transition-colors ${
                tab === "promoted" ? "bg-forest text-sand" : "text-ink/70 hover:text-forest"
              }`}
            >Promoted</button>
          </div>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            disabled={loading}
            data-testid="admin-refresh"
            className="btn-ghost inline-flex items-center gap-2 text-sm disabled:opacity-50"
          >
            <RefreshCw strokeWidth={1.5} className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={signOut}
            data-testid="admin-sign-out"
            className="btn-ghost inline-flex items-center gap-2 text-sm"
          >
            <LogOut strokeWidth={1.5} className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </header>

      {error && (
        <div
          className="border border-terracotta/40 bg-terracotta/10 p-4 mb-8 flex items-start gap-3"
          data-testid="admin-error"
        >
          <AlertTriangle strokeWidth={1.5} className="w-5 h-5 text-terracotta flex-shrink-0 mt-0.5" />
          <p className="text-sm text-ink/80">{error}</p>
        </div>
      )}

      {toast && (
        <div
          data-testid="admin-toast"
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 shadow-lg flex items-center gap-2 ${
            toast.kind === "err"
              ? "bg-terracotta text-sand"
              : "bg-forest text-sand"
          }`}
        >
          {toast.kind === "err"
            ? <AlertTriangle strokeWidth={1.5} className="w-4 h-4" />
            : <CheckCircle2 strokeWidth={1.5} className="w-4 h-4" />}
          <span className="text-sm">{toast.msg}</span>
        </div>
      )}

      {loading && !data && (
        <p className="text-ink/60 text-sm" data-testid="admin-loading">Loading…</p>
      )}

      {data && items.length === 0 && (
        <div className="card-flat p-8 text-center" data-testid="admin-empty">
          <Sparkles strokeWidth={1.2} className="w-8 h-8 text-moss/60 mx-auto mb-3" />
          <p className="font-serif text-2xl text-forest">
            {tab === "promoted" ? "Nothing promoted yet" : "No AI searches yet"}
          </p>
          <p className="text-sm text-ink/65 mt-2">
            {tab === "promoted"
              ? "Promoted plants from the Candidates tab will appear here."
              : "When users search for plants outside the curated catalogue, they'll show up here ranked by 7-day views."}
          </p>
        </div>
      )}

      {data && items.length > 0 && (
        <ul className="space-y-4" data-testid="admin-ai-list">
          {items.map((it) => (
            <li
              key={it.slug}
              className="card-flat p-5 md:p-6"
              data-testid={`ai-search-row-${it.slug}`}
            >
              <div className="flex flex-wrap items-start gap-x-6 gap-y-3 justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="font-serif text-2xl text-forest leading-tight">
                      {it.guide?.name || it.query}
                    </h2>
                    {it.guide?.botanical_name && (
                      <span className="text-xs italic text-ink/60">
                        {it.guide.botanical_name}
                      </span>
                    )}
                    {it.promoted && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] tracking-wider uppercase bg-forest/10 text-forest">
                        <Star strokeWidth={1.5} className="w-3 h-3" />
                        Promoted → {it.promoted_plant_id}
                      </span>
                    )}
                  </div>
                  {it.guide?.summary && (
                    <p className="mt-2 text-sm text-ink/75 leading-relaxed">
                      {it.guide.summary}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/55 font-mono">
                    <span data-testid={`views-${it.slug}`}>
                      <b className="text-ink/85">{it.view_count_7d}</b> views / 7d
                    </span>
                    <span><b className="text-ink/85">{it.view_count}</b> total</span>
                    <span>slug: {it.slug}</span>
                    {it.guide?.category && <span>· {it.guide.category}</span>}
                    {it.guide?.difficulty && <span>· {it.guide.difficulty}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <a
                    href={`/plants/${it.slug.startsWith("ai-") ? "ai/" : ""}${it.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    data-testid={`view-${it.slug}`}
                    className="btn-ghost inline-flex items-center gap-2 text-sm"
                  >
                    <ExternalLink strokeWidth={1.5} className="w-4 h-4" />
                    Preview
                  </a>
                  {!it.promoted && (
                    <button
                      type="button"
                      onClick={() => setEditing(it)}
                      disabled={busy === it.slug}
                      data-testid={`promote-${it.slug}`}
                      className="btn-terracotta inline-flex items-center gap-2 text-sm disabled:opacity-50"
                    >
                      <Star strokeWidth={1.5} className="w-4 h-4" />
                      Promote…
                    </button>
                  )}
                  {it.promoted && it.promoted_plant_id && (
                    <button
                      type="button"
                      onClick={() => onUnpromote(it.promoted_plant_id)}
                      disabled={busy === it.promoted_plant_id}
                      data-testid={`unpromote-${it.slug}`}
                      className="btn-ghost inline-flex items-center gap-2 text-sm disabled:opacity-50"
                    >
                      <Undo2 strokeWidth={1.5} className="w-4 h-4" />
                      Unpromote
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <PromoteModal
          item={editing}
          busy={busy === editing.slug}
          token={token}
          onClose={() => setEditing(null)}
          onSave={onSavePromote}
          onFlash={flash}
        />
      )}
    </div>
  );
}

function PromoteModal({ item, busy, token, onClose, onSave, onFlash }) {
  const guide = item.guide || {};
  // Default the curated id to the AI slug without its `ai-` prefix so the
  // URL stays clean (e.g. /plants/yarrow rather than /plants/ai-yarrow).
  const defaultId = (item.slug || "").replace(/^ai-/, "");
  const [form, setForm] = useState({
    id: defaultId,
    name: guide.name || item.query || "",
    botanical_name: guide.botanical_name || "",
    category: CATEGORIES.includes(guide.category) ? guide.category : "Other",
    difficulty: DIFFICULTIES.includes(guide.difficulty) ? guide.difficulty : "Medium",
    sun: SUN_LEVELS.includes(guide.sun) ? guide.sun : "Full to partial",
    water: WATER_LEVELS.includes(guide.water) ? guide.water : "Moderate",
    soil: guide.soil || "Well-drained",
    edible_part: guide.edible_part || "Ornamental",
    summary: guide.summary || "",
    container: guide.container !== false,
    tags: Array.isArray(guide.tags) ? guide.tags.join(", ") : "",
  });
  const [regenerating, setRegenerating] = useState(false);

  const set = (k) => (e) => {
    const v = e?.target?.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
  };

  async function onRegenerate() {
    // Clear the cached EN guide on the server, then re-POST /plant-guide so
    // Claude generates a fresh draft. Re-pre-fill the form with the new
    // values so the admin sees the change immediately. Original form edits
    // are intentionally overwritten — "Regenerate" is meant to throw the
    // current draft away.
    if (!window.confirm(
      "Regenerate this plant guide from Claude? Your current edits will be replaced with the fresh draft."
    )) return;
    setRegenerating(true);
    try {
      await clearPlantGuideCache(token, item.slug);
      const fresh = await fetchPlantGuide(item.query || guide.name || defaultId, "en");
      setForm({
        id: defaultId,
        name: fresh.name || item.query || "",
        botanical_name: fresh.botanical_name || "",
        category: CATEGORIES.includes(fresh.category) ? fresh.category : "Other",
        difficulty: DIFFICULTIES.includes(fresh.difficulty) ? fresh.difficulty : "Medium",
        sun: SUN_LEVELS.includes(fresh.sun) ? fresh.sun : "Full to partial",
        water: WATER_LEVELS.includes(fresh.water) ? fresh.water : "Moderate",
        soil: fresh.soil || "Well-drained",
        edible_part: fresh.edible_part || "Ornamental",
        summary: fresh.summary || "",
        container: fresh.container !== false,
        tags: Array.isArray(fresh.tags) ? fresh.tags.join(", ") : "",
      });
      onFlash?.("Fresh guide generated from Claude.", "ok");
    } catch (e) {
      const detail = e?.response?.data?.detail || e?.message || "Regenerate failed.";
      onFlash?.(detail, "err");
    } finally {
      setRegenerating(false);
    }
  }

  const submit = (e) => {
    e.preventDefault();
    onSave({
      id: form.id.trim().toLowerCase(),
      source_slug: item.slug,
      name: form.name.trim(),
      botanical_name: form.botanical_name.trim(),
      category: form.category,
      difficulty: form.difficulty,
      sun: form.sun,
      water: form.water,
      soil: form.soil.trim(),
      edible_part: form.edible_part.trim(),
      summary: form.summary.trim(),
      container: !!form.container,
      tags: form.tags.split(",").map((s) => s.trim()).filter(Boolean),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/60 flex items-end md:items-center justify-center p-0 md:p-6 overflow-y-auto"
      role="dialog"
      data-testid="promote-modal"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-sand w-full max-w-2xl border border-border shadow-xl max-h-[92vh] overflow-y-auto">
        <header className="sticky top-0 bg-sand px-5 md:px-7 py-4 flex items-center justify-between border-b border-border">
          <div>
            <p className="overline">Promote to curated</p>
            <h2 className="font-serif text-2xl text-forest mt-1">
              {item.guide?.name || item.query}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="modal-close"
            className="p-2 text-ink/60 hover:text-ink"
          >
            <X strokeWidth={1.5} className="w-5 h-5" />
          </button>
        </header>

        <form onSubmit={submit} className="px-5 md:px-7 py-6 space-y-5">
          <Field label="Curated ID (slug — used in URLs)" required>
            <input
              required
              value={form.id}
              onChange={set("id")}
              data-testid="field-id"
              pattern="[a-z0-9\-]+"
              title="lowercase letters, numbers and hyphens only"
              className={inputCls}
            />
          </Field>

          <div className="grid md:grid-cols-2 gap-5">
            <Field label="Common name" required>
              <input
                required
                value={form.name}
                onChange={set("name")}
                data-testid="field-name"
                className={inputCls}
              />
            </Field>
            <Field label="Botanical name">
              <input
                value={form.botanical_name}
                onChange={set("botanical_name")}
                data-testid="field-botanical"
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Summary (1–2 sentences)">
            <textarea
              rows={2}
              value={form.summary}
              onChange={set("summary")}
              data-testid="field-summary"
              className={inputCls}
            />
          </Field>

          <div className="grid md:grid-cols-2 gap-5">
            <Field label="Category">
              <select value={form.category} onChange={set("category")} data-testid="field-category" className={inputCls}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Difficulty">
              <select value={form.difficulty} onChange={set("difficulty")} data-testid="field-difficulty" className={inputCls}>
                {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Sun">
              <select value={form.sun} onChange={set("sun")} data-testid="field-sun" className={inputCls}>
                {SUN_LEVELS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Water">
              <select value={form.water} onChange={set("water")} data-testid="field-water" className={inputCls}>
                {WATER_LEVELS.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </Field>
            <Field label="Soil">
              <input value={form.soil} onChange={set("soil")} data-testid="field-soil" className={inputCls} />
            </Field>
            <Field label="Edible part (or 'Ornamental')">
              <input value={form.edible_part} onChange={set("edible_part")} data-testid="field-edible" className={inputCls} />
            </Field>
          </div>

          <Field label="Tags (comma-separated, e.g. beginner, summer, pollinator)">
            <input value={form.tags} onChange={set("tags")} data-testid="field-tags" className={inputCls} />
          </Field>

          <label className="flex items-center gap-2 text-sm text-ink/80">
            <input
              type="checkbox"
              checked={!!form.container}
              onChange={set("container")}
              data-testid="field-container"
            />
            Container-friendly (shows on small-space filters)
          </label>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onRegenerate}
              disabled={busy || regenerating}
              data-testid="modal-regenerate"
              className="btn-ghost inline-flex items-center gap-2 text-sm disabled:opacity-50"
              title="Discard the current draft and ask Claude to write a new one"
            >
              {regenerating
                ? <RefreshCw className="w-4 h-4 animate-spin" />
                : <Wand2 className="w-4 h-4" />}
              {regenerating ? "Regenerating…" : "Regenerate guide"}
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={busy || regenerating}
                data-testid="modal-cancel"
                className="btn-ghost text-sm"
              >Cancel</button>
              <button
                type="submit"
                disabled={busy || regenerating}
                data-testid="modal-save"
                className="btn-terracotta inline-flex items-center gap-2 text-sm disabled:opacity-50"
              >
                {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />}
                {busy ? "Saving…" : "Add to curated library"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 bg-surface border border-border text-ink text-sm focus:border-terracotta focus:outline-none";

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="block text-xs tracking-wider uppercase text-ink/60 mb-1.5">
        {label}{required && <span className="text-terracotta"> *</span>}
      </span>
      {children}
    </label>
  );
}
