import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the SIMPUL strategy workspace", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="id">/i);
  assert.match(html, /<title>SIMPUL — AI Strategy Studio<\/title>/i);
  assert.match(html, /Strategi beasiswa semester depan/);
  assert.match(html, /AUDIT STRATEGI/);
  assert.match(html, /Menang beasiswa/);
  assert.match(html, /3<!-- --> sumber/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("ships the model pipeline, audit engine, and responsive product shell", async () => {
  const [
    page,
    layout,
    css,
    strategy,
    browserPipeline,
    generateRoute,
    auditRoute,
    pagesConfig,
    packageJson,
    pdfExporter,
    formatExporter,
  ] =
    await Promise.all([
      readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
      readFile(new URL("../app/lib/strategy.ts", import.meta.url), "utf8"),
      readFile(
        new URL("../app/lib/openrouter-browser.ts", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../app/api/generate/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/audit/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../vite.pages.config.ts", import.meta.url), "utf8"),
      readFile(new URL("../package.json", import.meta.url), "utf8"),
      readFile(new URL("../app/lib/export-pdf.js", import.meta.url), "utf8"),
      readFile(new URL("../app/lib/export-formats.js", import.meta.url), "utf8"),
    ]);

  assert.match(page, /onPointerMove/);
  assert.match(page, /onTouchStart/);
  assert.match(page, /onTouchMove/);
  assert.match(page, /onTouchCancel/);
  assert.match(page, /Math\.hypot\(dx, dy\)/);
  assert.match(page, /event\.pointerType === "touch"/);
  assert.match(page, /Seret simpul bebas/);
  assert.match(page, /handleCanvasPointerMove/);
  assert.match(page, /handleCanvasTouchMove/);
  assert.match(page, /beginPinchGesture/);
  assert.match(page, /updatePinchGesture/);
  assert.match(page, /pointerDistance/);
  assert.match(page, /handleConnect/);
  assert.match(page, /removeEdge/);
  assert.match(page, /selectedEdgeId/);
  assert.match(page, /duplicateSelected/);
  assert.match(page, /splitSelected/);
  assert.match(page, /accept="\.txt,\.md,text\/plain,text\/markdown"/);
  assert.match(page, /exportStrategy/);
  assert.match(page, /downloadStrategySvg/);
  assert.match(page, /downloadStrategyDocx/);
  assert.match(page, /downloadStrategyJson/);
  assert.doesNotMatch(page, /maxLength=/);
  assert.doesNotMatch(page, /\/3000/);
  assert.doesNotMatch(page, /zoom-controls/);
  assert.match(page, /localStorage\.setItem\("simpul-strategy"/);
  assert.match(page, /setTimeout\(async \(\) =>/);
  assert.match(strategy, /function countCycles/);
  assert.match(strategy, /function calculateCriticalPath/);
  assert.match(strategy, /function arrangeStrategyNodes/);
  assert.match(strategy, /function ensureConnectedStrategyGraph/);
  assert.match(strategy, /function getOrthogonalEdgeGeometry/);
  assert.match(strategy, /function getStrategyCanvasSize/);
  assert.match(strategy, /function inferEdgeRelation/);
  assert.match(strategy, /effortReturn/);
  assert.match(generateRoute, /deepseek\/deepseek-v4-pro/);
  assert.match(generateRoute, /deepseek\/deepseek-v4-flash/);
  assert.match(generateRoute, /openai\/gpt-5\.4-mini/);
  assert.match(generateRoute, /minimax\/minimax-m3/);
  assert.match(generateRoute, /qwen\/qwen3\.7-max/);
  assert.match(generateRoute, /qwen\/qwen3\.7-plus/);
  assert.doesNotMatch(generateRoute, /gemini-3\.5|gpt-5\.2-codex|claude-sonnet/);
  assert.doesNotMatch(generateRoute, /gemini-2\.5/);
  assert.match(generateRoute, /id:\s*"web"/);
  assert.match(generateRoute, /engine:\s*"exa"/);
  assert.match(generateRoute, /effort:\s*"xhigh"/);
  assert.match(generateRoute, /\["web",\s*"plain"\]/);
  assert.match(generateRoute, /response_format/);
  assert.match(generateRoute, /response-healing/);
  assert.doesNotMatch(generateRoute, /maxItems:\s*14/);
  assert.doesNotMatch(generateRoute, /prompt\.length\s*>\s*3000/);
  assert.doesNotMatch(generateRoute, /temperature:\s*0\./);
  assert.match(auditRoute, /x-openrouter-key/);
  assert.match(auditRoute, /qwen\/qwen3\.7-plus/);
  assert.match(auditRoute, /response-healing/);
  assert.doesNotMatch(auditRoute, /temperature:\s*0\./);
  assert.match(browserPipeline, /id:\s*"web"/);
  assert.match(browserPipeline, /engine:\s*"exa"/);
  assert.match(browserPipeline, /deepseek\/deepseek-v4-pro/);
  assert.match(browserPipeline, /effort:\s*"xhigh"/);
  assert.doesNotMatch(browserPipeline, /openrouter:web_search/);
  assert.doesNotMatch(browserPipeline, /temperature:\s*0\./);
  assert.match(browserPipeline, /response-healing/);
  assert.doesNotMatch(browserPipeline, /maxItems:\s*14/);
  assert.match(browserPipeline, /generateStrategyInBrowser/);
  assert.match(page, /isGitHubPages/);
  assert.match(pagesConfig, /MAP-STRATEGY-GPT/);
  assert.match(packageJson, /"build:pages"/);
  assert.match(layout, /lang="id"/);
  assert.match(css, /touch-action:\s*none/);
  assert.match(css, /-webkit-touch-callout:\s*none/);
  assert.match(css, /strategy-node\[data-dragging="true"\]/);
  assert.match(css, /@media \(max-width:\s*720px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(packageJson, /jspdf/);
  assert.match(packageJson, /docx/);
  assert.match(pdfExporter, /createStrategyPdf/);
  assert.match(pdfExporter, /addMapPosterPage/);
  assert.match(pdfExporter, /orthogonalPoints/);
  assert.match(formatExporter, /createStrategySvg/);
  assert.match(formatExporter, /createStrategyDocxBlob/);

  await assert.rejects(
    access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)),
  );
});
