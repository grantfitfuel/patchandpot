import { useEffect, useRef, useState } from "react";
import { Code2, Copy, Check, ExternalLink } from "lucide-react";
import { fetchFoundingStatus } from "@/lib/api";

/**
 * Tiny "viral growth" surface on the homepage: a one-click copyable
 * `<iframe>` snippet that drops the live Founding Member widget into any
 * gardening blog, guest post, or community sidebar.
 *
 * Renders nothing once the cohort sells out (mirrors FoundingBanner) so we
 * don't leave a dead embed snippet hanging around.
 */
export default function EmbedFoundingSnippet() {
  const [status, setStatus] = useState(null);
  const [copied, setCopied] = useState(false);
  const taRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    fetchFoundingStatus()
      .then((s) => { if (!cancelled) setStatus(s); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!status || !status.active) return null;

  // Build the embed URL from the live origin so devs running locally,
  // staging, and prod each see a snippet that actually works in their tab.
  const origin = typeof window !== "undefined" ? window.location.origin : "https://patchandpot.app";
  const embedSrc = `${origin}/api/founding-status/widget`;
  const snippet = `<iframe src="${embedSrc}" width="100%" height="180" style="border:0;max-width:480px;" loading="lazy" title="Patch & Pot — Founding Member"></iframe>`;

  async function copySnippet() {
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(snippet);
        ok = true;
      }
    } catch (e) {
      // Clipboard API can reject in iframes / headless / when the document
      // isn't focused. Fall through to the execCommand path below.
      console.warn("clipboard.writeText failed, falling back", e);
    }
    if (!ok && taRef.current) {
      try {
        taRef.current.select();
        ok = document.execCommand("copy");
        taRef.current.blur();
      } catch (e) {
        console.warn("execCommand copy failed", e);
      }
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  }

  return (
    <section
      className="border-t border-border bg-sand/40"
      data-testid="embed-founding-snippet"
    >
      <div className="container-narrow py-16 md:py-20 grid md:grid-cols-12 gap-10 items-start">
        <div className="md:col-span-5">
          <div className="flex items-center gap-3 mb-3">
            <Code2 strokeWidth={1.4} className="w-5 h-5 text-terracotta" />
            <span className="overline">Spread the word</span>
          </div>
          <h2 className="font-serif text-3xl md:text-4xl text-forest leading-tight">
            Embed the Founding offer on your blog.
          </h2>
          <p className="mt-4 text-ink/75 leading-relaxed">
            One line of HTML. Drops a live, self-updating spots-remaining card
            into any post — yours or a guest article. The iframe is lazy-loaded
            and unstyled by design, so it blends with most layouts.
          </p>
          <a
            href={embedSrc}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="embed-preview-link"
            className="mt-5 inline-flex items-center gap-2 text-sm text-forest hover:text-terracotta underline-offset-4 hover:underline"
          >
            Preview the embed <ExternalLink strokeWidth={1.5} className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="md:col-span-7">
          <div className="bg-forest text-sand/90 p-5 md:p-6 font-mono text-[12px] md:text-[13px] leading-relaxed overflow-hidden border border-forest">
            <pre
              data-testid="embed-snippet-text"
              className="whitespace-pre-wrap break-all m-0"
            >{snippet}</pre>
            {/* Hidden mirror used by the execCommand fallback. */}
            <textarea
              ref={taRef}
              value={snippet}
              readOnly
              tabIndex={-1}
              aria-hidden="true"
              className="absolute -left-[9999px] top-0 opacity-0 h-0 w-0"
            />
          </div>
          <button
            type="button"
            onClick={copySnippet}
            data-testid="embed-copy-btn"
            className="mt-4 btn-terracotta inline-flex items-center gap-2"
          >
            {copied ? (
              <>
                <Check strokeWidth={2} className="w-4 h-4" />
                Copied to clipboard
              </>
            ) : (
              <>
                <Copy strokeWidth={1.6} className="w-4 h-4" />
                Copy embed code
              </>
            )}
          </button>
          <p className="text-xs text-moss mt-3 leading-relaxed">
            Works on WordPress, Ghost, Substack, Notion, and most blog
            platforms that accept raw HTML or iframe blocks.
          </p>
        </div>
      </div>
    </section>
  );
}
