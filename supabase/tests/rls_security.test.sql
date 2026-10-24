-- =====================================================================
-- Suíte de segurança (RLS) — executa DENTRO de uma transação que é desfeita no final (sem resíduos).
-- Como rodar: cole no SQL Editor do Supabase (ou use a ferramenta execute_sql). O resultado volta como
-- mensagem de erro "RESULTADO_DOS_TESTES ..." (o erro é proposital: força o ROLLBACK de todos os dados de teste).
--
-- Cada identidade é simulada como o PostgREST faz com um JWT: papel "authenticated" + claim "sub".
-- Atores: ma=Mestre A, mb=Mestre B, ja=Jogador A, jb=Jogador B, oc=usuário sem vínculo. 'postgres' só confere o ESTADO.
-- Esperas: deny=precisa falhar · zero=0 linhas afetadas · n=K · val:X=valor escalar · cap:k=captura · ok=sem erro
-- LIMITE: não passa por HTTP/GoTrue; valida banco, políticas, privilégios e gatilhos.
-- =====================================================================
do $test$
declare
  ctx jsonb; r text[] := '{}'; s record; q text; k text; v text; n bigint; ok boolean; detail text;
  pass int := 0; fail int := 0;
begin
  ctx := jsonb_build_object('ma', gen_random_uuid(), 'mb', gen_random_uuid(), 'ja', gen_random_uuid(), 'jb', gen_random_uuid(), 'oc', gen_random_uuid());
  insert into auth.users (id, aud, role, email, raw_user_meta_data) values
    ((ctx->>'ma')::uuid, 'authenticated', 'authenticated', 'ma_test@example.invalid', '{"display_name":"Mestre A"}'),
    ((ctx->>'mb')::uuid, 'authenticated', 'authenticated', 'mb_test@example.invalid', '{"display_name":"Mestre B"}'),
    ((ctx->>'ja')::uuid, 'authenticated', 'authenticated', 'ja_test@example.invalid', '{"display_name":"Jogador A","role":"mestre"}'),
    ((ctx->>'jb')::uuid, 'authenticated', 'authenticated', 'jb_test@example.invalid', '{"display_name":"Jogador B"}'),
    ((ctx->>'oc')::uuid, 'authenticated', 'authenticated', 'oc_test@example.invalid', '{}');
  perform private.admin_set_role((ctx->>'ma')::uuid, 'mestre');
  perform private.admin_set_role((ctx->>'mb')::uuid, 'mestre');

  for s in select * from (values
    (1,'postgres','gatilho cria 5 perfis',$q$select count(*) from public.profiles where id in ('{ma}','{mb}','{ja}','{jb}','{oc}')$q$,'val:5'),
    (2,'postgres','metadata role=mestre IGNORADO',$q$select role from public.profiles where id='{ja}'$q$,'val:jogador'),
    (3,'postgres','nome sem metadata vem do e-mail',$q$select display_name from public.profiles where id='{oc}'$q$,'val:oc_test'),
    (4,'anon','anon nao le perfis',$q$select * from public.profiles$q$,'deny'),
    (5,'anon','anon nao le campanhas',$q$select * from public.campaigns$q$,'deny'),
    (6,'anon','anon nao le fichas',$q$select * from public.characters$q$,'deny'),
    (7,'anon','anon nao resgata convite',$q$select public.redeem_campaign_invite('x')$q$,'deny'),
    (8,'ja','jogador ve so o proprio perfil',$q$select count(*) from public.profiles$q$,'val:1'),
    (9,'ja','jogador NAO vira mestre',$q$update public.profiles set role='mestre' where id='{ja}'$q$,'deny'),
    (10,'postgres','papel continua jogador',$q$select role from public.profiles where id='{ja}'$q$,'val:jogador'),
    (11,'ja','jogador edita proprio nome',$q$update public.profiles set display_name='Jogador Alfa' where id='{ja}'$q$,'n=1'),
    (12,'ja','jogador nao edita nome alheio',$q$update public.profiles set display_name='X' where id='{ma}'$q$,'zero'),
    (13,'ja','jogador nao insere perfil',$q$insert into public.profiles(id,display_name) values (gen_random_uuid(),'Fantasma')$q$,'deny'),
    (14,'ja','jogador nao cria campanha',$q$insert into public.campaigns(name) values ('Invasora')$q$,'deny'),
    (15,'ma','mestre A cria campanha A',$q$insert into public.campaigns(name,description) values ('Campanha A','privada') returning id$q$,'cap:cidA'),
    (16,'ma','nao cria campanha em nome de outro',$q$insert into public.campaigns(name,owner_id) values ('Falsa','{mb}')$q$,'deny'),
    (17,'mb','mestre B cria campanha B',$q$insert into public.campaigns(name) values ('Campanha B') returning id$q$,'cap:cidB'),
    (18,'postgres','dono da campanha A e o mestre A',$q$select (owner_id::text='{ma}')::text from public.campaigns where id='{cidA}'$q$,'val:true'),
    (19,'ja','sem vinculo nao ve campanha',$q$select count(*) from public.campaigns$q$,'val:0'),
    (20,'ja','nao se auto-associa a campanha',$q$insert into public.campaign_members(campaign_id,user_id) values ('{cidA}','{ja}')$q$,'deny'),
    (21,'ja','jogador nao cria convite',$q$select public.create_campaign_invite('{cidA}')$q$,'deny'),
    (22,'mb','mestre B nao cria convite p/ campanha A',$q$select public.create_campaign_invite('{cidA}')$q$,'deny'),
    (23,'ja','token inventado recusado',$q$select public.redeem_campaign_invite('chute')$q$,'deny'),
    (24,'ma','mestre A cria convite 1',$q$select public.create_campaign_invite('{cidA}')$q$,'cap:tok1'),
    (25,'ma','mestre A cria convite 2',$q$select public.create_campaign_invite('{cidA}')$q$,'cap:tok2'),
    (26,'ma','mestre A cria convite co_mestre',$q$select public.create_campaign_invite('{cidA}','co_mestre',24)$q$,'cap:tok3'),
    (27,'ma','mestre le os 3 convites',$q$select count(*) from public.campaign_invites$q$,'val:3'),
    (28,'ma','hash do convite nao e legivel',$q$select token_hash from public.campaign_invites$q$,'deny'),
    (29,'ja','jogador nao ve convites',$q$select count(*) from public.campaign_invites$q$,'val:0'),
    (30,'postgres','token em texto puro nao e guardado',$q$select count(*) from public.campaign_invites where token_hash='{tok1}'$q$,'val:0'),
    (31,'oc','nao-mestre nao resgata convite co_mestre',$q$select public.redeem_campaign_invite('{tok3}')$q$,'deny'),
    (32,'postgres','convite co_mestre nao foi consumido',$q$select (used_at is null)::text from public.campaign_invites where member_role='co_mestre'$q$,'val:true'),
    (33,'postgres','insere convite ja expirado',$q$insert into public.campaign_invites(campaign_id,token_hash,created_by,expires_at) values ('{cidA}',encode(sha256(convert_to('expirado','utf8')),'hex'),'{ma}',now()-interval '1 hour')$q$,'n=1'),
    (34,'oc','convite expirado recusado',$q$select public.redeem_campaign_invite('expirado')$q$,'deny'),
    (35,'ja','jogador A resgata convite 1',$q$select public.redeem_campaign_invite('{tok1}')$q$,'ok'),
    (36,'ja','reuso do convite recusado',$q$select public.redeem_campaign_invite('{tok1}')$q$,'deny'),
    (37,'jb','convite ja usado por outro recusado',$q$select public.redeem_campaign_invite('{tok1}')$q$,'deny'),
    (38,'jb','jogador B resgata convite 2',$q$select public.redeem_campaign_invite('{tok2}')$q$,'ok'),
    (39,'postgres','campanha A tem 2 membros',$q$select count(*) from public.campaign_members where campaign_id='{cidA}'$q$,'val:2'),
    (40,'ja','jogador A ve a campanha',$q$select count(*) from public.campaigns$q$,'val:1'),
    (41,'jb','jogador B ve a campanha',$q$select count(*) from public.campaigns$q$,'val:1'),
    (42,'oc','estranho nao ve campanha',$q$select count(*) from public.campaigns$q$,'val:0'),
    (43,'ja','A ve os membros',$q$select count(*) from public.campaign_members$q$,'val:2'),
    (44,'oc','estranho nao ve membros',$q$select count(*) from public.campaign_members$q$,'val:0'),
    (45,'ja','A nao ve perfil de estranhos',$q$select count(*) from public.profiles where id in ('{mb}','{oc}')$q$,'val:0'),
    (46,'ja','A ve perfil do mestre e de B',$q$select count(*) from public.profiles where id in ('{ma}','{jb}')$q$,'val:2'),
    (47,'ja','jogador nao remove colega',$q$delete from public.campaign_members where user_id='{jb}'$q$,'zero'),
    (48,'ja','jogador nao edita campanha',$q$update public.campaigns set name='Hackeada' where id='{cidA}'$q$,'zero'),
    (49,'ja','jogador nao apaga campanha',$q$delete from public.campaigns where id='{cidA}'$q$,'zero'),
    (50,'postgres','campanha A intacta',$q$select name from public.campaigns where id='{cidA}'$q$,'val:Campanha A'),
    (51,'ja','A cria sua ficha',$q$insert into public.characters(campaign_id,name,sheet) values ('{cidA}','Ilvane','{"vigor":8}') returning id$q$,'cap:chA'),
    (52,'postgres','owner da ficha vem do token',$q$select (owner_id::text='{ja}')::text from public.characters where id='{chA}'$q$,'val:true'),
    (53,'ja','A nao cria ficha com progressao 5',$q$insert into public.characters(campaign_id,name,stage) values ('{cidA}','Cheat',5)$q$,'deny'),
    (54,'ja','A nao cria ficha em nome de B',$q$insert into public.characters(campaign_id,name,owner_id) values ('{cidA}','Roubo','{jb}')$q$,'deny'),
    (55,'ja','A nao cria ficha na campanha B',$q$insert into public.characters(campaign_id,name) values ('{cidB}','Intrusa')$q$,'deny'),
    (56,'jb','B cria sua ficha',$q$insert into public.characters(campaign_id,name) values ('{cidA}','Corvina') returning id$q$,'cap:chB'),
    (57,'ja','A ve so a propria ficha',$q$select count(*) from public.characters$q$,'val:1'),
    (58,'jb','B ve so a propria ficha',$q$select count(*) from public.characters$q$,'val:1'),
    (59,'oc','estranho nao ve fichas',$q$select count(*) from public.characters$q$,'val:0'),
    (60,'mb','mestre B nao ve fichas da campanha A',$q$select count(*) from public.characters$q$,'val:0'),
    (61,'ma','mestre A ve as 2 fichas',$q$select count(*) from public.characters$q$,'val:2'),
    (62,'ja','A atualiza a propria ficha',$q$update public.characters set sheet='{"vigor":9}' where id='{chA}'$q$,'n=1'),
    (63,'postgres','alteracao persistiu',$q$select sheet->>'vigor' from public.characters where id='{chA}'$q$,'val:9'),
    (64,'ja','A nao altera ficha de B (trocando o id)',$q$update public.characters set name='Pwn' where id='{chB}'$q$,'zero'),
    (65,'jb','B nao altera ficha de A (trocando o id)',$q$update public.characters set name='Pwn' where id='{chA}'$q$,'zero'),
    (66,'ja','A nao transfere ficha (owner_id)',$q$update public.characters set owner_id='{jb}' where id='{chA}'$q$,'deny'),
    (67,'ja','A nao move ficha p/ campanha B',$q$update public.characters set campaign_id='{cidB}' where id='{chA}'$q$,'deny'),
    (68,'ja','A nao aumenta a propria progressao',$q$update public.characters set stage=9 where id='{chA}'$q$,'deny'),
    (69,'ja','A nao apaga ficha de B',$q$delete from public.characters where id='{chB}'$q$,'zero'),
    (70,'postgres','ficha de B intacta',$q$select name from public.characters where id='{chB}'$q$,'val:Corvina'),
    (71,'postgres','ficha de A sem tomada de posse',$q$select (owner_id::text='{ja}' and campaign_id::text='{cidA}' and stage=1)::text from public.characters where id='{chA}'$q$,'val:true'),
    (72,'ma','mestre A atualiza ficha de jogador',$q$update public.characters set sheet='{"nota":"gm"}' where id='{chB}'$q$,'n=1'),
    (73,'ma','mestre A altera progressao',$q$update public.characters set stage=3 where id='{chB}'$q$,'n=1'),
    (74,'ma','mestre A nao muda o dono da ficha',$q$update public.characters set owner_id='{ma}' where id='{chB}'$q$,'deny'),
    (75,'mb','mestre B nao edita fichas de A',$q$update public.characters set name='X' where id='{chA}'$q$,'zero'),
    (76,'mb','mestre B nao edita campanha A',$q$update public.campaigns set name='X' where id='{cidA}'$q$,'zero'),
    (77,'mb','mestre B nao ve membros de A',$q$select count(*) from public.campaign_members$q$,'val:0'),
    (78,'mb','mestre B cria ficha na propria campanha',$q$insert into public.characters(campaign_id,name) values ('{cidB}','Chefe B')$q$,'n=1'),
    (79,'ma','mestre A nao ve campanha B',$q$select count(*) from public.campaigns where id='{cidB}'$q$,'val:0'),
    (80,'ma','mestre A nao ve fichas de B',$q$select count(*) from public.characters where campaign_id='{cidB}'$q$,'val:0'),
    (81,'ja','jogador A nao ve fichas de B',$q$select count(*) from public.characters where campaign_id='{cidB}'$q$,'val:0'),
    (82,'jb','jogador B nao ve campanha B',$q$select count(*) from public.campaigns where id='{cidB}'$q$,'val:0'),
    (83,'ma','mestre A nao cria convite p/ campanha B',$q$select public.create_campaign_invite('{cidB}')$q$,'deny'),
    (84,'postgres','campanha B intacta',$q$select count(*) from public.characters where campaign_id='{cidB}'$q$,'val:1'),
    (85,'ma','dono remove jogador B',$q$delete from public.campaign_members where user_id='{jb}'$q$,'n=1'),
    (86,'jb','B removido nao ve a campanha',$q$select count(*) from public.campaigns$q$,'val:0'),
    (87,'jb','B removido nao ve a propria ficha',$q$select count(*) from public.characters$q$,'val:0'),
    (88,'jb','B removido nao edita a ficha',$q$update public.characters set name='X' where id='{chB}'$q$,'zero'),
    (89,'postgres','ficha de B preservada',$q$select count(*) from public.characters where id='{chB}'$q$,'val:1'),
    (90,'mb','mestre B resgata convite co_mestre',$q$select public.redeem_campaign_invite('{tok3}')$q$,'ok'),
    (91,'mb','co_mestre edita a campanha A',$q$update public.campaigns set description='co-mestre' where id='{cidA}'$q$,'n=1'),
    (92,'mb','co_mestre ve fichas de A',$q$select count(*) from public.characters where campaign_id='{cidA}'$q$,'val:2'),
    (93,'mb','co_mestre nao concede co_mestre',$q$select public.create_campaign_invite('{cidA}','co_mestre',24)$q$,'deny'),
    (94,'mb','co_mestre nao apaga a campanha',$q$delete from public.campaigns where id='{cidA}'$q$,'zero'),
    (95,'ma','dono remove o co_mestre',$q$delete from public.campaign_members where user_id='{mb}'$q$,'n=1'),
    (96,'mb','ex-co_mestre perde acesso a A',$q$select count(*) from public.campaigns where id='{cidA}'$q$,'val:0'),
    (97,'postgres','admin rebaixa Mestre B',$q$select private.admin_set_role('{mb}','jogador')$q$,'ok'),
    (98,'mb','rebaixado nao cria campanha',$q$insert into public.campaigns(name) values ('Pos-rebaixamento')$q$,'deny'),
    (99,'mb','rebaixado perde admin da propria campanha',$q$update public.campaigns set name='X' where id='{cidB}'$q$,'zero')
  ) as t(n, actor, name, sql, expect) order by n loop
    reset role;
    if s.actor = 'anon' then
      perform set_config('request.jwt.claims', '', true); perform set_config('request.jwt.claim.sub', '', true); set local role anon;
    elsif s.actor <> 'postgres' then
      perform set_config('request.jwt.claims', json_build_object('sub', ctx->>s.actor, 'role', 'authenticated')::text, true);
      perform set_config('request.jwt.claim.sub', ctx->>s.actor, true);
      set local role authenticated;
    end if;
    q := s.sql;
    for k in select jsonb_object_keys(ctx) loop q := replace(q, '{' || k || '}', ctx->>k); end loop;
    ok := null; detail := '';
    begin
      if q ~ '\{[a-z0-9]+\}' then raise exception 'placeholder nao resolvido: %', substring(q from '\{[a-z0-9]+\}') using errcode = 'XX999'; end if;
      if s.expect like 'cap:%' or s.expect like 'val:%' then execute q into v; else execute q; get diagnostics n = row_count; end if;
      if s.expect = 'deny' then ok := false; detail := 'FOI PERMITIDO';
      elsif s.expect = 'zero' then ok := (n = 0); detail := 'linhas afetadas=' || n;
      elsif s.expect like 'n=%' then ok := (n = substr(s.expect, 3)::bigint); detail := 'linhas=' || n;
      elsif s.expect = 'ok' then ok := true;
      elsif s.expect like 'val:%' then ok := (v is not distinct from substr(s.expect, 5)); detail := 'obtido=' || coalesce(v, 'NULL');
      elsif s.expect like 'cap:%' then ok := (v is not null); ctx := ctx || jsonb_build_object(substr(s.expect, 5), v); detail := 'capturado';
      end if;
    exception when others then
      -- "negado" só vale com código de AUTORIZAÇÃO/regra de negócio; erro de sintaxe/placeholder NÃO conta como negação.
      if s.expect = 'deny' and sqlstate in ('42501', '22023', '28000', '23505') then ok := true; detail := 'negado ' || sqlstate;
      else ok := false; detail := 'ERRO INESPERADO ' || sqlstate || ': ' || sqlerrm; end if;
    end;
    if ok then pass := pass + 1; else fail := fail + 1; end if;
    r := r || (case when ok then 'PASS ' else 'FAIL ' end || lpad(s.n::text, 2, '0') || ' ' || s.name || ' | ' || detail);
  end loop;
  reset role;
  raise exception E'RESULTADO_DOS_TESTES passam=% falham=%\n%', pass, fail, array_to_string(r, E'\n');
end
$test$;
