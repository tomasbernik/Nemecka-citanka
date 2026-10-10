-- Remove the currently rejected legacy article at the publisher's request.

delete from public.app_articles
where id = 'milan-lernt-deutsch'
  and approval_status = 'rejected';
