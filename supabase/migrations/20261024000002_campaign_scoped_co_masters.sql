-- Permite que o dono ou um co-mestre administre sua campanha,
-- independentemente do papel global do perfil.

CREATE OR REPLACE FUNCTION private.is_campaign_admin(cid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.campaigns c
      WHERE c.id = cid
        AND c.owner_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1
      FROM public.campaign_members m
      WHERE m.campaign_id = cid
        AND m.user_id = (SELECT auth.uid())
        AND m.member_role = 'co_mestre'
    );
$function$;

-- Um convite válido de co-mestre pode ser aceito por qualquer
-- usuário autenticado. A autorização para CRIAR esse convite
-- continua restrita ao dono, conforme a função existente.

CREATE OR REPLACE FUNCTION public.redeem_campaign_invite(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_inv public.campaign_invites;
  v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'autenticação necessária'
      USING errcode = '28000';
  END IF;

  SELECT *
    INTO v_inv
    FROM public.campaign_invites
   WHERE token_hash = encode(
     sha256(convert_to(btrim(coalesce(p_token, '')), 'utf8')),
     'hex'
   )
     AND used_at IS NULL
     AND expires_at > now()
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite inválido ou expirado'
      USING errcode = '22023';
  END IF;

  IF private.is_campaign_member(v_inv.campaign_id) THEN
    RAISE EXCEPTION 'Você já participa desta campanha'
      USING errcode = '23505';
  END IF;

  UPDATE public.campaign_invites
     SET used_at = now(),
         used_by = v_uid
   WHERE id = v_inv.id;

  INSERT INTO public.campaign_members (
    campaign_id,
    user_id,
    member_role
  )
  VALUES (
    v_inv.campaign_id,
    v_uid,
    v_inv.member_role
  );

  RETURN v_inv.campaign_id;
END;
$function$;
REVOKE EXECUTE
ON FUNCTION public.redeem_campaign_invite(text)
FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.redeem_campaign_invite(text)
TO authenticated;
