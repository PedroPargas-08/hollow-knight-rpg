
-- Protege os campos mecânicos das fichas.
-- Jogadores editam narrativa e recursos atuais.
-- Administradores autorizados podem administrar a ficha inteira.

create or replace function private.characters_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  is_admin boolean;
  default_attributes jsonb := '{"Vigor":10,"Agilidade":10,"Intelecto":10,"Percepção":10,"Presença":10,"Vontade":10}'::jsonb;
  pv_now numeric;
  pv_max numeric;
  alma_now numeric;
  alma_max numeric;
begin
  is_admin := private.is_campaign_admin(new.campaign_id);

  if tg_op = 'INSERT' then
    if new.stage <> 1 and not is_admin then
      raise exception
        'progressão inicial só pode ser alterada por quem administra a campanha'
        using errcode = '42501';
    end if;

    -- A criação por jogador começa com os valores padrão.
    if not is_admin then
      if new.sheet -> 'attributes' is distinct from default_attributes
         or new.sheet -> 'defense' is distinct from '10'::jsonb
         or new.sheet #> '{pv,now}' is distinct from '10'::jsonb
         or new.sheet #> '{pv,max}' is distinct from '10'::jsonb
         or new.sheet #> '{alma,now}' is distinct from '5'::jsonb
         or new.sheet #> '{alma,max}' is distinct from '5'::jsonb
         or new.sheet -> 'abilities' is distinct from '[]'::jsonb
         or new.sheet -> 'equipment' is distinct from '[]'::jsonb then
        raise exception
          'a ficha deve começar com os valores padrão; campos mecânicos exigem autorização do mestre'
          using errcode = '42501';
      end if;
    end if;

  else
    -- Campos estruturais imutáveis.
    if new.id is distinct from old.id
       or new.owner_id is distinct from old.owner_id
       or new.campaign_id is distinct from old.campaign_id
       or new.created_at is distinct from old.created_at then
      raise exception
        'id, dono e campanha da ficha são imutáveis'
        using errcode = '42501';
    end if;

    -- Progressão somente por administração autorizada.
    if new.stage is distinct from old.stage and not is_admin then
      raise exception
        'progressão só pode ser alterada por quem administra a campanha'
        using errcode = '42501';
    end if;

    if not is_admin then
      -- Não permitir alterações nem remoção de campos mecânicos.
      if new.sheet -> 'attributes' is distinct from old.sheet -> 'attributes'
         or new.sheet -> 'defense' is distinct from old.sheet -> 'defense'
         or new.sheet #> '{pv,max}' is distinct from old.sheet #> '{pv,max}'
         or new.sheet #> '{alma,max}' is distinct from old.sheet #> '{alma,max}'
         or new.sheet -> 'abilities' is distinct from old.sheet -> 'abilities'
         or new.sheet -> 'equipment' is distinct from old.sheet -> 'equipment' then
        raise exception
          'atributos, defesa, máximos, habilidades e equipamentos exigem autorização do mestre'
          using errcode = '42501';
      end if;
    end if;
  end if;

  -- Validar os recursos atuais e seus máximos antes de converter para inteiros.
  if jsonb_typeof(new.sheet) is distinct from 'object'
     or jsonb_typeof(new.sheet #> '{pv,now}') is distinct from 'number'
     or jsonb_typeof(new.sheet #> '{pv,max}') is distinct from 'number'
     or jsonb_typeof(new.sheet #> '{alma,now}') is distinct from 'number'
     or jsonb_typeof(new.sheet #> '{alma,max}') is distinct from 'number' then
    raise exception
      'a ficha deve conter valores numéricos válidos para PV e ALMA'
      using errcode = '42501';
  end if;

  if (new.sheet #>> '{pv,now}') !~ '^[0-9]+$'
     or (new.sheet #>> '{pv,max}') !~ '^[0-9]+$'
     or (new.sheet #>> '{alma,now}') !~ '^[0-9]+$'
     or (new.sheet #>> '{alma,max}') !~ '^[0-9]+$' then
    raise exception
      'PV e ALMA devem ser números inteiros não negativos'
      using errcode = '42501';
  end if;

  pv_now := (new.sheet #>> '{pv,now}')::numeric;
  pv_max := (new.sheet #>> '{pv,max}')::numeric;
  alma_now := (new.sheet #>> '{alma,now}')::numeric;
  alma_max := (new.sheet #>> '{alma,max}')::numeric;

  if pv_now < 0 or pv_max < 0 or pv_max > 999
     or pv_now > pv_max
     or alma_now < 0 or alma_max < 0 or alma_max > 999
     or alma_now > alma_max then
    raise exception
      'PV e ALMA devem estar entre zero e seus respectivos máximos'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
