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
    ]);

  assert.match(page, /onPointerMove/);
  assert.match(page, /handleConnect/);
  assert.match(page, /removeEdge/);
  assert.match(page, /localStorage\.setItem\("simpul-strategy"/);
  assert.match(page, /setTimeout\(async \(\) =>/);
  assert.match(strategy, /function countCycles/);
  assert.match(strategy, /function calculateCriticalPath/);
  assert.match(strategy, /effortReturn/);
  assert.match(generateRoute, /google\/gemini-3\.5-flash/);
  assert.match(generateRoute, /openai\/gpt-5\.2-codex/);
  assert.match(generateRoute, /anthropic\/claude-sonnet-5/);
  assert.match(generateRoute, /qwen\/qwen3\.7-max/);
  assert.match(generateRoute, /openrouter:web_search/);
  assert.match(generateRoute, /response_format/);
  assert.match(auditRoute, /x-openrouter-key/);
  assert.match(browserPipeline, /openrouter:web_search/);
  assert.match(browserPipeline, /generateStrategyInBrowser/);
  assert.match(page, /isGitHubPages/);
  assert.match(pagesConfig, /MAP-STRATEGY-GPT/);
  assert.match(packageJson, /"build:pages"/);
  assert.match(layout, /lang="id"/);
  assert.match(css, /touch-action:\s*none/);
  assert.match(css, /@media \(max-width:\s*720px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await assert.rejects(
    access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)),
  );
});
