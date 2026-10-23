function isRemoteNetworkAvailable() {
  return Boolean(state.remoteReady && navigator.onLine !== false);
}

async function remoteFetch(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REMOTE_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: options.signal || controller.signal
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

async function generateArticleWithAi({ topic, level, category, minWords, maxWords, requiredWords }) {
  if (!isRemoteNetworkAvailable()) {
    throw new Error(t("generationOffline"));
  }

  const accessToken = await getFreshAuthAccessToken();

  if (!accessToken) {
    throw new Error(t("generationSignIn"));
  }

  const response = await remoteFetch(
    `${SUPABASE_CONFIG.url.replace(/\/$/, "")}/functions/v1/generate-article`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_CONFIG.anonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        topic,
        level,
        category,
        lengthMin: minWords,
        lengthMax: maxWords,
        requiredWords
      })    }
  );

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error || `AI generation failed: ${response.status}`);
  }

  return result;
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
