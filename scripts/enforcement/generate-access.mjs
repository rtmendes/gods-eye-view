import { readFileSync, writeFileSync } from 'node:fs';
// Read quoted CSV cells without assuming commas never occur in prose.
function csv(text) {
  const rows = [];
  let row = [],
    cell = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' && !quoted) {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }
  const [header, ...body] = rows;
  return body
    .filter((r) => r.length === header.length)
    .map((r) => Object.fromEntries(header.map((key, i) => [key, r[i]])));
}
const root = new URL('../../', import.meta.url);
const rows = csv(
  readFileSync(
    new URL('docs/road-intelligence/access-tracker.csv', root),
    'utf8',
  ),
);
const markdown = readFileSync(
  new URL('docs/road-intelligence/DATA-ACCESS-CHECKLIST.md', root),
  'utf8',
);
const scopes = [
  ['Google Maps', '### A.'],
  ['PennDOT 511PA', '### B.'],
  ['511NY / NYSDOT', '### C.'],
  ['NYC DOT Open Data', '### C.'],
  ['NY AWZSE', '### C.'],
  ['511NJ / NJDOT', '### D.'],
  ['Port Authority', '### D.'],
  ['Caltrans CWWP2', '### E.'],
  ['511 SF Bay', '### E.'],
  ['USDOT WZDx registry', '### F.'],
];
const providers = rows.map((row, i) => {
  const heading = scopes.find(([name]) => name === row.platform)?.[1];
  let steps = [];
  if (heading) {
    const section = markdown
      .slice(markdown.indexOf(heading))
      .split(/\n### |\n## /)[0];
    steps = [...section.matchAll(/^- \[ \] (.+)$/gm)].map((m) => m[1]);
  }
  if (!steps.length)
    for (const state of row.jurisdictions.split(';')) {
      const line = markdown
        .split('\n')
        .find((l) => new RegExp(`^\\| ${state}\\s*\\|`).test(l));
      if (line)
        steps.push(
          ...line
            .split('[ ]')
            .slice(1)
            .map((s) =>
              s
                .replace(/\s*\|\s*$/, '')
                .replace(/;\s*$/, '')
                .trim(),
            ),
        );
    }
  return {
    ...row,
    id: `provider-${i}`,
    steps: steps.length ? steps : [row.next_action],
  };
});
writeFileSync(
  new URL('curation/sources/access.json', root),
  JSON.stringify(
    { schemaVersion: 1, reviewedAt: '2026-11-08', providers },
    null,
    2,
  ) + '\n',
);
console.log(
  `Generated ${providers.length} access provider records from documentation`,
);
