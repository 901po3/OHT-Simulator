import { mdToPdf } from 'md-to-pdf';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const root = resolve(process.cwd());
const mdPath = resolve(root, 'OHT-Simulator-Portfolio.md');
const outPath = resolve(root, 'OHT-Simulator-Portfolio.pdf');

const css = `
  @page { size: A4; margin: 18mm 16mm; }
  body {
    font-family: "Malgun Gothic", "Noto Sans CJK KR", "Apple SD Gothic Neo", "Segoe UI", sans-serif;
    font-size: 11pt;
    line-height: 1.55;
    color: #222;
  }
  h1 { font-size: 22pt; border-bottom: 3px solid #2563eb; padding-bottom: 6px; margin-top: 0.4em; }
  h2 { font-size: 16pt; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-top: 1.4em; color: #1e3a8a; }
  h3 { font-size: 13pt; color: #1e40af; margin-top: 1.2em; }
  h4 { font-size: 11.5pt; color: #334155; }
  p, li { font-size: 11pt; }
  code { font-family: "Consolas", "D2Coding", "Malgun Gothic", "Noto Sans CJK KR", monospace; background: #f1f5f9; padding: 1px 4px; border-radius: 3px; font-size: 9.5pt; }
  pre { background: #0f172a; color: #e2e8f0; padding: 10px 12px; border-radius: 6px; overflow-x: auto; font-size: 9pt; line-height: 1.4; page-break-inside: avoid; }
  pre code { background: transparent; color: inherit; padding: 0; }
  table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 10pt; page-break-inside: avoid; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
  th { background: #e0e7ff; color: #1e3a8a; font-weight: 600; white-space: nowrap; }
  tr:nth-child(even) td { background: #f8fafc; }
  blockquote { border-left: 4px solid #2563eb; padding-left: 12px; color: #475569; margin: 10px 0; }
  hr { border: none; border-top: 1px solid #cbd5e1; margin: 1.5em 0; }
  a { color: #2563eb; text-decoration: none; }
  h2 { page-break-before: auto; }
  h1 + p + p + hr + h2 { page-break-before: always; }
  h2, h3, h4 { page-break-after: avoid; break-after: avoid; }
  h4 + p, h4 + ul, h4 + ol, h4 + pre, h4 + table,
  h3 + p, h3 + ul, h3 + ol, h3 + pre, h3 + table,
  h2 + p, h2 + ul, h2 + ol, h2 + pre, h2 + table { page-break-before: avoid; break-before: avoid; }
`;

const content = readFileSync(mdPath, 'utf8');

const pdf = await mdToPdf(
  { content },
  {
    dest: outPath,
    css,
    pdf_options: {
      format: 'A4',
      margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div style="font-size:8pt;width:100%;text-align:right;padding:0 16mm;color:#64748b;">OHT-Simulator Portfolio</div>',
      footerTemplate: '<div style="font-size:8pt;width:100%;text-align:center;color:#64748b;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    },
    launch_options: { args: ['--no-sandbox'] },
    marked_options: { gfm: true, breaks: false },
    highlight_style: 'github',
  }
);

if (pdf) {
  console.log('PDF written:', outPath);
} else {
  console.error('PDF generation failed');
  process.exit(1);
}
