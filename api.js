async function supabaseRequest(path, options = {}) {
  if (!state.remoteReady) return null;
  const accessToken = await getFreshAuthAccessToken();

  const response = await fetch(`${SUPABASE_CONFIG.url.replace(/\/$/, "")}/rest/v1/${path}`, {
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
  if (!state.remoteReady) return null;
  const accessToken = await getFreshAuthAccessToken();

  const response = await fetch(`${SUPABASE_CONFIG.url.replace(/\/$/, "")}/storage/v1/${path}`, {
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
  if (!state.remoteReady) return;

  const key = geoAppOpenedKey();
  const today = todayKey();

  if (localStorage.getItem(key) === today) {
    logAppEvent("app_opened", details);
    return;
  }

  try {
    const event = await buildAppEvent("app_opened", details);
    const response = await fetch(`${SUPABASE_CONFIG.url.replace(/\/$/, "")}/functions/v1/log-app-opened`, {
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
