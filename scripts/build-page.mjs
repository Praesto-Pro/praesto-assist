import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const css = (await readFile(new URL('styles.css', root), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
const firstScreenClass = /\.(?:page-wrap|sr-only|skip-link|site-header|nav[\w-]*|brand[\w-]*|theme[\w-]*|mobile[\w-]*|hero[\w-]*|eyebrow|button[\w-]*|text-link|benefit[\w-]*|ui-icon)(?![\w-])/;
const baseSelector = /^(?:\*|html\b|body\b|button\b|input\b|select\b|a\b|svg\b|img\b|p\b|h[1-3]\b|em\b|:root|:where)/;

// Preserve rule order, responsive overrides, theme tokens and accessibility rules.
// This project uses flat CSS rules with @media containers, not CSS nesting.
function criticalRules(source) {
  let output = '';
  let position = 0;
  while (position < source.length) {
    const start = source.indexOf('{', position);
    if (start === -1) break;
    const selector = source.slice(position, start).trim();
    let depth = 1;
    let quote = '';
    let end = start + 1;
    for (; end < source.length && depth; end++) {
      const character = source[end];
      if (character === '\\') { end++; continue; }
      if (quote) { if (character === quote) quote = ''; continue; }
      if (character === '"' || character === "'") { quote = character; continue; }
      if (character === '{') depth++;
      if (character === '}') depth--;
    }
    if (depth) throw new Error('Unbalanced CSS rule: ' + selector);
    const body = source.slice(start + 1, end - 1);
    if (selector.startsWith('@media')) {
      const children = criticalRules(body);
      if (children) output += selector + '{' + children + '}';
    } else if (selector.startsWith('@font-face') || firstScreenClass.test(selector) || baseSelector.test(selector)) {
      output += selector + '{' + body + '}';
    }
    position = end;
  }
  return output;
}

const critical = criticalRules(css);
const page = new URL('index.html', root);
let html = await readFile(page, 'utf8');
const startMarker = '<!-- Generated first-screen styles: npm run build -->';
const endMarker = '<!-- End first-screen styles -->';
const styles = `${startMarker}\n<style id="critical-css">${critical}</style>\n<link href="/styles.css" rel="stylesheet" media="print" onload="this.media='all';this.onload=null"/>\n<noscript><link href="/styles.css" rel="stylesheet"/></noscript>\n${endMarker}`;
if (html.includes(startMarker)) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker, start);
  if (end === -1) throw new Error('Missing generated styles end marker');
  html = html.slice(0, start) + styles + html.slice(end + endMarker.length);
} else {
  const link = '<link href="/styles.css" rel="stylesheet"/>';
  if (!html.includes(link)) throw new Error('Missing main stylesheet link');
  html = html.replace(link, styles);
}
await writeFile(page, html);
console.log(`First-screen CSS: ${Buffer.byteLength(critical)} bytes; remaining styles load without blocking first paint.`);
