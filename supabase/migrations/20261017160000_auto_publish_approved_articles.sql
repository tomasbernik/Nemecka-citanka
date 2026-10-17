
CREATE OR REPLACE FUNCTION public.app_guard_article_workflow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  publisher boolean := public.app_is_publisher();
  teacher_can_approve boolean;
  content_changed boolean := false;
  requested_approval_changed boolean := false;
  requested_publication_changed boolean := false;
BEGIN
  IF new.visibility <> 'public' THEN
    RAISE EXCEPTION 'All articles must be public';
  END IF;

  IF tg_op = 'INSERT' THEN
    IF NOT publisher THEN
      new.published := false;
      IF new.approval_status NOT IN ('draft', 'pending') THEN
        new.approval_status := 'pending';
      END IF;
    END IF;
    RETURN new;
  END IF;

  teacher_can_approve :=
    public.app_is_teacher_for_group(old.teacher_group_id);

  IF new.owner_profile_id IS DISTINCT FROM old.owner_profile_id
     OR new.teacher_group_id IS DISTINCT FROM old.teacher_group_id THEN
    IF NOT publisher THEN
      RAISE EXCEPTION 'Only the publisher can change article ownership';
    END IF;
  END IF;

  requested_approval_changed :=
    new.approval_status IS DISTINCT FROM old.approval_status;

  IF requested_approval_changed
     AND NOT publisher
     AND NOT teacher_can_approve THEN
    RAISE EXCEPTION 'Only the group teacher can approve this article';
  END IF;

  -- Approval automatically controls publication.
  IF requested_approval_changed THEN
    new.published := (new.approval_status = 'approved');
  END IF;

  requested_publication_changed :=
    new.published IS DISTINCT FROM old.published;

  IF requested_publication_changed
     AND NOT publisher
     AND NOT (requested_approval_changed AND teacher_can_approve) THEN
    RAISE EXCEPTION 'Only the publisher can change publication';
  END IF;

  content_changed :=
    new.title IS DISTINCT FROM old.title
    OR new.language IS DISTINCT FROM old.language
    OR new.variant_group_id IS DISTINCT FROM old.variant_group_id
    OR new.level IS DISTINCT FROM old.level
    OR new.category IS DISTINCT FROM old.category
    OR new.category_labels IS DISTINCT FROM old.category_labels
    OR new.summary IS DISTINCT FROM old.summary
    OR new.text IS DISTINCT FROM old.text
    OR new.vocabulary IS DISTINCT FROM old.vocabulary
    OR new.inline_vocabulary IS DISTINCT FROM old.inline_vocabulary
    OR new.image IS DISTINCT FROM old.image
    OR new.questions IS DISTINCT FROM old.questions;

  IF content_changed AND NOT publisher THEN
    new.approval_status := 'pending';
    new.published := false;
  END IF;

  IF new.approval_status <> 'approved' THEN
    new.published := false;
  END IF;

  IF new.published AND new.approval_status <> 'approved' THEN
    RAISE EXCEPTION 'Only approved articles can be published';
  END IF;

  RETURN new;
END;
$$;
