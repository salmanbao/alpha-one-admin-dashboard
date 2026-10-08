/**
 * tools/validate_tsx.js — fast syntax gate for generated stitch pages.
 * Uses the TypeScript compiler's parser (no emit, no type-check) so hundreds
 * of files can be validated in seconds.
 *
 * Usage: node tools/validate_tsx.js [dir]
 */
const ts = require("typescript");
const fs = require("fs");
const path = require("path");

const dir = process.argv[2] || "src/modules/stitch/pages";
const maxPerFile = 3;

let bad = 0;
let total = 0;
const allBad = [];

for (const f of fs.readdirSync(dir).sort()) {
  if (!f.endsWith(".tsx")) continue;
  total++;
  const p = path.join(dir, f);
  const src = fs.readFileSync(p, "utf8");
  const sf = ts.createSourceFile(p, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const diags = sf.parseDiagnostics || [];
  if (diags.length) {
    bad++;
    allBad.push(f);
    console.log(`\n✖ ${f}: ${diags.length} parse error(s)`);
    const lines = src.split("\n");
    for (const d of diags.slice(0, maxPerFile)) {
      const pos = sf.getLineAndCharacterOfPosition(d.start);
      const line = lines[pos.line] || "";
      console.log(
        `  L${pos.line + 1}:${pos.character} — ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`
      );
      console.log(
        `    > ${line.slice(Math.max(0, pos.character - 70), pos.character + 90)}`
      );
    }
  }
}

console.log(`\n${total} files checked · ${bad} with parse errors`);
if (bad) {
  console.log("failing files:", allBad.join(", "));
  process.exit(1);
}
console.log("ALL PARSE CLEAN");
