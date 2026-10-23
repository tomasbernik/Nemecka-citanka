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
