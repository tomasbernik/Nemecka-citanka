function isRemoteNetworkAvailable() {
  return Boolean(state.remoteReady && navigator.onLine !== false);
}

async function remoteFetch(url, options = {}) {
  const { timeoutMs = REMOTE_REQUEST_TIMEOUT_MS, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...fetchOptions,
      signal: fetchOptions.signal || controller.signal
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function supabaseRequest(path, options = {}) {
  if (!isRemoteNetworkAvailable()) return null;
  const accessToken = await getFreshAuthAccessToken();

  const response = await remoteFetch(`${SUPABASE_CONFIG.url.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_CONFIG.anonKey,
      Authorization: `Bearer ${accessToken || SUPABASE_CONFIG.anonKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function supabaseStorageRequest(path, options = {}) {
  if (!isRemoteNetworkAvailable()) return null;
  const accessToken = await getFreshAuthAccessToken();

  const response = await remoteFetch(`${SUPABASE_CONFIG.url.replace(/\/$/, "")}/storage/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_CONFIG.anonKey,
      Authorization: `Bearer ${accessToken || SUPABASE_CONFIG.anonKey}`,
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(`Supabase Storage ${response.status}: ${await response.text()}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function translateArticleText({ articleId, sourceType, sourceText, sourceContext = "", targetLanguage }) {
  if (!isRemoteNetworkAvailable()) {
    throw new Error("translation_offline");
  }

  const accessToken = await getFreshAuthAccessToken();
  const response = await remoteFetch(`${SUPABASE_CONFIG.url.replace(/\/$/, "")}/functions/v1/translate-text`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_CONFIG.anonKey,
      Authorization: `Bearer ${accessToken || SUPABASE_CONFIG.anonKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      articleId,
      sourceType,
      sourceText,
      sourceContext,
      targetLanguage
    })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || `translation_failed_${response.status}`);
  }
  return result;
}

async function buildAppEvent(eventType, details = {}) {
  const deviceId = getDeviceId();
  return {
    event_type: eventType,
    profile_id: state.currentProfile?.id || null,
    article_id: details.articleId || state.currentArticle?.id || null,
    article_title: details.articleTitle || state.currentArticle?.title || null,
    device_id: deviceId,
    device_name: await getDeviceName(),
    ui_language: getUiLanguage(),
    native_language: getNativeLanguage(),
    details,
    user_agent: navigator.userAgent
  };
}

async function insertAppEvent(event) {
  await supabaseRequest("app_events", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(event)
  });
}

async function logAppEvent(eventType, details = {}) {
  if (!state.remoteReady) return;

  const event = await buildAppEvent(eventType, details);

  try {
    await insertAppEvent(event);
  } catch (error) {
    if (error.message.includes("device_name") || error.message.includes("device_id")) {
      try {
        const { device_id, device_name, ...eventWithoutDeviceId } = event;
        await insertAppEvent(eventWithoutDeviceId);
        return;
      } catch (fallbackError) {
        console.info("Event logging skipped:", fallbackError.message);
        return;
      }
    }
    console.info("Event logging skipped:", error.message);
  }
}

function geoAppOpenedKey() {
  return `${GEO_APP_OPENED_KEY_PREFIX}:${getDeviceId()}`;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function logAppOpened(details = {}) {
  if (!isRemoteNetworkAvailable()) return;

  const key = geoAppOpenedKey();
  const today = todayKey();

  if (localStorage.getItem(key) === today) {
    logAppEvent("app_opened", details);
    return;
  }

  try {
    const event = await buildAppEvent("app_opened", details);
    const response = await remoteFetch(`${SUPABASE_CONFIG.url.replace(/\/$/, "")}/functions/v1/log-app-opened`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_CONFIG.anonKey,
        Authorization: `Bearer ${SUPABASE_CONFIG.anonKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(event)
    });

    if (!response.ok) {
      throw new Error(`Edge Function ${response.status}: ${await response.text()}`);
    }

    localStorage.setItem(key, today);
  } catch (error) {
    console.info("Geo app_opened logging skipped:", error.message);
    logAppEvent("app_opened", details);
  }
}

async function requestArticleGenerationPhase(accessToken, action, payload = {}, timeoutMs = ARTICLE_GENERATION_TIMEOUT_MS) {
  const response = await remoteFetch(
    `${SUPABASE_CONFIG.url.replace(/\/$/, "")}/functions/v1/generate-article-workflow`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_CONFIG.anonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ action, ...payload }),
      timeoutMs
    }
  );

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = result.message ? `${result.error}: ${result.message}` : result.error;
    const error = new Error(detail || `AI generation failed: ${response.status}`);
    error.code = result.error || "generation_failed";
    error.phase = result.phase || action;
    error.jobId = result.jobId || payload.jobId || "";
    throw error;
  }
  return result;
}

function readPendingArticleGeneration() {
  try {
    return JSON.parse(localStorage.getItem(ARTICLE_GENERATION_JOB_KEY) || "null");
  } catch {
    return null;
  }
}

function savePendingArticleGeneration(value) {
  if (value?.jobId) localStorage.setItem(ARTICLE_GENERATION_JOB_KEY, JSON.stringify(value));
  else localStorage.removeItem(ARTICLE_GENERATION_JOB_KEY);
}

const cancelledArticleGenerationJobs = new Set();

function articleGenerationCancelledError(jobId) {
  const error = new Error("generation_cancelled");
  error.code = "generation_cancelled";
  error.jobId = jobId;
  return error;
}

function articleGenerationPhase(status) {
  if (/^review_/.test(status)) return "review";
  if (/^materials_/.test(status)) return "materials";
  return "draft";
}

const waitForArticleGenerationPoll = delay => new Promise(resolve => window.setTimeout(resolve, delay));

async function waitForArticleGeneration(accessToken, jobId, onProgress) {
  const deadline = Date.now() + ARTICLE_GENERATION_POLL_LIMIT_MS;
  let lastStatus = "";

  while (Date.now() < deadline) {
    if (cancelledArticleGenerationJobs.has(jobId)) {
      savePendingArticleGeneration(null);
      throw articleGenerationCancelledError(jobId);
    }
    let result;
    try {
      result = await requestArticleGenerationPhase(
        accessToken,
        "status",
        { jobId },
        ARTICLE_GENERATION_STATUS_TIMEOUT_MS
      );
    } catch (error) {
      if (error?.code === "login_required" || error?.code === "generation_job_not_found") throw error;
      await waitForArticleGenerationPoll(ARTICLE_GENERATION_POLL_INTERVAL_MS);
      continue;
    }

    if (cancelledArticleGenerationJobs.has(jobId) || result.status === "cancelled") {
      savePendingArticleGeneration(null);
      throw articleGenerationCancelledError(jobId);
    }

    if (result.status === "completed" && result.article) {
      savePendingArticleGeneration(null);
      return result;
    }
    if (/_failed$/.test(result.status || "")) {
      savePendingArticleGeneration(null);
      const error = new Error(result.lastError || result.lastErrorCode || "generation_failed");
      error.code = result.lastErrorCode || "generation_failed";
      error.jobId = jobId;
      throw error;
    }

    if (result.status !== lastStatus || result.lastError) {
      onProgress?.(result.lastError ? "retry" : articleGenerationPhase(result.status || ""), result);
      lastStatus = result.status;
    }
    await waitForArticleGenerationPoll(ARTICLE_GENERATION_POLL_INTERVAL_MS);
  }

  const error = new Error("generation_continues_in_background");
  error.code = "generation_continues_in_background";
  error.jobId = jobId;
  throw error;
}

async function resumeArticleGenerationWithAi({ onProgress } = {}) {
  const pending = readPendingArticleGeneration();
  if (!pending?.jobId || !isRemoteNetworkAvailable()) return null;
  const accessToken = await getFreshAuthAccessToken();
  if (!accessToken) return null;
  onProgress?.("starting", { resumed: true, jobId: pending.jobId });
  return waitForArticleGeneration(accessToken, pending.jobId, onProgress);
}

async function recoverArticleGenerationWithAi(jobId) {
  const normalizedJobId = String(jobId || "").trim();
  if (!normalizedJobId) throw new Error("generation_job_not_found");
  if (!isRemoteNetworkAvailable()) throw new Error(t("generationOffline"));
  const accessToken = await getFreshAuthAccessToken();
  if (!accessToken) throw new Error(t("generationSignIn"));
  const result = await requestArticleGenerationPhase(
    accessToken,
    "status",
    { jobId: normalizedJobId },
    ARTICLE_GENERATION_STATUS_TIMEOUT_MS
  );
  if (result.status !== "completed" || !result.article) {
    const error = new Error(result.lastError || result.lastErrorCode || "generation_not_completed");
    error.code = result.lastErrorCode || "generation_not_completed";
    error.jobId = normalizedJobId;
    throw error;
  }
  return result;
}

async function cancelArticleGenerationWithAi() {
  const pending = readPendingArticleGeneration();
  if (!pending?.jobId) return { cancelled: false, status: "not_found" };
  if (!isRemoteNetworkAvailable()) throw new Error(t("generationOffline"));

  const accessToken = await getFreshAuthAccessToken();
  if (!accessToken) throw new Error(t("generationSignIn"));

  try {
    const result = await requestArticleGenerationPhase(
      accessToken,
      "cancel",
      { jobId: pending.jobId },
      ARTICLE_GENERATION_STATUS_TIMEOUT_MS
    );
    if (result.cancelled === true) {
      cancelledArticleGenerationJobs.add(pending.jobId);
      savePendingArticleGeneration(null);
    } else {
      cancelledArticleGenerationJobs.delete(pending.jobId);
    }
    return result;
  } catch (error) {
    cancelledArticleGenerationJobs.delete(pending.jobId);
    throw error;
  }
}

async function generateArticleWithAi({
  topic,
  level,
  category,
  minWords,
  maxWords,
  requiredWords,
  languageFocus,
  storyContext = null,
  onProgress
}) {
  if (!isRemoteNetworkAvailable()) {
    throw new Error(t("generationOffline"));
  }

  const accessToken = await getFreshAuthAccessToken();

  if (!accessToken) {
    throw new Error(t("generationSignIn"));
  }

  const generationRequest = {
    topic,
    level,
    category,
    lengthMin: minWords,
    lengthMax: maxWords,
    requiredWords,
    languageFocus,
    ...(storyContext ? { storyContext } : {})
  };
  const signature = JSON.stringify(generationRequest);
  const pending = readPendingArticleGeneration();

  onProgress?.("starting", { resumed: pending?.signature === signature });
  const started = pending?.jobId && pending.signature === signature
    ? { jobId: pending.jobId, resumed: true }
    : await requestArticleGenerationPhase(accessToken, "start", generationRequest);
  const jobId = started.jobId;
  if (!jobId) throw new Error("generation_job_create_failed");
  savePendingArticleGeneration({ jobId, signature, createdAt: Date.now() });
  onProgress?.("starting", { resumed: started.resumed === true, jobId });
  return waitForArticleGeneration(accessToken, jobId, onProgress);
}

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, character => character.charCodeAt(0));
}

async function pushNotificationRequest(payload) {
  if (!isRemoteNetworkAvailable()) throw new Error("push_offline");
  const accessToken = await getFreshAuthAccessToken();
  if (!accessToken) throw new Error("push_sign_in_required");

  const response = await remoteFetch(
    `${SUPABASE_CONFIG.url.replace(/\/$/, "")}/functions/v1/push-notifications`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_CONFIG.anonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }
  );
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `push_failed_${response.status}`);
  return result;
}

async function syncPushSubscription({ requestPermission = false } = {}) {
  if (state.currentProfile?.role !== "student" && !isPublisherAccount()) return false;
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("push_unsupported");
  }

  let permission = Notification.permission;
  if (permission === "default" && requestPermission) {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") return false;

  const registration = await navigator.serviceWorker.ready;
  const { publicKey } = await pushNotificationRequest({ action: "config" });
  if (!publicKey) throw new Error("push_not_configured");
  const applicationServerKey = urlBase64ToUint8Array(publicKey);
  let subscription = await registration.pushManager.getSubscription();
  const currentKey = subscription?.options?.applicationServerKey
    ? new Uint8Array(subscription.options.applicationServerKey)
    : null;
  const keyChanged = currentKey && (
    currentKey.length !== applicationServerKey.length
    || currentKey.some((byte, index) => byte !== applicationServerKey[index])
  );
  if (subscription && keyChanged) {
    await subscription.unsubscribe();
    subscription = null;
  }
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey
    });
  }

  await pushNotificationRequest({
    action: "subscribe",
    profileId: state.currentProfile.id,
    deviceId: getDeviceId(),
    subscription: subscription.toJSON()
  });
  return true;
}

async function sendAssignmentPushNotification({ article, student, teamId }) {
  if (!article?.id || !student?.id || !teamId) return null;
  return pushNotificationRequest({
    action: "notify-assignment",
    articleId: article.id,
    profileId: student.id,
    teamId
  });
}

async function sendTeacherRequestPushNotification({ profile, request }) {
  if (!profile?.id || request?.status !== "pending") return null;
  return pushNotificationRequest({
    action: "notify-teacher-request",
    profileId: profile.id
  });
}
