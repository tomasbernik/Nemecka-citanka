import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [games, reader, home, teams, migration] = await Promise.all([
  read("games.js"),
  read("reader.js"),
  read("home.js"),
  read("teams.js"),
  read("supabase/migrations/20261027120000_assignment_rounds_and_admin_deletion.sql")
]);

test("a repeated assignment needs completion for its new assignment key", () => {
  const context = vm.createContext({ state: { profileData: {} } });
  vm.runInContext(games, context);
  const isAssignmentCompleted = vm.runInContext("isAssignmentCompleted", context);

  const legacy = { articleId: "article-1", assignedAt: "2026-10-01T10:00:00Z" };
  const repeated = {
    articleId: "article-1",
    assignedAt: "2026-10-27T10:00:00Z",
    requiresNewCompletion: true
  };
  const oldProgress = { readIds: ["article-1"], completedAssignmentIds: [] };
  const repeatedDone = {
    ...oldProgress,
    completedAssignmentIds: ["article-1:2026-10-27T10:00:00Z"]
  };

  assert.equal(isAssignmentCompleted(legacy, oldProgress), true);
  assert.equal(isAssignmentCompleted(repeated, oldProgress), false);
  assert.equal(isAssignmentCompleted(repeated, repeatedDone), true);
});

test("marking a repeated assignment complete keeps the original read history", () => {
  const assignment = {
    articleId: "article-1",
    assignedAt: "2026-10-27T10:00:00Z",
    requiresNewCompletion: true
  };
  const state = {
    articles: [{ id: "article-1" }],
    currentArticle: { id: "article-1", title: "Article" },
    profileData: {
      readIds: ["article-1"],
      assignments: [assignment],
      completedAssignmentIds: []
    }
  };
  const noop = () => {};
  const context = vm.createContext({
    state,
    saveProfileData: noop,
    logAppEvent: noop,
    updateMarkReadButtons: noop,
    renderCategories: noop,
    renderLevelFilters: noop,
    renderArticles: noop,
    renderHomeAssignments: noop,
    renderGamification: noop,
    renderArticleChapterSwitch: noop,
    window: { addEventListener: noop },
    document: { addEventListener: noop },
    $: () => ({ textContent: "" }),
    t: key => key
  });
  vm.runInContext(games, context);
  vm.runInContext(reader, context);
  Object.assign(context, {
    renderCategories: noop,
    renderLevelFilters: noop,
    renderArticles: noop,
    renderHomeAssignments: noop,
    renderGamification: noop,
    renderArticleChapterSwitch: noop
  });
  const markCurrentArticleRead = vm.runInContext("markCurrentArticleRead", context);

  markCurrentArticleRead();

  assert.deepEqual(Array.from(state.profileData.readIds), ["article-1"]);
  assert.deepEqual(
    Array.from(state.profileData.completedAssignmentIds),
    ["article-1:2026-10-27T10:00:00Z"]
  );
});

test("student overview exposes safe assignment actions", () => {
  assert.match(home, /data-assignment-action="cancel"/);
  assert.match(home, /data-assignment-action="reassign"/);
  assert.match(home, /rpc\/app_reassign_article_assignment/);
  assert.match(home, /rpc\/app_set_article_assignment/);
  assert.match(reader, /completedAssignmentIds/);
});

test("publisher can delete classes and teacher accounts with dedicated RPCs", () => {
  assert.match(teams, /data-team-action="delete"/);
  assert.match(teams, /rpc\/app_admin_delete_team/);
  assert.match(home, /data-delete-teacher/);
  assert.match(home, /rpc\/app_admin_delete_teacher_account/);
  assert.match(migration, /if not public\.app_is_publisher\(\)/);
  assert.match(migration, /delete from public\.app_teams where id = target_team_id/);
  assert.match(migration, /delete from public\.app_profiles where id = target_profile_id and role = 'teacher'/);
});

test("class and teacher deletion preserve student accounts while cleaning assignments", () => {
  assert.match(migration, /jsonb_array_elements[\s\S]*data -> 'assignments'/);
  assert.doesNotMatch(migration, /delete from public\.app_profiles[\s\S]*role = 'student'/);
  assert.match(migration, /owner_profile_id becomes null/);
});
