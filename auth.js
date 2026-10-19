function getStoredAuthSession() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function saveAuthSession(session) {
  state.authSession = session;
  if (session) {
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(AUTH_SESSION_KEY);
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

function getInviteUrl(token) {
  const url = new URL(getAuthRedirectUrl(), location.href);
  url.searchParams.set("invite", token);
  return url.href;
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
  if (!isRemoteNetworkAvailable()) return null;

  const response = await remoteFetch(`${SUPABASE_CONFIG.url.replace(/\/$/, "")}/auth/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_CONFIG.anonKey,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(`Supabase Auth ${response.status}: ${await response.text()}`);
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

async function refreshAuthSession() {
  const session = state.authSession || getStoredAuthSession();
  const expiresAt = Number(session.expires_at || 0);
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

  const nextSession = {
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token || session.refresh_token,
    token_type: refreshed.token_type || "bearer",
    expires_at: Math.floor(Date.now() / 1000) + Number(refreshed.expires_in || 3600)
  };
  saveAuthSession(nextSession);
  return nextSession;
}

async function getFreshAuthAccessToken() {
  try {
    const session = await refreshAuthSession();
    return session?.access_token || null;
  } catch (error) {
    console.info("Auth refresh skipped:", error.message);
    saveAuthSession(null);
    state.authUser = null;
    return null;
  }
}

async function loadAuthUser() {
  try {
    const session = await refreshAuthSession();
    if (!session?.access_token) {
      state.authUser = null;
      return null;
    }

    const user = await supabaseAuthRequest("user", {
      headers: { Authorization: `Bearer ${session.access_token}` }
    });
    state.authUser = user;
    return user;
  } catch (error) {
    console.info("Auth user lookup skipped:", error.message);
    state.authUser = null;
    return null;
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

  try {
    await supabaseAuthRequest(`otp?redirect_to=${encodeURIComponent(getAuthRedirectUrl())}`, {
      method: "POST",
      body: JSON.stringify({
        email,
        create_user: true,
        data: {
          full_name: email.split("@")[0]
        }
      })
    });
    $("otpVerificationWrap")?.classList.remove("hidden");
    $("otpCodeInput")?.focus();
    $("loginError").textContent = t("magicLinkSent");
  } catch (error) {
    localStorage.removeItem(AUTH_PENDING_ACTION_KEY);
    localStorage.removeItem(AUTH_OTP_EMAIL_KEY);
    console.error(error);
    $("loginError").textContent = error.message.includes("429") ? t("emailRateLimited") : t("authUnavailable");
  }
}

async function verifyEmailOtp() {
  const email = (localStorage.getItem(AUTH_OTP_EMAIL_KEY) || $("magicEmailInput")?.value || "")
    .trim()
    .toLowerCase();
  const token = String($("otpCodeInput")?.value || "").replace(/\s+/g, "");
  if (!email || !/^\d{6}$/.test(token)) {
    $("loginError").textContent = t("otpCodeFill");
    return;
  }

  $("loginError").textContent = t("otpVerifying");
  try {
    const session = await supabaseAuthRequest("verify", {
      method: "POST",
      body: JSON.stringify({ email, token, type: "email" })
    });
    if (!session?.access_token) throw new Error("Missing OTP session");
    saveAuthSession(session);
    state.authUser = session.user || await loadAuthUser();
    await loadProfiles();
    await loadArticles();
    const handled = await handlePendingAuthAction();
    if (!handled) throw new Error("OTP login was not completed");
    localStorage.removeItem(AUTH_OTP_EMAIL_KEY);
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

  if (action === "login" || action === "magic-login" || action === "email-otp") {
    const inviteToken = localStorage.getItem(AUTH_PENDING_INVITE_KEY);
    let profile = inviteToken ? await claimInvite(inviteToken) : null;
    profile = profile || state.profiles.find(item => item.authUserId === state.authUser.id);
    if (!profile) profile = await createAuthReaderProfile();
    if (!profile) {
      showLogin();
      $("loginError").textContent = t("authLoginNoProfile");
      return true;
    }

    if (!inviteToken && localStorage.getItem(AUTH_REQUESTED_ROLE_KEY) === "teacher") {
      await submitTeacherRequest(profile);
    }
    localStorage.removeItem(AUTH_REQUESTED_ROLE_KEY);

    await setCurrentProfile(profile);
    logAppEvent("profile_login", {
      profileId: profile.id,
      role: profile.role,
      source: action === "email-otp" || action === "magic-login" ? "email_otp" : "google"
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

function canCreateProfiles() {
  return isPublisherAccount() || hasTeacherLicense();
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

function canCreateTeacherProfiles() {
  return isPublisherAccount();
}

function canCreateStudentProfiles() {
  return isPublisherAccount() || hasTeacherLicense();
}

function renderProfileCreationControls() {
  $("registerProfileBtn")?.classList.add("hidden");
  $("setupPairBtn")?.classList.add("hidden");
  $("googleLoginBtn")?.classList.add("primary-btn");
  $("googleLoginBtn")?.classList.remove("secondary-btn", "quiet");
  $("teacherProfilesTabBtn")?.classList.toggle("hidden", !canCreateProfiles());
  renderProfileManagerControls();
}

function renderProfileManagerControls() {
  const roleSelect = $("newProfileRoleSelect");
  if (!roleSelect) return;

  const canCreateTeacher = canCreateTeacherProfiles();
  const roleLabel = roleSelect.closest("label");
  roleLabel?.classList.toggle("hidden", !canCreateTeacher);
  if (!canCreateTeacher) roleSelect.value = "student";
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

function makeInviteToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

async function createAuthReaderProfile() {
  if (!state.authUser?.id) return null;

  const baseName = getAuthProfileName();
  const baseId = makeProfileId(baseName) || `reader-${state.authUser.id.slice(0, 8)}`;
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
    nativeLanguage: DEFAULT_NATIVE_LANGUAGE,
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

  await loadProfiles();
  const invited = state.profiles.find(profile =>
    profile.inviteToken === token
    && (!profile.inviteClaimedAt || profile.authUserId === state.authUser.id)
  );
  if (!invited) return null;

  const claimedAt = new Date().toISOString();
  if (state.remoteReady) {
    const previousProfiles = state.profiles.filter(profile =>
      profile.authUserId === state.authUser.id && profile.id !== invited.id
    );
    for (const profile of previousProfiles) {
      await supabaseRequest(`app_profiles?id=eq.${encodeURIComponent(profile.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ auth_user_id: null })
      });
    }
    const claimedProfileUpdate = {
      auth_user_id: state.authUser.id,
      owner_auth_user_id: invited.ownerAuthUserId || state.authUser.id,
      invite_claimed_at: claimedAt
    };
    try {
      await supabaseRequest(`app_profiles?id=eq.${encodeURIComponent(invited.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(claimedProfileUpdate)
      });
    } catch (error) {
      if (!error.message.includes("invite_claimed_at")) throw error;
      const { invite_claimed_at, ...claimWithoutTimestamp } = claimedProfileUpdate;
      await supabaseRequest(`app_profiles?id=eq.${encodeURIComponent(invited.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(claimWithoutTimestamp)
      });
    }
  }

  state.profiles = state.profiles.map(profile => {
    if (profile.authUserId === state.authUser.id && profile.id !== invited.id) {
      return { ...profile, authUserId: null };
    }
    if (profile.id === invited.id) {
      return {
        ...profile,
        authUserId: state.authUser.id,
        ownerAuthUserId: profile.ownerAuthUserId || state.authUser.id,
        inviteClaimedAt: claimedAt
      };
    }
    return profile;
  });

  localStorage.setItem(PROFILE_KEY, JSON.stringify(state.profiles));
  if (!state.remoteReady) await saveProfiles();
  await loadProfiles();
  localStorage.removeItem(AUTH_PENDING_INVITE_KEY);
  return state.profiles.find(profile => profile.authUserId === state.authUser.id) || null;
}
