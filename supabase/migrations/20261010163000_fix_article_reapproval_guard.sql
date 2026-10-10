-- Allow owner edits to reset an approved article to pending without treating the automatic reset as moderation.

create or replace function public.app_guard_article_workflow()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  publisher boolean := public.app_is_publisher();
  content_changed boolean := false;
  requested_approval_changed boolean := false;
  requested_publication_changed boolean := false;
begin
  if new.visibility <> 'public' then
    raise exception 'All articles must be public';
  end if;

  if tg_op = 'INSERT' then
    if not publisher then
      new.published := false;
      if new.approval_status not in ('draft', 'pending') then
        new.approval_status := 'pending';
      end if;
    end if;
    return new;
  end if;

  if new.owner_profile_id is distinct from old.owner_profile_id
    or new.teacher_group_id is distinct from old.teacher_group_id then
    if not publisher then
      raise exception 'Only the publisher can change article ownership';
    end if;
  end if;

  requested_approval_changed := new.approval_status is distinct from old.approval_status;
  requested_publication_changed := new.published is distinct from old.published;

  if requested_approval_changed
    and not publisher
    and not public.app_is_teacher_for_group(old.teacher_group_id) then
    raise exception 'Only the group teacher can approve this article';
  end if;

  if requested_publication_changed and not publisher then
    raise exception 'Only the publisher can change publication';
  end if;

  content_changed :=
    new.title is distinct from old.title
    or new.language is distinct from old.language
    or new.variant_group_id is distinct from old.variant_group_id
    or new.level is distinct from old.level
    or new.category is distinct from old.category
    or new.category_labels is distinct from old.category_labels
    or new.summary is distinct from old.summary
    or new.text is distinct from old.text
    or new.vocabulary is distinct from old.vocabulary
    or new.inline_vocabulary is distinct from old.inline_vocabulary
    or new.image is distinct from old.image
    or new.questions is distinct from old.questions;

  if content_changed and not publisher then
    new.approval_status := 'pending';
    new.published := false;
  end if;

  if new.approval_status <> 'approved' then
    new.published := false;
  end if;

  if new.published and new.approval_status <> 'approved' then
    raise exception 'Only approved articles can be published';
  end if;

  return new;
end;
$$;
