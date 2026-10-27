async function loadProfiles() {
  state.profiles = JSON.parse(localStorage.getItem(PROFILE_KEY) || "[]");
  state.profiles = state.profiles.map(normalizeProfile);
  ensureProfileGroups();
  const localProfilesById = new Map(state.profiles.map(profile => [profile.id, profile]));

  if (!state.remoteReady) return;

  try {
    let profiles;
    try {
      profiles = await supabaseRequest("app_profiles?select=id,name,role,license_tier,native_language,teacher_group_id,auth_user_id,owner_auth_user_id,invite_claimed_at&order=role.desc,name.asc");
    } catch (error) {
      try {
        profiles = await supabaseRequest("app_profiles?select=id,name,role,native_language,teacher_group_id,auth_user_id,owner_auth_user_id&order=role.desc,name.asc");
      } catch {
        profiles = await supabaseRequest("app_profiles?select=id,name,role,native_language,teacher_group_id&order=role.desc,name.asc");
      }
    }
    if (Array.isArray(profiles) && state.authUser) {
      state.profiles = profiles.map(row => rowToProfile(row, localProfilesById.get(row.id)));
      ensureProfileGroups();
      localStorage.setItem(PROFILE_KEY, JSON.stringify(state.profiles));
      if (shouldSyncSavedProfileLanguage(localProfilesById)) await saveProfiles();
    } else if (profiles?.length) {
      state.profiles = profiles.map(row => rowToProfile(row, localProfilesById.get(row.id)));
      ensureProfileGroups();
      localStorage.setItem(PROFILE_KEY, JSON.stringify(state.profiles));
    } else if (state.profiles.length) {
      await saveProfiles();
    }
  } catch (error) {
    console.error(error);
  }
}

async function saveProfiles() {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(state.profiles));

  if (!state.remoteReady || !state.authUser?.id || !state.profiles.length) return;

  const writableProfiles = isPublisherAccount()
    ? state.profiles
    : state.profiles.filter(profile =>
        profile.authUserId === state.authUser.id
        || profile.ownerAuthUserId === state.authUser.id
      );
  if (!writableProfiles.length) return;

  try {
    try {
      await supabaseRequest("app_profiles?on_conflict=id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify(writableProfiles.map(profileToRow))
      });
    } catch (error) {
      await supabaseRequest("app_profiles?on_conflict=id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify(writableProfiles.map(({ id, name, pin, role }) => ({ id, name, pin, role })))
      });
    }
  } catch (error) {
    console.error(error);
  }
}

async function insertProfile(profile) {
  if (state.remoteReady) {
    await supabaseRequest("app_profiles", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(profileToRow(profile))
    });
  }

  state.profiles = [...state.profiles, profile];
  localStorage.setItem(PROFILE_KEY, JSON.stringify(state.profiles));
}

function normalizeProfile(profile) {
  return {
    ...profile,
    teacherGroupId: profile?.teacherGroupId || profile?.teacher_group_id || null,
    authUserId: profile?.authUserId || profile?.auth_user_id || null,
    ownerAuthUserId: profile?.ownerAuthUserId || profile?.owner_auth_user_id || profile?.authUserId || profile?.auth_user_id || null,
    inviteToken: profile?.inviteToken || profile?.invite_token || null,
    inviteClaimedAt: profile?.inviteClaimedAt || profile?.invite_claimed_at || null,
    licenseTier: profile?.licenseTier || profile?.license_tier || "none",
    nativeLanguage: isSupportedNativeLanguage(profile?.nativeLanguage)
      ? profile.nativeLanguage
      : DEFAULT_NATIVE_LANGUAGE
  };
}

function ensureProfileGroups() {
  if (!state.profiles.length) return;

  const fallbackTeacher = state.profiles.find(profile => profile.role === "teacher") || state.profiles[0];
  state.profiles = state.profiles.map(profile => ({
    ...profile,
    teacherGroupId: profile.teacherGroupId || (profile.role === "teacher" ? profile.id : fallbackTeacher.id)
  }));
}

function profileLanguageKey(profileId) {
  return `${PROFILE_LANGUAGE_KEY_PREFIX}:${profileId}`;
}

function getStoredProfileLanguage(profileId) {
  const language = localStorage.getItem(profileLanguageKey(profileId));
  return isSupportedNativeLanguage(language) ? language : null;
}

function setStoredProfileLanguage(profileId, language) {
  if (!profileId || !isSupportedNativeLanguage(language)) return;
  localStorage.setItem(profileLanguageKey(profileId), language);
}

function resolveProfileNativeLanguage(row, fallbackProfile = null) {
  const savedProfileId = localStorage.getItem(CURRENT_PROFILE_KEY);
  const storedLanguage = getStoredProfileLanguage(row.id);
  const localLanguage = isSupportedNativeLanguage(fallbackProfile?.nativeLanguage)
    ? fallbackProfile.nativeLanguage
    : null;
  const remoteLanguage = isSupportedNativeLanguage(row.native_language)
    ? row.native_language
    : null;

  if (storedLanguage) return storedLanguage;
  if (row.id === savedProfileId && localLanguage) return localLanguage;
  return remoteLanguage || localLanguage || DEFAULT_NATIVE_LANGUAGE;
}

function shouldSyncSavedProfileLanguage(localProfilesById) {
  const savedProfileId = localStorage.getItem(CURRENT_PROFILE_KEY);
  if (!savedProfileId) return false;

  const localLanguage = getStoredProfileLanguage(savedProfileId)
    || localProfilesById.get(savedProfileId)?.nativeLanguage;
  const remoteProfile = state.profiles.find(profile => profile.id === savedProfileId);
  return isSupportedNativeLanguage(localLanguage)
    && remoteProfile
    && remoteProfile.nativeLanguage === localLanguage;
}

function rowToProfile(row, fallbackProfile = null) {
  return normalizeProfile({
    id: row.id,
    name: row.name,
    pin: row.pin,
    role: row.role,
    licenseTier: row.license_tier || "none",
    nativeLanguage: resolveProfileNativeLanguage(row, fallbackProfile),
    teacherGroupId: row.teacher_group_id,
    authUserId: row.auth_user_id,
    ownerAuthUserId: row.owner_auth_user_id,
    inviteToken: row.invite_token,
    inviteClaimedAt: row.invite_claimed_at
  });
}

function profileToRow(profile) {
  const row = {
    id: profile.id,
    name: profile.name,
    pin: profile.pin,
    role: profile.role,
    license_tier: profile.licenseTier || "none",
    teacher_group_id: profile.teacherGroupId || profile.id,
    native_language: getNativeLanguage(profile),
    auth_user_id: profile.authUserId || null,
    owner_auth_user_id: profile.ownerAuthUserId || profile.authUserId || null
  };

  if (profile.inviteToken) row.invite_token = profile.inviteToken;
  if (profile.inviteClaimedAt) row.invite_claimed_at = profile.inviteClaimedAt;

  return row;
}

async function loadProfileData(profile) {
  const localData = JSON.parse(localStorage.getItem(profileDataKey(profile.id)) || "null");
  state.profileData = localData ? { ...emptyProfileData(), ...localData } : emptyProfileData();

  if (localStorage.getItem(LEGACY_MIGRATION_KEY) !== "true") {
    state.profileData.readIds = JSON.parse(localStorage.getItem("readIds") || "[]");
    state.profileData.discoveredVocabulary = JSON.parse(localStorage.getItem("discoveredVocabulary") || "{}");
    localStorage.setItem(LEGACY_MIGRATION_KEY, "true");
  }

  if (!state.remoteReady) {
    localStorage.setItem(profileDataKey(profile.id), JSON.stringify(state.profileData));
    return;
  }

  try {
    const rows = await supabaseRequest(`app_profile_data?profile_id=eq.${encodeURIComponent(profile.id)}&select=data`);
    if (rows?.[0]?.data) {
      state.profileData = { ...emptyProfileData(), ...rows[0].data };
      localStorage.setItem(profileDataKey(profile.id), JSON.stringify(state.profileData));
    } else {
      await saveProfileData();
    }
  } catch (error) {
    console.error(error);
  }
}

async function setCurrentProfile(profile) {
  state.currentProfile = normalizeProfile(profile);
  localStorage.setItem(CURRENT_PROFILE_KEY, profile.id);
  await loadProfileData(state.currentProfile);
  state.currentProfile.teacherRequest = await loadTeacherRequestForProfile(state.currentProfile);
  await loadTeams();
  if (state.articles.length) {
    saveCachedArticles(state.articles, getNativeLanguage(state.currentProfile)).catch(error => {
      console.info("Article cache save skipped:", error.message);
    });
  }
  renderNativeLanguageControls();
  renderRoleControls();
  renderProfileNameSettings();
  renderCurrentProfileLabel();
  renderAuthControls();
  updateStaticTexts();
  $("settingsBtn").classList.remove("hidden");
  $("teacherBtn").classList.add("hidden");
  $("shareAppBtn").classList.remove("hidden");
  $("logoutBtn").classList.remove("hidden");
  renderAccessControls();
  showHome();
  if ((state.currentProfile.role === "student" || isPublisherAccount())
    && "Notification" in window
    && Notification.permission === "granted") {
    syncPushSubscription().catch(error => {
      console.info("Push subscription refresh skipped:", error.message);
    });
  }
  await openAssignedArticleFromUrl();
  if (!hasUnseenAssignments()) showStartupQuiz();
}

function showLogin() {
  stopReading();
  document.body.classList.remove("has-guest-auth");
  const pendingInvite = Boolean(localStorage.getItem(AUTH_PENDING_INVITE_KEY));
  if ($("authRoleSelect")) {
    $("authRoleSelect").value = "student";
    $("authRoleSelect").disabled = pendingInvite;
  }
  $("otpVerificationWrap")?.classList.toggle(
    "hidden",
    !localStorage.getItem(AUTH_OTP_EMAIL_KEY)
  );
  $("settingsBtn").classList.add("hidden");
  $("teacherBtn").classList.add("hidden");
  $("shareAppBtn").classList.add("hidden");
  $("logoutBtn").classList.add("hidden");
  $("guestAuthBtn")?.classList.add("hidden");
  renderNativeLanguageControls();
  updateStaticTexts();
  showView("loginView");
}

function showGuestHome() {
  stopReading();
  state.currentProfile = null;
  state.currentArticle = null;
  state.profileData = emptyProfileData();
  $("settingsBtn").classList.add("hidden");
  $("teacherBtn").classList.add("hidden");
  $("shareAppBtn").classList.remove("hidden");
  $("logoutBtn").classList.add("hidden");
  renderNativeLanguageControls();
  updateStaticTexts();
  renderAccessControls();
  showHome();
}

function logout() {
  stopReading();
  state.currentProfile = null;
  state.profileData = emptyProfileData();
  state.currentArticle = null;
  localStorage.removeItem(CURRENT_PROFILE_KEY);
  showLogin();
}

function renderNativeLanguageSelect(selectId, value = DEFAULT_NATIVE_LANGUAGE) {
  const select = $(selectId);
  if (!select) return;

  const selectedValue = isSupportedNativeLanguage(value) ? value : DEFAULT_PRELOGIN_LANGUAGE;
  const preservedLegacyOption = isSupportedNativeLanguage(selectedValue)
    && !isSelectableNativeLanguage(selectedValue)
    ? `<option value="${selectedValue}" hidden>${escapeHtml(NATIVE_LANGUAGES[selectedValue].label)}</option>`
    : "";
  select.innerHTML = preservedLegacyOption + SELECTABLE_NATIVE_LANGUAGE_CODES
    .map(code => `<option value="${code}">${escapeHtml(NATIVE_LANGUAGES[code].label)}</option>`)
    .join("");
  select.value = selectedValue;
}

function renderNativeLanguageControls() {
  const profileLanguage = getNativeLanguage();
  const loginLanguage = state.currentProfile
    ? profileLanguage
    : isSupportedNativeLanguage(state.preLoginLanguage) ? state.preLoginLanguage : DEFAULT_PRELOGIN_LANGUAGE;
  renderNativeLanguageSelect("loginNativeLanguageSelect", loginLanguage);
  renderNativeLanguageSelect("settingsNativeLanguageSelect", profileLanguage);
}

function renderRoleControls() {
  const select = $("settingsRoleSelect");
  if (!select) return;
  if (state.currentProfile) select.value = state.currentProfile.role;
  select.closest("label")?.classList.add("hidden");
}

function renderProfileNameSettings() {
  const section = $("displayNameSection");
  const input = $("displayNameInput");
  if (!section || !input) return;
  const canEdit = Boolean(state.currentProfile?.id && state.authUser?.id);
  section.classList.toggle("hidden", !canEdit);
  input.value = canEdit ? state.currentProfile.name : "";
  if ($("displayNameStatus")) $("displayNameStatus").textContent = "";
}

async function updateCurrentProfileDisplayName() {
  const profile = state.currentProfile;
  const input = $("displayNameInput");
  const status = $("displayNameStatus");
  if (!profile?.id || !state.authUser?.id || !input || !status) return;

  const name = String(input.value || "").trim();
  if (!name) {
    status.textContent = t("displayNameRequired");
    return;
  }
  if (name.length > 80) {
    status.textContent = t("displayNameTooLong");
    return;
  }
  const duplicate = state.profiles.some(item =>
    item.id !== profile.id && normalizeName(item.name) === normalizeName(name)
  );
  if (duplicate) {
    status.textContent = t("displayNameExists");
    return;
  }
  if (name === profile.name) {
    status.textContent = t("displayNameSaved");
    return;
  }
  if (!state.remoteReady || !isRemoteNetworkAvailable()) {
    status.textContent = t("displayNameSaveFailed");
    return;
  }

  try {
    await supabaseRequest(`app_profiles?id=eq.${encodeURIComponent(profile.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ name })
    });
    state.currentProfile = { ...profile, name };
    state.profiles = state.profiles.map(item => item.id === profile.id ? { ...item, name } : item);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(state.profiles));
    input.value = name;
    status.textContent = t("displayNameSaved");
    renderCurrentProfileLabel();
    renderTeamManagement();
    renderArticles();
  } catch (error) {
    status.textContent = /duplicate|unique|409/i.test(error.message)
      ? t("displayNameExists")
      : t("displayNameSaveFailed");
  }
}

function renderCurrentProfileLabel() {
  const profile = state.currentProfile;
  if (!profile) {
    $("currentProfileLabel").textContent = t("guestBrowsingLabel");
    return;
  }

  const connectionLabel = state.remoteReady
    ? isRemoteNetworkAvailable() ? t("online") : t("offline")
    : t("local");
  const accessLabel = profile.role === "teacher"
    ? `${t("teacher")} • ${t(profile.licenseTier === "paid" ? "paidLicense" : "pilotLicense")}`
    : profile.teacherRequest?.status === "pending"
      ? `${t("student")} • ${t("teacherRequestPending")}`
      : t("student");
  $("currentProfileLabel").textContent = `${profile.name} • ${accessLabel} • ${connectionLabel}`;
}

function renderAccessControls() {
  const isGuest = !state.currentProfile;
  $("guestAuthBtn")?.classList.toggle("hidden", !isGuest);
  document.body.classList.toggle("has-guest-auth", isGuest);
  $("profileProgressBtn")?.classList.toggle("hidden", isGuest);
  renderCurrentProfileLabel();
}

async function updateCurrentProfileNativeLanguage(language) {
  if (!state.currentProfile || !isSelectableNativeLanguage(language)) return;

  setStoredProfileLanguage(state.currentProfile.id, language);
  state.currentProfile.nativeLanguage = language;
  state.profiles = state.profiles.map(profile =>
    profile.id === state.currentProfile.id ? { ...profile, nativeLanguage: language } : profile
  );
  await saveProfiles();
  if (state.articles.length) await saveCachedArticles(state.articles, language);
  renderNativeLanguageControls();
  updateStaticTexts();

  if (state.currentArticle) {
    renderVocabulary();
    renderArticleText(state.currentArticle);
    renderQuestions(state.currentArticle);
    renderArticleTaskProgress();
    startMatchGame();
    startVocabChoiceGame();
    startWordSearchGame();
  } else {
    renderArticles();
  }
}

async function updateCurrentProfileRole(role) {
  if (!state.currentProfile || !["teacher", "student"].includes(role)) return;

  state.currentProfile.role = role;
  if (role === "teacher" && !state.currentProfile.teacherGroupId) {
    state.currentProfile.teacherGroupId = state.currentProfile.id;
  }
  state.profiles = state.profiles.map(profile =>
    profile.id === state.currentProfile.id ? { ...profile, role, teacherGroupId: state.currentProfile.teacherGroupId } : profile
  );
  await saveProfiles();
  renderRoleControls();
  renderCurrentProfileLabel();
  $("teacherBtn").classList.add("hidden");
  renderMobileBottomNav(getActiveViewId());
  renderArticles();
}
