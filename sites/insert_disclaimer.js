// insert_disclaimer.js
// Usage: node insert_disclaimer.js
// Requires Node 14+

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd(); // run from /sites
const DISCLAIMER = `
<section class="disclaimer" id="disclaimer">
  <h2>Important Note</h2>
  <p>
    The information on this page is for <strong>general understanding and support</strong>. It is
    <strong>not</strong> a substitute for professional medical, psychological, or legal advice. If you feel
    unable to keep yourself safe or someone else is at risk, call <strong>999</strong> (UK) immediately.
    If you’re outside the UK, contact your local emergency number.
  </p>
  <p>
    For non-emergency concerns, consider speaking with a qualified health professional or one of the
    support services listed on our site.
  </p>
</section>
`;

const hasSignature = (html) =>
  html.includes('The information on this page is for <strong>general understanding and support</strong>.');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.isFile() && p.endsWith('.html')) out.push(p);
  }
  return out;
}

function insertDisclaimer(html) {
  if (hasSignature(html)) return { html, changed: false, reason: 'already present' };
  const needle = '</main>';
  const idx = html.toLowerCase().lastIndexOf(needle);
  if (idx === -1) return { html, changed: false, reason: 'no </main> found' };

  const before = html.slice(0, idx);
  const after  = html.slice(idx);
  const spacer = before.endsWith('\n') ? '' : '\n';
  const newHtml = before + spacer + DISCLAIMER + '\n' + after;
  return { html: newHtml, changed: true, reason: 'inserted' };
}

(function main(){
  const files = walk(ROOT);
  let changedCount = 0, skipped = 0;

  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    const { html, changed, reason } = insertDisclaimer(src);

    if (!changed) {
      // Uncomment to log why it skipped:
      // console.log('SKIP', file, '-', reason);
      skipped++;
      continue;
    }

    // backup once
    const bak = file + '.bak';
    if (!fs.existsSync(bak)) fs.writeFileSync(bak, src, 'utf8');

    fs.writeFileSync(file, html, 'utf8');
    changedCount++;
    console.log('UPDATED', file);
  }
  console.log(`\nDone. Updated: ${changedCount}, skipped: ${skipped}.`);
})();
