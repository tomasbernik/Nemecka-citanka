import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const authSource = await readFile(new URL("../auth.js", import.meta.url), "utf8");

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    }
  };
}

function createAuthContext({ session, user, remoteFetch, online = true }) {
  const localStorage = createStorage({
    auth: JSON.stringify(session),
    "auth:user": JSON.stringify(user)
  });
  const context = vm.createContext({
    AUTH_SESSION_KEY: "auth",
    SUPABASE_CONFIG: { url: "https://example.supabase.co", anonKey: "anon" },
    state: { authSession: session, authUser: user, remoteReady: true },
    localStorage,
    isRemoteNetworkAvailable: () => online,
    remoteFetch,
    atob: (value) => Buffer.from(value, "base64").toString("binary"),
    console,
    Date,
    URL,
    URLSearchParams,
    location: { hash: "", pathname: "/", search: "", origin: "https://app.test" },
    history: { replaceState() {} },
    setTimeout,
    clearTimeout
  });
  vm.runInContext(authSource, context, { filename: "auth.js" });
  return { context, localStorage };
}

function expiredSession() {
  return {
    access_token: "old-access-token",
    refresh_token: "refresh-token",
    expires_at: Math.floor(Date.now() / 1000) - 60
  };
}

function authResponse({ ok = true, status = 200, body = {} } = {}) {
  return {
    ok,
    status,
    async text() {
      return JSON.stringify(body);
    }
  };
}

test("temporary refresh failure keeps the stored session and user", async () => {
  const session = expiredSession();
  const user = { id: "user-1", email: "user@example.com" };
  const { context, localStorage } = createAuthContext({
    session,
    user,
    remoteFetch: async () => {
      throw new Error("network timeout");
    }
  });

  assert.equal(await context.getFreshAuthAccessToken(), null);
  assert.deepEqual(JSON.parse(localStorage.getItem("auth")), session);
  assert.deepEqual(JSON.parse(localStorage.getItem("auth:user")), user);
  assert.equal(context.state.authUser.id, user.id);
});

test("an invalid refresh token clears the session", async () => {
  const session = expiredSession();
  const user = { id: "user-1" };
  const { context, localStorage } = createAuthContext({
    session,
    user,
    remoteFetch: async () => authResponse({
      ok: false,
      status: 400,
      body: { code: 400, error_code: "refresh_token_not_found", message: "Refresh token not found" }
    })
  });

  assert.equal(await context.getFreshAuthAccessToken(), null);
  assert.equal(localStorage.getItem("auth"), null);
  assert.equal(localStorage.getItem("auth:user"), null);
  assert.equal(context.state.authUser, null);
});

test("parallel callers share one refresh request", async () => {
  const session = expiredSession();
  const user = { id: "user-1" };
  let requestCount = 0;
  const { context, localStorage } = createAuthContext({
    session,
    user,
    remoteFetch: async () => {
      requestCount += 1;
      await Promise.resolve();
      return authResponse({
        body: { access_token: "new-access-token", refresh_token: "new-refresh-token", expires_in: 3600 }
      });
    }
  });

  const tokens = await Promise.all([
    context.getFreshAuthAccessToken(),
    context.getFreshAuthAccessToken(),
    context.getFreshAuthAccessToken()
  ]);
  assert.deepEqual(tokens, ["new-access-token", "new-access-token", "new-access-token"]);
  assert.equal(requestCount, 1);
  assert.equal(JSON.parse(localStorage.getItem("auth")).refresh_token, "new-refresh-token");
});

test("offline user lookup restores the last verified user", async () => {
  const session = {
    ...expiredSession(),
    expires_at: Math.floor(Date.now() / 1000) + 3600
  };
  const user = { id: "user-1", email: "user@example.com" };
  const { context } = createAuthContext({
    session,
    user,
    online: false,
    remoteFetch: async () => {
      throw new Error("remoteFetch must not run while offline");
    }
  });
  context.state.authUser = null;

  const restoredUser = await context.loadAuthUser();
  assert.equal(restoredUser.id, user.id);
  assert.equal(context.state.authUser.id, user.id);
});
