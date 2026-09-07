import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { mdToPdf } from "md-to-pdf";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const mdPath = path.join(root, "docs", "PRD.md");
const outPath = path.join(root, "public", "code-clash-2026-PRD.pdf");

const css = `
  body {
    background: #0d1117;
    color: #e6edf3;
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 12px;
    line-height: 1.6;
  }
  h1 {
    color: #ffffff;
    border-bottom: 2px solid #38bdf8;
    padding-bottom: 8px;
    font-size: 24px;
  }
  h2 {
    color: #38bdf8;
    border-bottom: 1px solid #30363d;
    padding-bottom: 6px;
    font-size: 18px;
    margin-top: 24px;
  }
  h3 {
    color: #4ade80;
    font-size: 15px;
    margin-top: 18px;
  }
  p, li {
    color: #c9d1d9;
  }
  strong {
    color: #ffffff;
  }
  code {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 4px;
    padding: 1px 5px;
    color: #7ee787;
    font-family: "Cascadia Code", Consolas, Menlo, monospace;
    font-size: 11px;
  }
  pre {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 12px;
    overflow-x: auto;
  }
  pre code {
    background: none;
    border: none;
    padding: 0;
    color: #e6edf3;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 12px 0;
  }
  th {
    background: #161b22;
    color: #38bdf8;
    text-align: left;
    border: 1px solid #30363d;
    padding: 6px 10px;
  }
  td {
    border: 1px solid #30363d;
    padding: 6px 10px;
    color: #c9d1d9;
  }
  a {
    color: #38bdf8;
  }
  blockquote {
    border-left: 3px solid #38bdf8;
    margin: 0;
    padding-left: 12px;
    color: #8b949e;
  }
`;

await mdToPdf(
  { path: mdPath },
  {
    css,
    pdf: {
      format: "A4",
      printBackground: true,
      margin: { top: "16mm", right: "14mm", bottom: "16mm", left: "14mm" },
    },
  }
).then((pdf) => writeFile(outPath, pdf.content));

console.log("PDF written to", outPath);
