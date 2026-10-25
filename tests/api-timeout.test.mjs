import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const apiSource = await readFile(new URL("../api.js", import.meta.url), "utf8");

test("remoteFetch supports a request-specific timeout without forwarding it to fetch", async () => {
  let scheduledDelay = null;
  let receivedOptions = null;
  const context = vm.createContext({
    REMOTE_REQUEST_TIMEOUT_MS: 8_000,
    AbortController,
    window: {
      setTimeout(callback, delay) {
        scheduledDelay = delay;
        return 1;
      },
      clearTimeout() {}
    },
    fetch: async (url, options) => {
      receivedOptions = options;
      return { ok: true, url };
    }
  });
  vm.runInContext(apiSource, context, { filename: "api.js" });

  await context.remoteFetch("https://example.test", {
    method: "POST",
    timeoutMs: 140_000
  });

  assert.equal(scheduledDelay, 140_000);
  assert.equal(receivedOptions.method, "POST");
  assert.equal("timeoutMs" in receivedOptions, false);
  assert.ok(receivedOptions.signal instanceof AbortSignal);
});

test("article generation starts one server job and polls its checkpoints", async () => {
  const calls = [];
  const progress = [];
  const responses = [
    { jobId: "job-1", status: "draft_queued" },
    { jobId: "job-1", status: "draft_running" },
    { jobId: "job-1", status: "review_queued" },
    { jobId: "job-1", status: "materials_running" },
    { jobId: "job-1", status: "completed", article: { title: "Test" } }
  ];
  const storage = new Map();
  const context = vm.createContext({
    REMOTE_REQUEST_TIMEOUT_MS: 8_000,
    ARTICLE_GENERATION_TIMEOUT_MS: 140_000,
    ARTICLE_GENERATION_STATUS_TIMEOUT_MS: 20_000,
    ARTICLE_GENERATION_POLL_INTERVAL_MS: 3_000,
    ARTICLE_GENERATION_POLL_LIMIT_MS: 15 * 60 * 1_000,
    ARTICLE_GENERATION_JOB_KEY: "pendingArticleGenerationJob",
    SUPABASE_CONFIG: { url: "https://project.test", anonKey: "anon" },
    state: { remoteReady: true },
    navigator: { onLine: true },
    AbortController,
    window: { setTimeout: callback => (callback(), 1), clearTimeout },
    localStorage: {
      getItem: key => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key)
    },
    fetch: async () => {
      throw new Error("unexpected native fetch");
    },
    t: key => key
  });
  vm.runInContext(apiSource, context, { filename: "api.js" });
  context.getFreshAuthAccessToken = async () => "access-token";
  context.remoteFetch = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body), timeoutMs: options.timeoutMs });
    const payload = responses.shift();
    return { ok: true, status: 200, json: async () => payload };
  };

  const result = await context.generateArticleWithAi({
    topic: "Ein Morgen",
    level: "A1",
    category: "Alltag",
    minWords: 300,
    maxWords: 350,
    requiredWords: [],
    storyContext: {
      chapterNumber: 2,
      chapterCount: 3,
      plan: { title: "Testgeschichte" },
      state: { openThreads: ["Das Rätsel lösen"] }
    },
    onProgress: phase => progress.push(phase)
  });

  assert.deepEqual(calls.map(call => call.body.action), ["start", "status", "status", "status", "status"]);
  assert.deepEqual(calls.slice(1).map(call => call.body.jobId), ["job-1", "job-1", "job-1", "job-1"]);
  assert.equal(calls[0].timeoutMs, 140_000);
  assert.equal(calls[0].body.storyContext.chapterNumber, 2);
  assert.equal(calls[0].body.storyContext.plan.title, "Testgeschichte");
  assert.deepEqual(calls[0].body.storyContext.state.openThreads, ["Das Rätsel lösen"]);
  assert.ok(calls.slice(1).every(call => call.timeoutMs === 20_000));
  assert.deepEqual(progress, ["starting", "starting", "draft", "review", "materials"]);
  assert.equal(result.article.title, "Test");
  assert.equal(storage.has("pendingArticleGenerationJob"), false);
});

test("article generation cancellation calls the server and clears the pending job", async () => {
  const storage = new Map([
    ["pendingArticleGenerationJob", JSON.stringify({ jobId: "job-cancel", signature: "request" })]
  ]);
  let request = null;
  const context = vm.createContext({
    REMOTE_REQUEST_TIMEOUT_MS: 8_000,
    ARTICLE_GENERATION_TIMEOUT_MS: 140_000,
    ARTICLE_GENERATION_STATUS_TIMEOUT_MS: 20_000,
    ARTICLE_GENERATION_POLL_INTERVAL_MS: 3_000,
    ARTICLE_GENERATION_POLL_LIMIT_MS: 15 * 60 * 1_000,
    ARTICLE_GENERATION_JOB_KEY: "pendingArticleGenerationJob",
    SUPABASE_CONFIG: { url: "https://project.test", anonKey: "anon" },
    state: { remoteReady: true },
    navigator: { onLine: true },
    AbortController,
    window: { setTimeout, clearTimeout },
    localStorage: {
      getItem: key => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key)
    },
    fetch: async () => {
      throw new Error("unexpected native fetch");
    },
    t: key => key
  });
  vm.runInContext(apiSource, context, { filename: "api.js" });
  context.getFreshAuthAccessToken = async () => "access-token";
  context.remoteFetch = async (url, options) => {
    request = { url, body: JSON.parse(options.body), timeoutMs: options.timeoutMs };
    return {
      ok: true,
      status: 200,
      json: async () => ({ jobId: "job-cancel", status: "cancelled", cancelled: true })
    };
  };

  const result = await context.cancelArticleGenerationWithAi();

  assert.equal(request.body.action, "cancel");
  assert.equal(request.body.jobId, "job-cancel");
  assert.equal(request.timeoutMs, 20_000);
  assert.equal(result.cancelled, true);
  assert.equal(storage.has("pendingArticleGenerationJob"), false);
});
