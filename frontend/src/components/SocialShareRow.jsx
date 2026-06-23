import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { useI18n } from "@/i18n";

/**
 * A subtle, one-tap social-share row for the public /p/:shareId page.
 *
 * Each platform deep-link is wired up correctly:
 *   • X (Twitter):  https://twitter.com/intent/tweet?text=…&url=…
 *   • WhatsApp:     https://wa.me/?text=…  (URL embedded in text)
 *   • Pinterest:    https://pinterest.com/pin/create/button/?url=…&media=…&description=…
 *   • Copy link:    navigator.clipboard
 *
 * The URL we propagate is the bot-friendly `/api/share/preview/{id}` wrapper,
 * so any subsequent paste of this URL into a chat / DM unfurls into a real
 * OG card — same as what the owner's Share modal copies.
 */
export default function SocialShareRow({
  shareId,
  patchName,
  regionName,
  origin,           // injected by the parent so we don't read window inside the component
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  if (!shareId || !origin) return null;

  // Crawler-friendly wrapper URL (preferred for chat / DM sharing)
  const wrapperUrl = `${origin}/api/share/preview/${shareId}`;
  // Direct image URL for Pinterest's `media` param so the pin includes our card
  const imageUrl   = `${origin}/api/share/patch/${shareId}/og.png`;

  const tagline = regionName
    ? t("share_view.social.tagline_region", { name: patchName, region: regionName })
    : t("share_view.social.tagline", { name: patchName });

  const xUrl = "https://twitter.com/intent/tweet"
    + `?text=${encodeURIComponent(tagline)}`
    + `&url=${encodeURIComponent(wrapperUrl)}`;
  // WhatsApp's wa.me only takes a single text param — we concatenate text + URL.
  const whatsappUrl = "https://wa.me/?text="
    + encodeURIComponent(`${tagline} ${wrapperUrl}`);
  const pinterestUrl = "https://pinterest.com/pin/create/button/"
    + `?url=${encodeURIComponent(wrapperUrl)}`
    + `&media=${encodeURIComponent(imageUrl)}`
    + `&description=${encodeURIComponent(tagline)}`;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(wrapperUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {
      console.warn("clipboard write failed", e);
    }
  };

  return (
    <div
      data-testid="share-view-social-row"
      className="flex flex-wrap items-center gap-2 mt-4"
    >
      <span className="text-xs uppercase tracking-wider text-moss/80 mr-1">
        {t("share_view.social.label")}
      </span>

      <ShareIconLink
        href={xUrl}
        label={t("share_view.social.x")}
        testId="share-view-social-x"
        platformClass="hover:bg-ink hover:text-sand"
      >
        <XLogo />
      </ShareIconLink>

      <ShareIconLink
        href={whatsappUrl}
        label={t("share_view.social.whatsapp")}
        testId="share-view-social-whatsapp"
        platformClass="hover:bg-[#25D366] hover:text-white"
      >
        <WhatsAppLogo />
      </ShareIconLink>

      <ShareIconLink
        href={pinterestUrl}
        label={t("share_view.social.pinterest")}
        testId="share-view-social-pinterest"
        platformClass="hover:bg-[#E60023] hover:text-white"
      >
        <PinterestLogo />
      </ShareIconLink>

      <button
        type="button"
        onClick={onCopy}
        aria-label={copied ? t("share_view.social.copied") : t("share_view.social.copy")}
        title={copied ? t("share_view.social.copied") : t("share_view.social.copy")}
        data-testid="share-view-social-copy"
        className="inline-flex items-center gap-2 px-3 py-2 border border-border bg-surface text-moss hover:text-forest hover:border-forest/40 transition-colors text-xs"
      >
        {copied ? (
          <><Check strokeWidth={1.6} className="w-4 h-4 text-forest" /> {t("share_view.social.copied")}</>
        ) : (
          <><Link2 strokeWidth={1.6} className="w-4 h-4" /> {t("share_view.social.copy")}</>
        )}
      </button>
    </div>
  );
}

function ShareIconLink({ href, label, testId, platformClass, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      data-testid={testId}
      className={
        "inline-flex items-center justify-center w-9 h-9 border border-border bg-surface text-moss transition-colors "
        + (platformClass || "hover:bg-forest hover:text-sand")
      }
    >
      {children}
    </a>
  );
}

// ─── Brand glyphs (inline SVG — lucide-react dropped brand icons in 2024) ───
function XLogo() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25h6.825l4.713 6.231 5.452-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

function WhatsAppLogo() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.967-.94 1.164-.173.198-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.206-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347Zm-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.36-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.002-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.886 9.884Zm8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}

function PinterestLogo() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.097.118.112.221.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.402.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.357-.629-2.746-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641.001 12.017.001z"/>
    </svg>
  );
}
