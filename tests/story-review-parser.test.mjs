import test from "node:test";
import assert from "node:assert/strict";
import { parseStoryReviewText } from "../supabase/functions/generate-article-workflow/story-review.mjs";

test("parses a clean story review without issues", () => {
  assert.deepEqual(parseStoryReviewText(`BRIEF: PASS
CHECKED: 1,2,3`), {
    briefSatisfied: true,
    checkedChapters: [1, 2, 3],
    issues: [],
  });
});

test("parses evidence-based issue blocks", () => {
  const review = parseStoryReviewText(`BRIEF: FAIL
CHECKED: 1,2,3
ISSUE:
CHAPTER: 0
CATEGORY: brief
DESCRIPTION: The requested romance is absent.
EVIDENCE: Anna verbringt den Urlaub allein.
RELATED_EVIDENCE:
FIX: Develop the requested romantic relationship.
END_ISSUE`);
  assert.equal(review.briefSatisfied, false);
  assert.deepEqual(review.checkedChapters, [1, 2, 3]);
  assert.deepEqual(review.issues[0], {
    chapter: 0,
    category: "brief",
    description: "The requested romance is absent.",
    evidence: "Anna verbringt den Urlaub allein.",
    relatedEvidence: "",
    requiredFix: "Develop the requested romantic relationship.",
  });
});

test("rejects incomplete issue blocks", () => {
  assert.throws(() => parseStoryReviewText(`BRIEF: PASS
CHECKED: 1,2,3
ISSUE:
CHAPTER: 2
CATEGORY: logic
DESCRIPTION: Missing evidence.
END_ISSUE`), /incomplete or invalid ISSUE block/);
});
