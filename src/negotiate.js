/**
 * Content negotiation between HTML and Markdown for page requests.
 * Rules (https://acceptmarkdown.com): serve Markdown for Accept: text/markdown, send Vary: Accept,
 * honour q-values, and answer 406 when the client accepts neither format.
 */

/** Parses an Accept header into [{ type, q }] with lower-cased media ranges. */
export function parseAccept(header) {
  if (!header) return [];
  return header
    .split(",")
    .map((part) => {
      const [range, ...params] = part.trim().toLowerCase().split(";").map((s) => s.trim());
      let q = 1;
      for (const p of params) {
        if (p.startsWith("q=")) {
          const v = Number(p.slice(2));
          q = Number.isFinite(v) ? Math.min(Math.max(v, 0), 1) : 0;
        }
      }
      return { type: range, q };
    })
    .filter((r) => r.type && r.type.includes("/"));
}

/** Quality for one concrete media type: the most specific matching range wins (exact, then type wildcard, then the full wildcard). */
export function qualityFor(ranges, mime) {
  const [major] = mime.split("/");
  let best = -1;
  let specificity = -1;
  for (const { type, q } of ranges) {
    const s = type === mime ? 3 : type === `${major}/*` ? 2 : type === "*/*" ? 1 : -1;
    if (s > specificity || (s === specificity && s >= 0 && q > best)) {
      specificity = s;
      best = q;
    }
  }
  return specificity < 0 ? 0 : best;
}

/**
 * Returns "markdown", "html", "plain" (Markdown body labelled text/plain) or null (nothing acceptable: answer 406).
 * Markdown wins when text/markdown is named with a quality above zero and at least as high as HTML, or when HTML is
 * refused. A bare wildcard (any type, or text with any subtype) keeps serving HTML, so browsers and generic crawlers are unaffected.
 */
export function negotiate(header) {
  if (!header || !header.trim()) return "html";
  const ranges = parseAccept(header);
  if (!ranges.length) return "html";
  const md = qualityFor(ranges, "text/markdown");
  const html = Math.max(qualityFor(ranges, "text/html"), qualityFor(ranges, "application/xhtml+xml"));
  const plain = qualityFor(ranges, "text/plain");
  const named = ranges.some((r) => r.type === "text/markdown" && r.q > 0);
  if (named && md >= html) return "markdown";
  if (html > 0) return "html";
  if (md > 0) return "markdown";
  if (plain > 0) return "plain";
  return null;
}

/** Adds Accept to a Vary header value without repeating it. */
export function varyAccept(existing) {
  const names = (existing || "").split(",").map((s) => s.trim()).filter(Boolean);
  return names.some((n) => n.toLowerCase() === "accept" || n === "*") ? names.join(", ") : [...names, "Accept"].join(", ");
}

/**
 * True when the client names JSON (application/json, application/problem+json or any application subtype) with a
 * quality above zero and at least as high as HTML. Such clients get errors as RFC 9457 problem details.
 */
export function prefersJson(header) {
  const ranges = parseAccept(header);
  const named = ranges.filter((r) => r.q > 0 && (r.type === "application/json" || r.type === "application/problem+json" || r.type === "application/*"));
  if (!named.length) return false;
  const json = Math.max(...named.map((r) => r.q));
  const html = Math.max(qualityFor(ranges, "text/html"), qualityFor(ranges, "application/xhtml+xml"));
  return json >= html;
}
