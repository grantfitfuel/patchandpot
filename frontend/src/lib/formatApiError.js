/**
 * Format a thrown axios-style error into a single human-readable string
 * suitable for direct rendering as a React child.
 *
 * Why this exists
 * ---------------
 * FastAPI's `detail` field is polymorphic:
 *   - 400/401/403/404/500 → a plain string
 *   - 422 validation errors → an ARRAY of pydantic error objects, e.g.
 *       [{ type: "missing", loc: ["body", "plants"], msg: "Field required",
 *          input: null, url: "https://errors.pydantic.dev/..." }]
 *   - Some 3rd-party middleware → a nested object
 *
 * Rendering any of the non-string shapes directly inside JSX crashes
 * React with "Objects are not valid as a React child". We've seen this
 * crash class in SharePatchModal, PatronsManage, FoundingClaimModal etc.
 *
 * This helper coerces every shape to a flat string and is guaranteed
 * never to throw — if it can't extract anything useful it returns the
 * provided fallback.
 */

function formatPydanticItem(item) {
  if (!item || typeof item !== "object") return String(item ?? "");
  // pydantic v2 emits {type, loc, msg, input, url}; v1 emits {loc, msg, type}
  const msg = typeof item.msg === "string" ? item.msg : "";
  const loc = Array.isArray(item.loc)
    ? item.loc
        .filter((seg) => seg !== "body" && typeof seg === "string")
        .join(".")
    : "";
  if (msg && loc) return `${loc}: ${msg}`;
  return msg || loc || "Validation error";
}

export function formatApiError(err, fallback = "Something went wrong.") {
  try {
    // Axios shape: err.response.data.detail
    const detail = err?.response?.data?.detail;

    if (typeof detail === "string" && detail.trim()) {
      return detail.trim();
    }

    if (Array.isArray(detail)) {
      const parts = detail
        .map(formatPydanticItem)
        .filter((s) => typeof s === "string" && s.trim());
      if (parts.length === 0) return fallback;
      // Cap at 3 to avoid wall-of-text modals
      return parts.slice(0, 3).join(" · ");
    }

    if (detail && typeof detail === "object") {
      // Some libs use {message: "..."} or {error: "..."} shapes
      const msg = detail.message || detail.error || detail.msg;
      if (typeof msg === "string" && msg.trim()) return msg.trim();
      // Last-resort JSON.stringify so we render *something* readable
      try {
        return JSON.stringify(detail).slice(0, 200);
      } catch {
        return fallback;
      }
    }

    // Network errors / non-axios throws — try common shapes
    if (typeof err?.message === "string" && err.message.trim()) {
      return err.message.trim();
    }

    return fallback;
  } catch {
    // Helper itself must never throw. Belt-and-braces.
    return fallback;
  }
}

export default formatApiError;
