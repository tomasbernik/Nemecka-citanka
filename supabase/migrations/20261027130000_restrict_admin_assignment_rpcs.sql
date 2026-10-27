-- Supabase default function privileges may grant EXECUTE to anon explicitly.
-- These RPCs are only intended for signed-in teachers or the publisher.

revoke all on function public.app_reassign_article_assignment(uuid, text, text) from public, anon;
revoke all on function public.app_admin_delete_team(uuid) from public, anon;
revoke all on function public.app_admin_delete_teacher_account(text) from public, anon;

grant execute on function public.app_reassign_article_assignment(uuid, text, text) to authenticated;
grant execute on function public.app_admin_delete_team(uuid) to authenticated;
grant execute on function public.app_admin_delete_teacher_account(text) to authenticated;
