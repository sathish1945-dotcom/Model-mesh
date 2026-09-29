-- Prevent direct Data API callers from invoking the privileged RLS event trigger helper.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
