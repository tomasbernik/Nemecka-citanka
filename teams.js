let inviteCountdownTimer = null;

function normalizeTeam(row) {
  return {
    id: row.id,
    name: row.name,
    ownerProfileId: row.owner_profile_id || row.ownerProfileId,
    legacyGroupId: row.legacy_group_id || row.legacyGroupId || null,
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt
  };
}

function normalizeTeamMembership(row) {
  return {
    teamId: row.team_id || row.teamId,
    profileId: row.profile_id || row.profileId,
    joinedAt: row.joined_at || row.joinedAt
  };
}

async function loadTeams() {
  state.teams = [];
  state.teamMemberships = [];
  if (!state.remoteReady || !state.authUser?.id) {
    renderTeamManagement();
    return;
  }

  try {
    const [teams, memberships] = await Promise.all([
      supabaseRequest("app_teams?select=id,name,owner_profile_id,legacy_group_id,created_at,updated_at&order=created_at.asc"),
      supabaseRequest("app_team_memberships?select=team_id,profile_id,joined_at&order=joined_at.asc")
    ]);
    state.teams = (teams || []).map(normalizeTeam);
    state.teamMemberships = (memberships || []).map(normalizeTeamMembership);
  } catch (error) {
    console.info("Teams unavailable until the migration is installed:", error.message);
  }
  renderTeamManagement();
}

function getManagedTeams() {
  if (isPublisherAccount()) return state.teams;
  return state.teams.filter(team => team.ownerProfileId === state.currentProfile?.id);
}

function getCurrentProfileTeams() {
  const ids = new Set(state.teamMemberships
    .filter(item => item.profileId === state.currentProfile?.id)
    .map(item => item.teamId));
  return state.teams.filter(team => ids.has(team.id));
}

function getTeamMembers(teamId) {
  const ids = new Set(state.teamMemberships
    .filter(item => item.teamId === teamId)
    .map(item => item.profileId));
  return state.profiles.filter(profile => ids.has(profile.id));
}

function getTeamTeacherName(team) {
  return state.profiles.find(profile => profile.id === team?.ownerProfileId)?.name || "";
}

function renderTeamManagement() {
  const joinSection = $("joinInviteSection");
  const section = $("teamManagementSection");
  const list = $("teamManagementList");
  if (!section || !list) return;
  const canJoin = state.currentProfile?.role === "student";
  joinSection?.classList.toggle("hidden", !canJoin);
  const canManage = hasTeacherLicense();
  section.classList.toggle("hidden", !canManage);
  if (!canManage) {
    list.innerHTML = "";
    return;
  }

  const teams = getManagedTeams();
  list.innerHTML = teams.length ? teams.map(team => {
    const teacherName = getTeamTeacherName(team) || t("unknownTeacher");
    const members = getTeamMembers(team.id).filter(member => member.id !== team.ownerProfileId);
    const memberRows = members.map(member => `
      <li>
        <span>${escapeHtml(member.name)}</span>
        <button class="text-btn" type="button" data-team-action="remove-member" data-team-id="${escapeHtml(team.id)}" data-profile-id="${escapeHtml(member.id)}">${escapeHtml(t("removeTeamMember"))}</button>
      </li>
    `).join("");
    return `
      <section class="team-card" data-team-id="${escapeHtml(team.id)}">
        <p><strong>${escapeHtml(formatText("classTeacherSummary", { name: team.name, teacher: teacherName }))}</strong></p>
        <div class="editor-actions">
          <input data-team-name value="${escapeHtml(team.name)}" maxlength="80">
          <button class="secondary-btn quiet" type="button" data-team-action="rename">${escapeHtml(t("renameTeam"))}</button>
          <button class="primary-btn" type="button" data-team-action="invite">${escapeHtml(t("createInviteCode"))}</button>
          <button class="text-btn" type="button" data-team-action="cancel-invite">${escapeHtml(t("cancelInviteCode"))}</button>
        </div>
        <p class="muted">${escapeHtml(formatText("teamMemberCount", { count: members.length }))}</p>
        <ul class="team-member-list">${memberRows || `<li class="muted">${escapeHtml(t("noTeamMembers"))}</li>`}</ul>
      </section>
    `;
  }).join("") : `<p class="muted">${escapeHtml(t("noTeams"))}</p>`;
}

async function createTeamFromSettings() {
  const input = $("newTeamNameInput");
  const status = $("teamManagementStatus");
  const name = String(input?.value || "").trim();
  if (!hasTeacherLicense()) return;
  if (!name) {
    status.textContent = t("teamNameRequired");
    return;
  }
  try {
    await supabaseRequest("rpc/app_create_team", {
      method: "POST",
      body: JSON.stringify({ target_name: name })
    });
    input.value = "";
    status.textContent = t("teamCreated");
    await loadProfiles();
    await loadTeams();
  } catch (error) {
    status.textContent = error.message;
  }
}

async function handleTeamManagementClick(event) {
  const button = event.target.closest("[data-team-action]");
  if (!button) return;
  if (!hasTeacherLicense()) return;
  const action = button.dataset.teamAction;
  const teamId = button.dataset.teamId || button.closest("[data-team-id]")?.dataset.teamId;
  const status = $("teamManagementStatus");
  try {
    if (action === "rename") {
      const name = button.closest("[data-team-id]")?.querySelector("[data-team-name]")?.value.trim();
      await supabaseRequest("rpc/app_rename_team", {
        method: "POST",
        body: JSON.stringify({ target_team_id: teamId, target_name: name })
      });
      status.textContent = t("teamRenamed");
    } else if (action === "remove-member") {
      await supabaseRequest("rpc/app_remove_team_member", {
        method: "POST",
        body: JSON.stringify({ target_team_id: teamId, target_profile_id: button.dataset.profileId })
      });
      status.textContent = t("teamMemberRemoved");
    } else if (action === "invite") {
      await createInviteCode(teamId);
      return;
    } else if (action === "cancel-invite") {
      await cancelInviteForTeam(teamId);
      status.textContent = t("inviteCancelled");
    }
    await loadProfiles();
    await loadTeams();
  } catch (error) {
    status.textContent = error.message;
  }
}

async function createInviteCode(teamId) {
  const rows = await supabaseRequest("rpc/app_create_team_invite", {
    method: "POST",
    body: JSON.stringify({ target_team_id: teamId })
  });
  const row = rows?.[0];
  if (!row) throw new Error(t("inviteCreateFailed"));
  state.activeTeamInvite = {
    code: row.invite_code,
    teamId: row.team_id,
    teamName: row.team_name,
    expiresAt: row.expires_at
  };
  showInviteCodeDialog();
}

function showInviteCodeDialog() {
  const invite = state.activeTeamInvite;
  if (!invite) return;
  $("inviteCodeDialog")?.classList.remove("hidden");
  $("inviteCodeTeamName").textContent = invite.teamName;
  $("inviteCodeValue").textContent = invite.code;
  $("inviteCodeValidity").textContent = t("inviteValidOneHour");
  $("inviteCodeExpiresAt").textContent = formatText("inviteExpiresAt", {
    time: new Date(invite.expiresAt).toLocaleString(getUiLanguage())
  });
  $("inviteCodeStatus").textContent = "";
  updateInviteCountdown();
  window.clearInterval(inviteCountdownTimer);
  inviteCountdownTimer = window.setInterval(updateInviteCountdown, 1000);
}

function updateInviteCountdown() {
  const invite = state.activeTeamInvite;
  const target = $("inviteCodeCountdown");
  if (!invite || !target) return;
  const remaining = new Date(invite.expiresAt).getTime() - Date.now();
  if (remaining <= 0) {
    target.textContent = t("inviteExpired");
    $("inviteCodeStatus").textContent = t("inviteExpired");
    window.clearInterval(inviteCountdownTimer);
    return;
  }
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  target.textContent = formatText("inviteRemaining", { time: `${minutes}:${String(seconds).padStart(2, "0")}` });
}

function closeInviteCodeDialog() {
  $("inviteCodeDialog")?.classList.add("hidden");
  window.clearInterval(inviteCountdownTimer);
}

async function copyActiveInviteCode() {
  if (!state.activeTeamInvite?.code) return;
  await navigator.clipboard.writeText(state.activeTeamInvite.code);
  $("inviteCodeStatus").textContent = t("inviteCodeCopied");
}

async function cancelInviteForTeam(teamId) {
  await supabaseRequest("rpc/app_cancel_team_invite", {
    method: "POST",
    body: JSON.stringify({ target_team_id: teamId })
  });
}

async function cancelActiveInviteCode() {
  if (!state.activeTeamInvite?.teamId) return;
  await cancelInviteForTeam(state.activeTeamInvite.teamId);
  $("inviteCodeStatus").textContent = t("inviteCancelled");
  window.clearInterval(inviteCountdownTimer);
}

async function replaceActiveInviteCode() {
  if (!state.activeTeamInvite?.teamId) return;
  await createInviteCode(state.activeTeamInvite.teamId);
}

async function joinTeamByCode(rawCode) {
  const status = $("joinInviteStatus");
  if (!state.authUser?.id) {
    status.textContent = t("authSignInFirst");
    return;
  }
  if (state.currentProfile?.role !== "student") {
    status.textContent = t("studentOnlyJoinClass");
    return;
  }
  try {
    const rows = await supabaseRequest("rpc/app_join_team", {
      method: "POST",
      body: JSON.stringify({ raw_code: rawCode })
    });
    const result = rows?.[0];
    if (!result || result.join_status === "invalid") {
      status.textContent = t("inviteInvalid");
      return;
    }
    $("joinInviteInput").value = "";
    status.textContent = formatText(
      result.join_status === "already_member" ? "alreadyTeamMember" : "teamJoined",
      { team: result.team_name, teacher: result.teacher_name }
    );
    await loadProfiles();
    await loadTeams();
  } catch (error) {
    status.textContent = error.message.includes("invite_attempt_limit")
      ? t("inviteAttemptLimit")
      : t("inviteInvalid");
  }
}

