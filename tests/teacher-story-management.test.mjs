import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [html, app, articles, home, migration] = await Promise.all([
  read("index.html"),
  read("app.js"),
  read("articles.js"),
  read("home.js"),
  read("supabase/migrations/20261024200000_allow_authors_to_group_own_articles.sql"),
]);

test("licensed teachers get story management in the article editor", () => {
  assert.match(html, /id="teacherStoryManagement"/);
  assert.match(app, /onEvent\("teacherStoryManagement", "click", handleTeacherStoryManagementClick\)/);
  assert.match(home, /const canManageStories = !isPublisherAccount\(\)[\s\S]*hasTeacherLicense\(\)[\s\S]*isProfileOwnedByCurrentAuth\(\)/);
  assert.match(home, /data-teacher-create-series/);
  assert.match(home, /data-teacher-chapter-move/);
  assert.match(home, /data-teacher-remove-from-series/);
  assert.match(home, /data-teacher-dissolve-series/);
});

test("teachers can group only editable articles without changing global order", () => {
  assert.match(articles, /selected\.some\(article => !canEditArticle\(article\)\)/);
  assert.match(articles, /\.\.\.\(isPublisherAccount\(\) \? \{ displayOrder \} : \{\}\)/);
  assert.match(articles, /if \(!isPublisherAccount\(\) && has\("displayOrder"\)\) throw new Error/);
  assert.match(migration, /Only the article owner can organize it into a story/);
  assert.match(migration, /Only the publisher can change article order/);
});

test("publisher keeps the existing full article organization screen", () => {
  assert.match(home, /function buildArticleOrganizationSection\(\)/);
  assert.match(home, /if \(!button \|\| !isPublisherAccount\(\)\) return/);
  assert.match(home, /buildArticleOrganizationSection\(\)/);
});
