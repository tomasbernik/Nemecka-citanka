async function loadProfiles() {
  state.profiles = JSON.parse(localStorage.getItem(PROFILE_KEY) || "[]");
  state.profiles = state.profiles.map(normalizeProfile);
  ensureProfileGroups();

  if (!state.remoteReady) return;

  try {
    let profiles;
    try {
      profiles = await supabaseRequest("app_profiles?select=id,name,pin,role,native_language,teacher_group_id,auth_user_id,owner_auth_user_id,invite_token,invite_claimed_at&order=role.desc,name.asc");
    } catch (error) {
      try {
        profiles = await supabaseRequest("app_profiles?select=id,name,pin,role,native_language,teacher_group_id,auth_user_id,owner_auth_user_id&order=role.desc,name.asc");
      } catch {
        profiles = await supabaseRequest("app_profiles?select=id,name,pin,role,native_language,teacher_group_id&order=role.desc,name.asc");
      }
    }
    if (profiles?.length) {
      state.profiles = profiles.map(rowToProfile);
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

  if (!state.remoteReady || !state.profiles.length) return;

  try {
    try {
      await supabaseRequest("app_profiles?on_conflict=id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify(state.profiles.map(profileToRow))
      });
    } catch (error) {
      await supabaseRequest("app_profiles?on_conflict=id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify(state.profiles.map(({ id, name, pin, role }) => ({ id, name, pin, role })))
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

function rowToProfile(row) {
  return normalizeProfile({
    id: row.id,
    name: row.name,
    pin: row.pin,
    role: row.role,
    nativeLanguage: row.native_language,
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
  renderNativeLanguageControls();
  renderRoleControls();
  renderCurrentProfileLabel();
  renderAuthControls();
  renderProfileCreationControls();
  updateStaticTexts();
  $("settingsBtn").classList.remove("hidden");
  $("teacherBtn").classList.add("hidden");
  $("shareAppBtn").classList.remove("hidden");
  $("logoutBtn").classList.remove("hidden");
  showHome();
  if (!hasUnseenAssignments()) showStartupQuiz();
}

function showLogin() {
  stopReading();
  $("settingsBtn").classList.add("hidden");
  $("teacherBtn").classList.add("hidden");
  $("shareAppBtn").classList.add("hidden");
  $("logoutBtn").classList.add("hidden");
  renderNativeLanguageControls();
  updateStaticTexts();
  renderProfileCreationControls();
  showView("loginView");
}

function showSetup() {
  if (state.profiles.length && !canCreateProfiles()) {
    showLogin();
    return;
  }
  stopReading();
  $("settingsBtn").classList.toggle("hidden", !state.currentProfile);
  $("teacherBtn").classList.add("hidden");
  $("shareAppBtn").classList.toggle("hidden", !state.currentProfile);
  $("logoutBtn").classList.toggle("hidden", !state.currentProfile);
  renderNativeLanguageControls();
  updateStaticTexts();
  showView("setupView");
}

async function login() {
  const name = normalizeName($("loginNameInput").value);
  const pin = $("loginPinInput").value.trim();

  if (!name || !pin) {
    $("loginError").textContent = t("loginFill");
    logAppEvent("login_failed", {
      attemptedName: name,
      reason: "missing_fields"
    });
    return;
  }

  const profile = state.profiles.find(item => normalizeName(item.name) === name && item.pin === pin);

  if (!profile) {
    $("loginError").textContent = t("loginMismatch");
    logAppEvent("login_failed", {
      attemptedName: name,
      reason: "wrong_credentials"
    });
    return;
  }

  $("loginError").textContent = "";
  $("loginPinInput").value = "";
  const nativeLanguage = $("loginNativeLanguageSelect").value;
  if (isSupportedNativeLanguage(nativeLanguage) && profile.nativeLanguage !== nativeLanguage) {
    profile.nativeLanguage = nativeLanguage;
    state.profiles = state.profiles.map(item => item.id === profile.id ? profile : item);
    await saveProfiles();
  }
  await setCurrentProfile(profile);
  logAppEvent("login_success", {
    profileId: profile.id,
    role: profile.role,
    nativeLanguage: profile.nativeLanguage
  });
  logAppEvent("profile_selected", {
    profileId: profile.id,
    role: profile.role,
    source: "login"
  });
  logAppEvent("profile_login", {
    profileId: profile.id,
    role: profile.role,
    nativeLanguage: profile.nativeLanguage
  });
}

async function registerProfileFromLogin() {
  $("loginError").textContent = t("registrationClosed");
}

async function createProfiles() {
  if (state.profiles.length && !canCreateProfiles()) {
    $("setupError").textContent = t("authSignInFirst");
    return;
  }

  const teacherName = $("teacherNameInput").value.trim();
  const teacherPin = makeRandomPin();
  const teacherRole = $("teacherRoleSelect").value;
  const teacherNativeLanguage = $("teacherNativeLanguageSelect").value || DEFAULT_NATIVE_LANGUAGE;
  const studentName = $("studentNameInput").value.trim();
  const studentPin = makeRandomPin();
  const studentRole = $("studentRoleSelect").value;
  const studentNativeLanguage = $("setupNativeLanguageSelect").value || DEFAULT_NATIVE_LANGUAGE;

  if (!teacherName || !studentName) {
    $("setupError").textContent = t("setupFill");
    return;
  }

  if (normalizeName(teacherName) === normalizeName(studentName)) {
    $("setupError").textContent = t("setupDifferentNames");
    return;
  }

  if (teacherRole === studentRole) {
    $("setupError").textContent = t("setupDifferentRoles");
    return;
  }

  if (state.profiles.length && (teacherRole === "teacher" || studentRole === "teacher") && !canCreateTeacherProfiles()) {
    $("setupError").textContent = t("teacherCreationRestricted");
    return;
  }

  const existingNames = new Set(state.profiles.map(profile => normalizeName(profile.name)));
  if (existingNames.has(normalizeName(teacherName)) || existingNames.has(normalizeName(studentName))) {
    $("setupError").textContent = t("setupNameExists");
    return;
  }

  const firstProfileId = makeProfileId(teacherName);
  const secondProfileId = makeProfileId(studentName);
  const groupId = teacherRole === "teacher" ? firstProfileId : secondProfileId;
  const ownerAuthUserId = getCurrentAuthUserId() || state.currentProfile?.ownerAuthUserId || state.currentProfile?.authUserId || null;
  const newProfiles = [
    { id: firstProfileId, name: teacherName, pin: teacherPin, role: teacherRole, teacherGroupId: groupId, nativeLanguage: teacherNativeLanguage, ownerAuthUserId },
    { id: secondProfileId, name: studentName, pin: studentPin, role: studentRole, teacherGroupId: groupId, nativeLanguage: studentNativeLanguage, ownerAuthUserId }
  ];
  state.profiles = [...state.profiles, ...newProfiles];
  await saveProfiles();
  $("setupError").textContent = "";
  if (state.currentProfile) {
    await loadProfiles();
    renderNativeLanguageControls();
    renderProfileCreationControls();
    await showTeacherView();
  } else {
    await setCurrentProfile(newProfiles.find(profile => profile.role === "teacher") || newProfiles[0]);
  }
  newProfiles.forEach(profile => {
    logAppEvent("profile_created", {
      profileId: profile.id,
      role: profile.role,
      nativeLanguage: profile.nativeLanguage,
      source: "pair_setup"
    });
  });
}

async function createSingleProfile() {
  if (!canCreateProfiles()) {
    $("newProfileStatus").textContent = t("authSignInFirst");
    return;
  }

  const name = $("newProfileNameInput").value.trim();
  const pin = makeRandomPin();
  const nativeLanguage = $("newProfileNativeLanguageSelect").value || DEFAULT_NATIVE_LANGUAGE;
  const role = $("newProfileRoleSelect").value;

  if (!name) {
    $("newProfileStatus").textContent = t("loginFill");
    return;
  }

  if (role === "teacher" && !canCreateTeacherProfiles()) {
    $("newProfileStatus").textContent = t("teacherCreationRestricted");
    return;
  }

  if (state.profiles.some(item => normalizeName(item.name) === normalizeName(name))) {
    $("newProfileStatus").textContent = t("profileExists");
    return;
  }

  const id = makeProfileId(name);
  const ownerAuthUserId = getCurrentAuthUserId()
    || state.currentProfile?.ownerAuthUserId
    || state.currentProfile?.authUserId
    || null;
  const teacherGroupId = state.currentProfile?.teacherGroupId || state.currentProfile?.id || id;
  const inviteToken = makeInviteToken();
  const profile = {
    id,
    name,
    pin,
    role,
    teacherGroupId,
    nativeLanguage,
    ownerAuthUserId,
    inviteToken
  };

  try {
    await insertProfile(profile);
    await loadProfiles();
    $("newProfileNameInput").value = "";
    $("newProfilePinInput").value = "";
    $("newProfileRoleSelect").value = "student";
    const inviteUrl = getInviteUrl(inviteToken);
    state.lastInviteUrl = inviteUrl;
    $("shareInviteLinkBtn")?.classList.remove("hidden");
    $("newProfileStatus").textContent = formatText("inviteCreated", { url: inviteUrl });
    renderProfileManagerControls();
    logAppEvent("profile_created", {
      profileId: profile.id,
      role: profile.role,
      nativeLanguage: profile.nativeLanguage,
      source: "profile_manager"
    });
  } catch (error) {
    $("newProfileStatus").textContent = error.message;
  }
}

function logout() {
  stopReading();
  state.currentProfile = null;
  state.profileData = emptyProfileData();
  state.currentArticle = null;
  localStorage.removeItem(CURRENT_PROFILE_KEY);
  $("loginNameInput").value = "";
  $("loginPinInput").value = "";
  showLogin();
}

function renderNativeLanguageSelect(selectId, value = DEFAULT_NATIVE_LANGUAGE) {
  const select = $(selectId);
  if (!select) return;

  select.innerHTML = Object.entries(NATIVE_LANGUAGES)
    .map(([code, language]) => `<option value="${code}">${escapeHtml(language.label)}</option>`)
    .join("");
  select.value = isSupportedNativeLanguage(value) ? value : DEFAULT_NATIVE_LANGUAGE;
}

function renderNativeLanguageControls() {
  const profileLanguage = getNativeLanguage();
  const loginLanguage = state.currentProfile
    ? profileLanguage
    : isSupportedNativeLanguage(state.preLoginLanguage) ? state.preLoginLanguage : DEFAULT_NATIVE_LANGUAGE;
  renderNativeLanguageSelect("teacherNativeLanguageSelect", DEFAULT_NATIVE_LANGUAGE);
  renderNativeLanguageSelect("setupNativeLanguageSelect", DEFAULT_NATIVE_LANGUAGE);
  renderNativeLanguageSelect("newProfileNativeLanguageSelect", DEFAULT_NATIVE_LANGUAGE);
  renderNativeLanguageSelect("loginNativeLanguageSelect", loginLanguage);
  renderNativeLanguageSelect("settingsNativeLanguageSelect", profileLanguage);
}

function renderRoleControls() {
  if ($("settingsRoleSelect") && state.currentProfile) {
    $("settingsRoleSelect").value = state.currentProfile.role;
  }
}

function renderCurrentProfileLabel() {
  const profile = state.currentProfile;
  if (!profile) return;

  $("currentProfileLabel").textContent = `${profile.name} • ${profile.role === "teacher" ? t("teacher") : t("student")}${state.remoteReady ? ` • ${t("online")}` : ` • ${t("local")}`}`;
}

async function updateCurrentProfileNativeLanguage(language) {
  if (!state.currentProfile || !isSupportedNativeLanguage(language)) return;

  state.currentProfile.nativeLanguage = language;
  state.profiles = state.profiles.map(profile =>
    profile.id === state.currentProfile.id ? { ...profile, nativeLanguage: language } : profile
  );
  await saveProfiles();
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
