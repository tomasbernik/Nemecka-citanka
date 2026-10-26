import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../supabase/migrations/20261026200000_delayed_story_deletion.sql", import.meta.url),
  "utf8"
);
const articlesSource = await readFile(new URL("../articles.js", import.meta.url), "utf8");
const homeSource = await readFile(new URL("../home.js", import.meta.url), "utf8");
const teamsSource = await readFile(new URL("../teams.js", import.meta.url), "utf8");

test("story deletion uses a 24-hour recovery window and purges expired stories", () => {
  assert.match(migration, /purge_after = deletion_time \+ interval '24 hours'/);
  assert.match(migration, /app_restore_story/);
  assert.match(migration, /app_purge_expired_stories/);
  assert.match(migration, /'\* \* \* \* \*'/);
});

test("story deletion is authorized for the publisher or every chapter owner", () => {
  assert.match(migration, /public\.app_is_publisher\(\)/);
  assert.match(migration, /public\.app_is_article_owner\(article\.owner_profile_id\)/);
  assert.match(migration, /story_delete_forbidden/);
  assert.match(migration, /app_schedule_story_deletion[\s\S]*security definer/);
});

test("deleted stories disappear from ordinary article state and remain restorable by admin", () => {
  assert.match(articlesSource, /scheduleArticleSeriesDeletion/);
  assert.match(articlesSource, /state\.articles = state\.articles\.filter/);
  assert.match(articlesSource, /deleted_at=is\.null/);
  assert.match(articlesSource, /app_deleted_story_articles/);
  assert.match(homeSource, /data-restore-series/);
});

test("visible dates are rendered in the German time zone", () => {
  assert.match(homeSource, /timeZone: APP_TIME_ZONE/);
  assert.match(teamsSource, /timeZone: APP_TIME_ZONE/);
});
