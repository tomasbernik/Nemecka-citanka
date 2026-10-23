let authRefreshPromise = null;
let authRefreshRetryAfter = 0;

const AUTH_USER_STORAGE_KEY = `${AUTH_SESSION_KEY}:user`;
const TERMINAL_AUTH_ERROR_CODES = new Set([
  "bad_jwt",
  "refresh_token_already_used",
  "refresh_token_not_found",
  "session_expired",
  "session_not_found",
  "user_banned",
  "user_not_found",
]);

function getStoredAuthSession() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function getStoredAuthUser(session = state.authSession || getStoredAuthSession()) {
  try {
    const storedUser = JSON.parse(localStorage.getItem(AUTH_USER_STORAGE_KEY) || "null");
    if (storedUser?.id) return storedUser;
  } catch (error) {
    console.info("Stored auth user could not be read.", error);
  }

  if (session?.user?.id) return session.user;

  try {
    const payloadPart = String(session?.access_token || "").split(".")[1];
    if (!payloadPart) return null;
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payloadPart.length / 4) * 4, "=");
    const payload = JSON.parse(atob(normalized));
    return payload?.sub ? { id: payload.sub, email: payload.email || "" } : null;
  } catch {
    return null;
  }
}

function saveAuthUser(user) {
  state.authUser = user || null;
  if (user?.id) {
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
  }
}

function isDefinitiveAuthSessionError(error) {
  return TERMINAL_AUTH_ERROR_CODES.has(String(error?.code || "").toLowerCase());
}

function clearInvalidAuthSession() {
  saveAuthSession(null);
  saveAuthUser(null);
}

function saveAuthSession(session) {
  state.authSession = session;
  if (session) {
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(AUTH_SESSION_KEY);
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    state.authUser = null;
  }
}

function getAuthRedirectUrl() {
  if (SUPABASE_CONFIG.authRedirectUrl) {
    const configuredUrl = new URL(SUPABASE_CONFIG.authRedirectUrl, location.href);
    if (configuredUrl.origin === location.origin) {
      return configuredUrl.href;
    }
  }

  return `${location.origin}${location.pathname}`;
}

function getInviteTokenFromValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const url = new URL(raw, location.href);
    return url.searchParams.get("invite") || raw;
  } catch {
    return raw;
  }
}

function captureInviteFromUrl() {
  const params = new URLSearchParams(location.search);
  const token = params.get("invite");
  if (!token) return "";

  localStorage.setItem(AUTH_PENDING_INVITE_KEY, token);
  return token;
}

function getAuthAccessToken() {
  return state.authSession?.access_token || null;
}

function getCurrentAuthUserId() {
  return state.authUser?.id || null;
}

async function supabaseAuthRequest(path, options = {}) {
  if (!isRemoteNetworkAvailable()) {
    const error = new Error("Supabase Auth is temporarily unavailable while offline.");
    error.code = "network_unavailable";
    throw error;
  }

  const response = await remoteFetch(`${SUPABASE_CONFIG.url.replace(/\/$/, "")}/auth/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_CONFIG.anonKey,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }
    const errorMessage = payload?.message || payload?.msg;
    const error = new Error(errorMessage ? `Supabase Auth ${response.status}: ${errorMessage}` : `Supabase Auth ${response.status}`);
    error.status = response.status;
    error.code = payload?.error_code || payload?.code || payload?.error || "";
    throw error;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function readAuthSessionFromHash() {
  if (!location.hash.includes("access_token")) return null;

  const params = new URLSearchParams(location.hash.slice(1));
  const accessToken = params.get("access_token");
  if (!accessToken) return null;

  const expiresIn = Number(params.get("expires_in") || 3600);
  return {
    access_token: accessToken,
    refresh_token: params.get("refresh_token"),
    token_type: params.get("token_type") || "bearer",
    expires_at: Number(params.get("expires_at")) || Math.floor(Date.now() / 1000) + expiresIn
  };
}

async function performAuthSessionRefresh() {
  const session = state.authSession || getStoredAuthSession();
  const expiresAt = Number(session?.expires_at || 0);
  if (!session?.refresh_token) {
    if (expiresAt && expiresAt - 60 <= Math.floor(Date.now() / 1000)) {
      saveAuthSession(null);
      return null;
    }
    return session || null;
  }

  if (expiresAt && expiresAt - 60 > Math.floor(Date.now() / 1000)) return session;

  const refreshed = await supabaseAuthRequest("token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: session.refresh_token })
  });
  if (!refreshed?.access_token) {
    const error = new Error("Supabase Auth returned an incomplete refreshed session.");
    error.code = "invalid_refresh_response";
    throw error;
  }

  const nextSession = {
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token || session.refresh_token,
    token_type: refreshed.token_type || "bearer",
    user: refreshed.user || session.user || state.authUser || getStoredAuthUser(session),
    expires_at: Math.floor(Date.now() / 1000) + Number(refreshed.expires_in || 3600)
  };
  saveAuthSession(nextSession);
  if (nextSession.user?.id) saveAuthUser(nextSession.user);
  return nextSession;
}

async function refreshAuthSession() {
  const session = state.authSession || getStoredAuthSession();
  const expiresAt = Number(session?.expires_at || 0);
  const now = Math.floor(Date.now() / 1000);
  if (!session?.refresh_token || (expiresAt && expiresAt - 60 > now)) {
    return performAuthSessionRefresh();
  }
  if (authRefreshRetryAfter > Date.now()) {
    const error = new Error("Auth refresh is waiting before retrying a temporary failure.");
    error.code = "refresh_retry_later";
    throw error;
  }
  if (!authRefreshPromise) {
    authRefreshPromise = performAuthSessionRefresh()
      .then((nextSession) => {
        authRefreshRetryAfter = 0;
        return nextSession;
      })
      .catch((error) => {
        if (!isDefinitiveAuthSessionError(error)) authRefreshRetryAfter = Date.now() + 30_000;
        throw error;
      })
      .finally(() => {
        authRefreshPromise = null;
      });
  }
  return authRefreshPromise;
}

async function getFreshAuthAccessToken() {
  try {
    const session = await refreshAuthSession();
    return session?.access_token || null;
  } catch (error) {
    console.info("Auth refresh skipped:", error.message);
    if (isDefinitiveAuthSessionError(error)) clearInvalidAuthSession();
    return null;
  }
}

async function loadAuthUser() {
  try {
    const session = await refreshAuthSession();
    if (!session?.access_token) {
      saveAuthUser(null);
      return null;
    }

    const user = await supabaseAuthRequest("user", {
      headers: { Authorization: `Bearer ${session.access_token}` }
    });
    saveAuthUser(user);
    return user;
  } catch (error) {
    console.info("Auth user lookup skipped:", error.message);
    if (isDefinitiveAuthSessionError(error)) {
      clearInvalidAuthSession();
      return null;
    }
    const cachedUser = getStoredAuthUser();
    if (cachedUser?.id) state.authUser = cachedUser;
    return cachedUser;
  }
}

async function initAuthFromRedirect() {
  captureInviteFromUrl();
  const hashSession = readAuthSessionFromHash();
  if (hashSession) {
    saveAuthSession(hashSession);
    const cleanUrl = `${location.pathname}${location.search}`;
    history.replaceState(null, "", cleanUrl);
  } else {
    saveAuthSession(getStoredAuthSession());
  }

  if (state.authSession) {
    await loadAuthUser();
  }
}

function startGoogleAuth(action) {
  if (!state.remoteReady) {
    $("loginError").textContent = t("authUnavailable");
    return;
  }

  localStorage.setItem(AUTH_PENDING_ACTION_KEY, action);
  const params = new URLSearchParams({
    provider: "google",
    redirect_to: getAuthRedirectUrl()
  });
  location.href = `${SUPABASE_CONFIG.url.replace(/\/$/, "")}/auth/v1/authorize?${params}`;
}

async function signInWithGoogle() {
  $("loginError").textContent = t("authLinkStarted");
  rememberRequestedAuthRole();
  startGoogleAuth("login");
}

function getSelectedAuthRole() {
  return $("authRoleSelect")?.value === "teacher" ? "teacher" : "student";
}

function rememberRequestedAuthRole() {
  localStorage.setItem(AUTH_REQUESTED_ROLE_KEY, getSelectedAuthRole());
}

function getEmailPasswordCredentials() {
  return {
    email: String($("magicEmailInput")?.value || "").trim().toLowerCase(),
    password: String($("authPasswordInput")?.value || "")
  };
}

function saveAuthResponseSession(response) {
  const session = response?.session || response;
  if (!session?.access_token) return false;
  saveAuthSession(session);
  saveAuthUser(session.user || response?.user || null);
  return true;
}

async function finishEmailAuthentication(source) {
  if (!state.authUser) await loadAuthUser();
  await loadProfiles();
  await loadArticles();
  const handled = await handlePendingAuthAction();
  if (!handled) throw new Error(`${source} login was not completed`);
  localStorage.removeItem(AUTH_OTP_EMAIL_KEY);
  localStorage.removeItem(AUTH_OTP_TYPE_KEY);
}

async function signInWithPassword() {
  if (!state.remoteReady) {
    $("loginError").textContent = t("authUnavailable");
    return;
  }
  const { email, password } = getEmailPasswordCredentials();
  if (!email.includes("@") || !password) {
    $("loginError").textContent = t("emailPasswordFill");
    return;
  }

  $("loginError").textContent = t("passwordLoginStarted");
  localStorage.setItem(AUTH_PENDING_ACTION_KEY, "password-login");
  try {
    const response = await supabaseAuthRequest("token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    if (!saveAuthResponseSession(response)) throw new Error("Missing password session");
    await finishEmailAuthentication("password");
  } catch (error) {
    localStorage.removeItem(AUTH_PENDING_ACTION_KEY);
    console.error(error);
    $("loginError").textContent = t("passwordLoginInvalid");
  }
}

async function registerWithPassword() {
  if (!state.remoteReady) {
    $("loginError").textContent = t("authUnavailable");
    return;
  }
  const { email, password } = getEmailPasswordCredentials();
  if (!email.includes("@") || password.length < 8) {
    $("loginError").textContent = t("emailPasswordRegisterFill");
    return;
  }

  rememberRequestedAuthRole();
  localStorage.setItem(AUTH_PENDING_ACTION_KEY, "password-register");
  localStorage.setItem(AUTH_OTP_EMAIL_KEY, email);
  localStorage.setItem(AUTH_OTP_TYPE_KEY, "signup");
  $("loginError").textContent = t("passwordRegistrationStarted");
  try {
    const response = await supabaseAuthRequest("signup", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        data: { full_name: email.split("@")[0] }
      })
    });
    if (saveAuthResponseSession(response)) {
      await finishEmailAuthentication("registration");
      return;
    }
    $("otpVerificationWrap")?.classList.remove("hidden");
    $("otpCodeInput")?.focus();
    $("loginError").textContent = t("registrationCodeSent");
  } catch (error) {
    localStorage.removeItem(AUTH_PENDING_ACTION_KEY);
    localStorage.removeItem(AUTH_OTP_EMAIL_KEY);
    localStorage.removeItem(AUTH_OTP_TYPE_KEY);
    console.error(error);
    $("loginError").textContent = error.message.includes("429") ? t("emailRateLimited") : t("registrationFailed");
  }
}

async function sendMagicLink() {
  if (!state.remoteReady) {
    $("loginError").textContent = t("authUnavailable");
    return;
  }

  const email = $("magicEmailInput").value.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    $("loginError").textContent = t("magicLinkFill");
    return;
  }

  $("loginError").textContent = t("magicLinkStarted");
  rememberRequestedAuthRole();
  localStorage.setItem(AUTH_PENDING_ACTION_KEY, "email-otp");
  localStorage.setItem(AUTH_OTP_EMAIL_KEY, email);
  localStorage.setItem(AUTH_OTP_TYPE_KEY, "email");

  try {
    await supabaseAuthRequest(`otp?redirect_to=${encodeURIComponent(getAuthRedirectUrl())}`, {
      method: "POST",
      body: JSON.stringify({
        email,
          create_user: false
      })
    });
    $("otpVerificationWrap")?.classList.remove("hidden");
    $("otpCodeInput")?.focus();
    $("loginError").textContent = t("magicLinkSent");
  } catch (error) {
    localStorage.removeItem(AUTH_PENDING_ACTION_KEY);
    localStorage.removeItem(AUTH_OTP_EMAIL_KEY);
    localStorage.removeItem(AUTH_OTP_TYPE_KEY);
    console.error(error);
    $("loginError").textContent = error.message.includes("429") ? t("emailRateLimited") : t("authUnavailable");
  }
}

async function verifyEmailOtp() {
  const email = (localStorage.getItem(AUTH_OTP_EMAIL_KEY) || $("magicEmailInput")?.value || "")
    .trim()
    .toLowerCase();
  const token = String($("otpCodeInput")?.value || "").replace(/\s+/g, "");
  const type = localStorage.getItem(AUTH_OTP_TYPE_KEY) === "signup" ? "signup" : "email";
  if (!email || !/^\d{8}$/.test(token)) {
    $("loginError").textContent = t("otpCodeFill");
    return;
  }

  $("loginError").textContent = t("otpVerifying");
  try {
    const session = await supabaseAuthRequest("verify", {
      method: "POST",
      body: JSON.stringify({ email, token, type })
    });
    if (!saveAuthResponseSession(session)) throw new Error("Missing OTP session");
    await finishEmailAuthentication(type);
  } catch (error) {
    console.error(error);
    $("loginError").textContent = t("otpInvalid");
  }
}

async function signOutGoogle() {
  const accessToken = getAuthAccessToken();
  if (accessToken) {
    try {
      await supabaseAuthRequest("logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: "{}"
      });
    } catch (error) {
      console.info("Auth logout skipped:", error.message);
    }
  }

  saveAuthSession(null);
  state.authUser = null;
  localStorage.removeItem(AUTH_PENDING_ACTION_KEY);
  localStorage.removeItem(AUTH_REQUESTED_ROLE_KEY);
  localStorage.removeItem(AUTH_OTP_EMAIL_KEY);
  localStorage.removeItem(AUTH_OTP_TYPE_KEY);
  renderAuthControls(t("authSignedOut"));
}

async function linkCurrentProfileToAuthUser(statusTarget = "authAccountStatus") {
  const target = $(statusTarget) || $("loginError");
  if (!state.currentProfile) {
    if (target) target.textContent = t("authSignInFirst");
    return false;
  }

  const user = state.authUser || await loadAuthUser();
  if (!user?.id) {
    if (target) target.textContent = state.remoteReady ? t("authLinkStarted") : t("authUnavailable");
    startGoogleAuth("link-profile");
    return false;
  }

  try {
    await linkProfileToAuthUser(state.currentProfile, user);
    renderAuthControls(t("authLinkSuccess"));
    logAppEvent("profile_google_linked", {
      profileId: state.currentProfile.id,
      email: user.email || null
    });
    return true;
  } catch (error) {
    console.error(error);
    if (target) target.textContent = error.message || t("authUnavailable");
    return false;
  }
}

async function linkProfileToAuthUser(profile, user) {
  if (!profile?.id || !user?.id) return null;

  if (state.remoteReady) {
    const previousProfiles = state.profiles.filter(item =>
      item.authUserId === user.id && item.id !== profile.id
    );
    for (const previousProfile of previousProfiles) {
      await supabaseRequest(`app_profiles?id=eq.${encodeURIComponent(previousProfile.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ auth_user_id: null })
      });
    }

    await supabaseRequest(`app_profiles?id=eq.${encodeURIComponent(profile.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        auth_user_id: user.id,
        owner_auth_user_id: profile.ownerAuthUserId || user.id
      })
    });
  }

  state.profiles = state.profiles.map(item => {
    if (item.authUserId === user.id && item.id !== profile.id) {
      return { ...item, authUserId: null };
    }
    if (item.id === profile.id) {
      return {
        ...item,
        authUserId: user.id,
        ownerAuthUserId: item.ownerAuthUserId || user.id
      };
    }
    return item;
  });
  if (state.currentProfile?.id === profile.id) {
    state.currentProfile = normalizeProfile(state.profiles.find(item => item.id === profile.id));
  }
  localStorage.setItem(PROFILE_KEY, JSON.stringify(state.profiles));
  await loadProfiles();
  const linkedProfile = state.profiles.find(item => item.id === profile.id) || null;
  if (linkedProfile && state.currentProfile?.id === profile.id) state.currentProfile = linkedProfile;
  return linkedProfile;
}

async function handlePendingAuthAction() {
  const action = localStorage.getItem(AUTH_PENDING_ACTION_KEY);
  if (!action || !state.authUser) return false;

  localStorage.removeItem(AUTH_PENDING_ACTION_KEY);

  if (["login", "magic-login", "email-otp", "password-login", "password-register"].includes(action)) {
    const inviteToken = localStorage.getItem(AUTH_PENDING_INVITE_KEY);
    let profile = state.profiles.find(item => item.authUserId === state.authUser.id);
    if (!profile) profile = await createAuthReaderProfile();
    if (!profile) {
      showLogin();
      $("loginError").textContent = t("authLoginNoProfile");
      return true;
    }

    if (localStorage.getItem(AUTH_REQUESTED_ROLE_KEY) === "teacher") {
      await submitTeacherRequest(profile);
    }
    localStorage.removeItem(AUTH_REQUESTED_ROLE_KEY);

    await setCurrentProfile(profile);
    if (inviteToken) {
      await joinTeamByCode(inviteToken);
      localStorage.removeItem(AUTH_PENDING_INVITE_KEY);
    }
    logAppEvent("profile_login", {
      profileId: profile.id,
      role: profile.role,
      source: action === "email-otp" || action === "magic-login"
        ? "email_otp"
        : action.startsWith("password-") ? "email_password" : "google"
    });
    return true;
  }

  if (action === "link-profile") {
    await linkCurrentProfileToAuthUser();
    return true;
  }

  return false;
}

async function submitTeacherRequest(profile) {
  if (!profile?.id || !state.authUser?.id || profile.role === "teacher") return null;
  const email = state.authUser.email || state.authUser.user_metadata?.email || "";
  const rows = await supabaseRequest("rpc/app_submit_teacher_request", {
    method: "POST",
    body: JSON.stringify({
      request_profile_id: profile.id,
      request_email: email
    })
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function requestTeacherAccess() {
  const button = $("requestTeacherAccessBtn");
  if (!state.currentProfile || !state.authUser?.id || state.currentProfile.role === "teacher") return;
  if (button) button.disabled = true;
  try {
    const request = await submitTeacherRequest(state.currentProfile);
    state.currentProfile.teacherRequest = request;
    sendTeacherRequestPushNotification({
      profile: state.currentProfile,
      request
    }).catch(error => {
      console.info("Teacher request push notification skipped:", error.message);
    });
    renderCurrentProfileLabel();
    renderAuthControls(t("teacherRequestSubmitted"));
  } catch (error) {
    console.error(error);
    renderAuthControls(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

async function loadTeacherRequestForProfile(profile) {
  if (!profile?.id || !state.authUser?.id || !state.remoteReady) return null;
  try {
    const rows = await supabaseRequest(`app_teacher_requests?profile_id=eq.${encodeURIComponent(profile.id)}&select=status,license_tier,requested_at&limit=1`);
    return Array.isArray(rows) ? rows[0] || null : null;
  } catch (error) {
    console.info("Teacher request status unavailable:", error.message);
    return null;
  }
}

async function handlePendingInvite() {
  if (!state.authUser?.id) return false;
  const inviteToken = localStorage.getItem(AUTH_PENDING_INVITE_KEY);
  if (!inviteToken) return false;

  const profile = await claimInvite(inviteToken);
  if (!profile) return false;

  await setCurrentProfile(profile);
  logAppEvent("profile_invite_claimed", {
    profileId: profile.id,
    role: profile.role
  });
  return true;
}

function renderAuthControls(message = "") {
  const status = $("authAccountStatus");
  if (!status) return;

  const email = state.authUser?.email || state.authUser?.user_metadata?.email || "";
  const linked = Boolean(state.currentProfile?.authUserId);

  if (message) {
    status.textContent = message;
  } else if (linked && email) {
    status.textContent = formatText("authLinked", { email });
  } else if (email) {
    status.textContent = formatText("authSignedIn", { email });
  } else {
    status.textContent = t("authUnlinked");
  }

  $("linkGoogleAccountBtn")?.classList.toggle("hidden", linked && Boolean(email));
  $("signOutGoogleBtn")?.classList.toggle("hidden", !email);
  const canRequestTeacher = linked
    && state.currentProfile?.role !== "teacher"
    && state.currentProfile?.teacherRequest?.status !== "pending";
  $("requestTeacherAccessBtn")?.classList.toggle("hidden", !canRequestTeacher);
}

function isProfileOwnedByCurrentAuth(profile = state.currentProfile) {
  const authUserId = state.authUser?.id;
  return Boolean(
    authUserId
    && profile?.id
    && (
      profile.authUserId === authUserId
      || profile.ownerAuthUserId === authUserId
    )
  );
}

function hasTeacherLicense(profile = state.currentProfile) {
  return Boolean(
    isPublisherAccount()
    || (
      isProfileOwnedByCurrentAuth(profile)
      && profile?.role === "teacher"
      && ["pilot", "paid"].includes(profile.licenseTier)
    )
  );
}

function isCurrentGoogleAdmin() {
  const authUserId = getCurrentAuthUserId();
  return Boolean(
    authUserId
    && state.currentProfile?.role === "teacher"
    && (
      isAdminProfile()
      || state.currentProfile?.ownerAuthUserId === authUserId
    )
    && (
      state.currentProfile?.authUserId === authUserId
      || state.currentProfile?.ownerAuthUserId === authUserId
    )
  );
}

function getAuthProfileName() {
  const user = state.authUser;
  const rawName = user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || user?.user_metadata?.given_name
    || user?.email?.split("@")[0]
    || t("teacherRole");
  return rawName.trim() || t("teacherRole");
}

function makeRandomPin() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(100000 + (bytes[0] % 900000));
}

async function createAuthReaderProfile() {
  if (!state.authUser?.id) return null;

  const baseName = getAuthProfileName();
  const baseId = `${makeProfileId(baseName) || "reader"}-${state.authUser.id.slice(0, 8)}`;
  let id = baseId;
  let name = baseName;
  let counter = 2;
  while (state.profiles.some(profile => profile.id === id || normalizeName(profile.name) === normalizeName(name))) {
    name = `${baseName} ${counter}`;
    id = `${baseId}-${counter}`;
    counter += 1;
  }

  const profile = {
    id,
    name,
    pin: makeRandomPin(),
    role: "student",
    teacherGroupId: id,
    nativeLanguage: isSupportedNativeLanguage(state.preLoginLanguage)
      ? state.preLoginLanguage
      : DEFAULT_PRELOGIN_LANGUAGE,
    authUserId: state.authUser.id,
    ownerAuthUserId: state.authUser.id
  };

  await insertProfile(profile);
  await loadProfiles();
  return state.profiles.find(item => item.authUserId === state.authUser.id) || profile;
}

async function claimInvite(tokenValue) {
  const token = getInviteTokenFromValue(tokenValue);
  if (!token || !state.authUser?.id) return null;
  let profile = state.profiles.find(item => item.authUserId === state.authUser.id);
  if (!profile) profile = await createAuthReaderProfile();
  if (!profile) return null;
  await setCurrentProfile(profile);
  await joinTeamByCode(token);
  localStorage.removeItem(AUTH_PENDING_INVITE_KEY);
  return profile;
}
