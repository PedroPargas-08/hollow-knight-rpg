import { useState, useEffect } from 'react';
import { useAuth } from '../app/auth';
import { MASTER_SECTIONS, type MasterSection } from '../app/nav';
import { Alert, Badge, Button, EmptyState, Field, LinkButton, PageHead, Panel, VisTag } from '../components/ui';
import { Modal } from '../components/overlay';
import { Icon } from '../components/Icon';
import { listCampaigns, listCharacters, listMembers, STATUS_LABEL, listCombatEncounters, createCombatEncounter, updateCombatEncounter, deleteCombatEncounter, listCombatParticipants, addCombatParticipant, updateCombatParticipant, deleteCombatParticipant, listCombatActions, addCombatAction, listCharacters as apiListCharacters, type CombatEncounter, type CombatParticipant, type CombatAction, type Character } from '../lib/api';
import { useAsync } from '../lib/useAsync';

const Legend = () => (
  <div className="stack-sm">
    <div className="row"><VisTag v="publico" /><span className="dim small">Qualquer pessoa (ex.: regras públicas).</span></div>
    <div className="row"><VisTag v="jogadores" /><span className="dim small">Participantes da campanha.</span></div>
    <div className="row"><VisTag v="mestre" /><span className="dim small">Somente o mestre. O banco impede que jogadores leiam.</span></div>
  </div>
);

export function MasterPage({ section }: { section: MasterSection }) {
  const { profile } = useAuth();
  const camps = useAsync(listCampaigns, []);
  const chars = useAsync(listCharacters, []);
  const mine = (camps.data ?? []).filter((c) => c.owner_id === profile!.id);
  const [pick, setPick] = useState<string>('');
  const camp = mine.find((c) => c.id === pick) ?? mine[0];
  const members = useAsync(() => (camp ? listMembers(camp.id) : Promise.resolve([])), [camp?.id]);
  const campChars = (chars.data ?? []).filter((c) => c.campaign_id === camp?.id);
  const sec = MASTER_SECTIONS.find((s) => s.id === section)!;
  const real = section === 'visao' || section === 'jogadores' || section === 'encontros';
  const loading = (camps.loading && !camps.data) || (chars.loading && !chars.data);
  const err = camps.error ?? chars.error;

  // Combat Encounters state
  const [encounters, setEncounters] = useState<CombatEncounter[]>([]);
  const [loadingEncounters, setLoadingEncounters] = useState(false);
  const [showCreateEncounter, setShowCreateEncounter] = useState(false);
  const [newEncounterName, setNewEncounterName] = useState('');
  const [newEncounterDesc, setNewEncounterDesc] = useState('');
  const [selectedEncounter, setSelectedEncounter] = useState<CombatEncounter | null>(null);
  const [participants, setParticipants] = useState<CombatParticipant[]>([]);
  const [actions, setActions] = useState<CombatAction[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [newParticipant, setNewParticipant] = useState({ character_id: '', npc_name: '', initiative: 10, team: 'ally' as const, type: 'character' as 'character' | 'npc' });
  const [round, setRound] = useState(1);
  const [turnOrder, setTurnOrder] = useState(0);

  // Load encounters when camp changes
  useEffect(() => {
    if (camp?.id && section === 'encontros') {
      setLoadingEncounters(true);
      listCombatEncounters(camp.id).then(setEncounters).finally(() => setLoadingEncounters(false));
    } else {
      setEncounters([]);
    }
  }, [camp?.id, section]);

  // Load participants when encounter changes
  useEffect(() => {
    if (selectedEncounter) {
      setLoadingParticipants(true);
      listCombatParticipants(selectedEncounter.id).then(setParticipants).finally(() => setLoadingParticipants(false));
    } else {
      setParticipants([]);
    }
  }, [selectedEncounter]);

  // Load actions when participants change
  useEffect(() => {
    if (selectedEncounter) {
      listCombatActions(selectedEncounter.id).then(setActions);
    }
  }, [selectedEncounter, participants]);

  const handleCreateEncounter = async () => {
    if (!camp || !newEncounterName.trim()) return;
    try {
      const encounter = await createCombatEncounter({
        campaign_id: camp.id,
        name: newEncounterName.trim(),
        description: newEncounterDesc.trim()
      });
      setEncounters(prev => [encounter, ...prev]);
      setShowCreateEncounter(false);
      setNewEncounterName('');
      setNewEncounterDesc('');
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectEncounter = async (encounter: CombatEncounter) => {
    setSelectedEncounter(encounter);
    setRound(encounter.current_round || 1);
    setTurnOrder(encounter.current_turn_order || 0);
  };

  const handleStartEncounter = async () => {
    if (!selectedEncounter) return;
    try {
      await updateCombatEncounter(selectedEncounter.id, {
        status: 'active',
        started_at: new Date().toISOString(),
        current_round: 1,
        current_turn_order: 0
      });
      const updated = { ...selectedEncounter, status: 'active' as const, current_round: 1, current_turn_order: 0, started_at: new Date().toISOString() };
      setSelectedEncounter(updated);
      setEncounters(prev => prev.map(e => e.id === updated.id ? updated : e));
    } catch (e) {
      console.error(e);
    }
  };

  const handleEndEncounter = async () => {
    if (!selectedEncounter) return;
    try {
      await updateCombatEncounter(selectedEncounter.id, {
        status: 'ended',
        ended_at: new Date().toISOString()
      });
      const updated = { ...selectedEncounter, status: 'ended' as const, ended_at: new Date().toISOString() };
      setSelectedEncounter(updated);
      setEncounters(prev => prev.map(e => e.id === updated.id ? updated : e));
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddParticipant = async () => {
    if (!selectedEncounter) return;
    try {
      const participant = await addCombatParticipant({
        encounter_id: selectedEncounter.id,
        character_id: newParticipant.character_id || undefined,
        npc_name: newParticipant.npc_name || undefined,
        initiative: newParticipant.initiative,
        turn_order: participants.length,
        team: newParticipant.team,
        current_pv: newParticipant.character_id ? undefined : 10,
        current_alma: newParticipant.character_id ? undefined : 5
      });
      setParticipants(prev => [...prev, participant]);
      setShowAddParticipant(false);
      setNewParticipant({ character_id: '', npc_name: '', initiative: 10, team: 'ally', type: 'character' });
    } catch (e) {
      console.error(e);
    }
  };

  const handleRollInitiative = async () => {
    if (!selectedEncounter || participants.length === 0) return;
    try {
      // Roll initiative for each participant
      const rolled = participants.map(p => ({
        ...p,
        initiative: p.initiative + Math.floor(Math.random() * 20) + 1
      }));
      // Sort by initiative descending
      rolled.sort((a, b) => b.initiative - a.initiative);
      // Update turn_order
      const updated = rolled.map((p, i) => ({ ...p, turn_order: i }));
      for (const p of updated) {
        await updateCombatParticipant(p.id, { initiative: p.initiative, turn_order: p.turn_order });
      }
      setParticipants(updated);
      await updateCombatEncounter(selectedEncounter.id, { current_round: 1, current_turn_order: 0 });
      setRound(1);
      setTurnOrder(0);
    } catch (e) {
      console.error(e);
    }
  };

  const handleNextTurn = async () => {
    if (!selectedEncounter || participants.length === 0) return;
    const nextTurnOrder = (turnOrder + 1) % participants.length;
    const nextRound = nextTurnOrder === 0 ? round + 1 : round;
    try {
      await updateCombatEncounter(selectedEncounter.id, {
        current_round: nextRound,
        current_turn_order: nextTurnOrder
      });
      setRound(nextRound);
      setTurnOrder(nextTurnOrder);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddAction = async (action: Partial<CombatAction> & { description: string }) => {
    if (!selectedEncounter || participants.length === 0) return;
    const currentParticipant = participants[turnOrder];
    try {
      await addCombatAction({
        encounter_id: selectedEncounter.id,
        round_number: round,
        participant_id: currentParticipant.id,
        action_type: action.action_type || 'other',
        ability_id: action.ability_id ?? undefined,
        item_id: action.item_id ?? undefined,
        target_ids: action.target_ids || [],
        roll_result: action.roll_result ?? undefined,
        damage_dealt: action.damage_dealt ?? undefined,
        description: action.description
      });
      setActions(prev => [...prev, { ...action, id: '', encounter_id: selectedEncounter.id, round_number: round, participant_id: currentParticipant.id, created_at: new Date().toISOString() } as CombatAction]);
    } catch (e) {
      console.error(e);
    }
  };

  let body;
  if (!real) body = <Panel><EmptyState icon="hourglass" title="Planejado para uma fase futura">Esta ferramenta ainda não existe. Nenhum dado de exemplo é exibido para evitar confusão com registros reais.</EmptyState></Panel>;
  else if (loading) body = <Panel><EmptyState icon="hourglass" title="Carregando…"><span className="spinner" role="status" aria-label="Carregando" /></EmptyState></Panel>;
  else if (err) body = <Panel><EmptyState icon="alert" title="Não foi possível carregar" action={<Button onClick={() => { camps.reload(); chars.reload(); }}>Tentar de novo</Button>}>{err}</EmptyState></Panel>;
  else if (!mine.length) body = <Panel><EmptyState icon="flag" title="Você ainda não administra campanhas" action={<LinkButton to="/campanhas" variant="primary" icon="plus">Criar campanha</LinkButton>}>Crie uma campanha para convidar jogadores e acompanhar as fichas.</EmptyState></Panel>;
  else if (section === 'visao') body = (
    <div className="stack">
      <div className="grid cols-2">
        <Panel title="Campanhas que você administra" icon="flag" actions={<LinkButton to="/campanhas" size="sm">Gerenciar</LinkButton>}>
          <ul className="list">{mine.map((c) => <li className="list-row" key={c.id}><div className="grow"><strong>{c.name}</strong></div><Badge tone={c.status === 'andamento' ? 'ok' : undefined}>{STATUS_LABEL[c.status]}</Badge></li>)}</ul>
        </Panel>
        <Panel title="Quem vê o quê" icon="eye"><Legend /></Panel>
      </div>
      <Panel title={`Resumo — ${camp!.name}`} icon="crown">
        <div className="stats">
          <div className="stat"><Icon name="users" /><b>{members.data?.length ?? '…'}</b><span className="muted small">participantes</span></div>
          <div className="stat"><Icon name="sheet" /><b>{campChars.length}</b><span className="muted small">fichas</span></div>
        </div>
        <div className="row" style={{ marginTop: '.8rem' }}><LinkButton to="/mestre/jogadores" icon="users" size="sm">Ver jogadores e fichas</LinkButton><LinkButton to="/campanhas" icon="plus" size="sm">Gerar convite</LinkButton></div>
      </Panel>
    </div>);
  else if (section === 'encontros') body = (
    <div className="stack">
      {/* Encounter List */}
      <Panel title="Encontros" icon="crosshair" actions={<Button icon="plus" onClick={() => setShowCreateEncounter(true)}>Novo Encontro</Button>}>
        {loadingEncounters ? <span className="spinner" role="status" aria-label="Carregando" /> : encounters.length === 0 ? (
          <EmptyState icon="crosshair" title="Nenhum encontro criado">Crie seu primeiro encontro de combate.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Status</th>
                  <th>Rodada</th>
                  <th>Turno</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {encounters.map(e => (
                  <tr key={e.id} style={{ background: selectedEncounter?.id === e.id ? 'var(--accent-bg)' : undefined }}>
                    <td><strong>{e.name}</strong><br /><span className="muted small">{e.description}</span></td>
                    <td><Badge tone={e.status === 'active' ? 'ok' : e.status === 'preparing' ? 'accent' : e.status === 'paused' ? 'bad' : undefined}>{e.status}</Badge></td>
                    <td>{e.current_round}</td>
                    <td>{e.current_turn_order}</td>
                    <td>
                      <div className="row" style={{ gap: '0.5rem' }}>
                        <Button size="sm" variant={selectedEncounter?.id === e.id ? 'primary' : 'ghost'} onClick={() => handleSelectEncounter(e)}>
                          {selectedEncounter?.id === e.id ? 'Selecionado' : 'Selecionar'}
                        </Button>
                        <Button size="sm" variant="danger" onClick={async () => { await deleteCombatEncounter(e.id); setEncounters(prev => prev.filter(x => x.id !== e.id)); if (selectedEncounter?.id === e.id) setSelectedEncounter(null); }}>Excluir</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showCreateEncounter && (
          <Modal title="Novo Encontro" onClose={() => setShowCreateEncounter(false)}>
            <form className="stack" onSubmit={e => { e.preventDefault(); handleCreateEncounter(); }}>
              <Field label="Nome" htmlFor="enc-name"><input id="enc-name" className="input" value={newEncounterName} onChange={e => setNewEncounterName(e.target.value)} maxLength={80} required /></Field>
              <Field label="Descrição" htmlFor="enc-desc"><textarea id="enc-desc" className="input" value={newEncounterDesc} onChange={e => setNewEncounterDesc(e.target.value)} maxLength={1000} rows={3} /></Field>
              <div className="modal-actions"><Button type="button" variant="ghost" onClick={() => setShowCreateEncounter(false)}>Cancelar</Button><Button type="submit" variant="primary">Criar</Button></div>
            </form>
          </Modal>
        )}
      </Panel>

      {/* Selected Encounter Details */}
      {selectedEncounter && (
        <div className="stack">
          <Panel title={`${selectedEncounter.name} — Rodada ${round}, Turno ${turnOrder + 1}/${participants.length}`} icon="crosshair" actions={
            <div className="row" style={{ gap: '0.5rem' }}>
              {selectedEncounter.status === 'preparing' && <Button icon="play" onClick={handleStartEncounter}>Iniciar</Button>}
              {selectedEncounter.status === 'active' && <Button icon="forward" onClick={handleNextTurn}>Próximo Turno</Button>}
              {selectedEncounter.status === 'active' && <Button variant="danger" onClick={handleEndEncounter}>Encerrar</Button>}
              <Button size="sm" icon="user-plus" onClick={() => setShowAddParticipant(true)}>Adicionar Participante</Button>
            </div>
          }>
            {/* Initiative Roll */}
            {selectedEncounter.status === 'preparing' && participants.length > 0 && (
              <Button icon="dice" onClick={handleRollInitiative} style={{ marginBottom: '1rem' }}>Rolar Iniciativa</Button>
            )}

            {/* Participants */}
            <Panel title="Participantes" icon="users">
              {loadingParticipants ? <span className="spinner" role="status" aria-label="Carregando" /> : participants.length === 0 ? (
                <EmptyState icon="users" title="Nenhum participante">Adicione personagens ou NPCs ao encontro.</EmptyState>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Time</th>
                        <th>Iniciativa</th>
                        <th>Ordem</th>
                        <th>PV</th>
                        <th>ALMA</th>
                        <th>Status</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {participants.map((p, i) => {
                        const isCurrent = i === turnOrder && selectedEncounter.status === 'active';
                        return (
                          <tr key={p.id} style={{ background: isCurrent ? 'var(--accent-bg)' : undefined, fontWeight: isCurrent ? 'bold' : undefined }}>
                            <td>{p.character_id ? campChars.find(c => c.id === p.character_id)?.name || 'Personagem' : p.npc_name || 'NPC'}</td>
                            <td><Badge tone={p.team === 'ally' ? 'ok' : p.team === 'enemy' ? 'bad' : undefined}>{p.team}</Badge></td>
                            <td>{p.initiative}</td>
                            <td>{p.turn_order + 1}</td>
                            <td>{p.current_pv ?? '—'}</td>
                            <td>{p.current_alma ?? '—'}</td>
                            <td>{p.is_defeated ? <Badge tone="bad">Derrotado</Badge> : <Badge tone="ok">Ativo</Badge>}</td>
                            <td>
                              <div className="row" style={{ gap: '0.5rem' }}>
                                <Button size="sm" variant="ghost" onClick={async () => { await updateCombatParticipant(p.id, { is_defeated: !p.is_defeated, defeated_at: !p.is_defeated ? new Date().toISOString() : null }); setParticipants(prev => prev.map(x => x.id === p.id ? { ...x, is_defeated: !p.is_defeated, defeated_at: !p.is_defeated ? new Date().toISOString() : null } : x)); }}>
                                  {p.is_defeated ? 'Reviver' : 'Derrotar'}
                                </Button>
                                <Button size="sm" variant="danger" onClick={async () => { await deleteCombatParticipant(p.id); setParticipants(prev => prev.filter(x => x.id !== p.id)); }}>Remover</Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {showAddParticipant && (
                <Modal title="Adicionar Participante" onClose={() => setShowAddParticipant(false)}>
                  <form className="stack" onSubmit={e => { e.preventDefault(); handleAddParticipant(); }}>
                    <div className="field">
                      <label>Tipo</label>
                      <select className="input" value={newParticipant.type} onChange={e => setNewParticipant(prev => ({ ...prev, type: e.target.value as 'character' | 'npc', character_id: e.target.value === 'character' ? '' : '', npc_name: e.target.value === 'npc' ? '' : '' }))}>
                        <option value="character">Personagem Jogador</option>
                        <option value="npc">NPC</option>
                      </select>
                    </div>
                    {newParticipant.type === 'character' && (
                      <div className="field">
                        <label>Personagem</label>
                        <select className="input" value={newParticipant.character_id} onChange={e => setNewParticipant(prev => ({ ...prev, character_id: e.target.value }))}>
                          <option value="">Selecione...</option>
                          {campChars.map(c => <option key={c.id} value={c.id}>{c.name} (Estágio {c.stage})</option>)}
                        </select>
                      </div>
                    )}
                    {newParticipant.type === 'npc' && (
                      <Field label="Nome do NPC" htmlFor="npc-name"><input id="npc-name" className="input" value={newParticipant.npc_name} onChange={e => setNewParticipant(prev => ({ ...prev, npc_name: e.target.value }))} maxLength={80} required /></Field>
                    )}
                    <div className="grid cols-2">
                      <Field label="Iniciativa" htmlFor="init"><input id="init" type="number" className="input" value={newParticipant.initiative} onChange={e => setNewParticipant(prev => ({ ...prev, initiative: Number(e.target.value) || 0 }))} min={-10} max={99} /></Field>
                      <Field label="Time" htmlFor="team"><select id="team" className="input" value={newParticipant.team} onChange={e => setNewParticipant(prev => ({ ...prev, team: e.target.value as any }))}><option value="ally">Aliado</option><option value="enemy">Inimigo</option><option value="neutral">Neutro</option></select></Field>
                    </div>
                    <div className="modal-actions"><Button type="button" variant="ghost" onClick={() => setShowAddParticipant(false)}>Cancelar</Button><Button type="submit" variant="primary">Adicionar</Button></div>
                  </form>
                </Modal>
              )}
            </Panel>

            {/* Combat Log */}
            <Panel title="Histórico de Ações" icon="history">
              {actions.length === 0 ? (
                <p className="muted small" style={{ margin: 0 }}>Nenhuma ação registrada ainda.</p>
              ) : (
                <div className="stack-sm">
                  {actions.slice().reverse().map(a => (
                    <div key={a.id} className="field" style={{ padding: '0.5rem', background: 'var(--bg-elevated)', borderRadius: '6px' }}>
                      <div className="row row-between">
                        <div className="row" style={{ gap: '0.5rem' }}>
                          <Badge tone="accent">Rodada {a.round_number}</Badge>
                          <strong>{a.description}</strong>
                        </div>
                        <span className="muted small">{new Date(a.created_at).toLocaleTimeString()}</span>
                      </div>
                      {a.ability_id && <div className="muted small">Habilidade: {a.ability_id}</div>}
                      {a.damage_dealt && <div className="muted small">Dano: {JSON.stringify(a.damage_dealt)}</div>}
                      {a.roll_result && <div className="muted small">Rolagem: {JSON.stringify(a.roll_result)}</div>}
                    </div>
                  ))}
                </div>
              )}

              {/* Quick Action Buttons */}
              {selectedEncounter.status === 'active' && participants.length > 0 && (
                <div className="row" style={{ marginTop: '1rem', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Button size="sm" onClick={() => handleAddAction({ action_type: 'attack', description: `${participants[turnOrder].npc_name || campChars.find(c => c.id === participants[turnOrder].character_id)?.name} ataca` })}>Registrar Ataque</Button>
                  <Button size="sm" variant="ghost" onClick={() => handleAddAction({ action_type: 'defend', description: `${participants[turnOrder].npc_name || campChars.find(c => c.id === participants[turnOrder].character_id)?.name} se defende` })}>Registrar Defesa</Button>
                  <Button size="sm" variant="ghost" onClick={() => handleAddAction({ action_type: 'move', description: `${participants[turnOrder].npc_name || campChars.find(c => c.id === participants[turnOrder].character_id)?.name} se move` })}>Registrar Movimento</Button>
                  <Button size="sm" variant="ghost" onClick={() => handleAddAction({ action_type: 'item', description: `${participants[turnOrder].npc_name || campChars.find(c => c.id === participants[turnOrder].character_id)?.name} usa item` })}>Registrar Item</Button>
                  <Button size="sm" variant="ghost" onClick={() => handleAddAction({ action_type: 'other', description: `${participants[turnOrder].npc_name || campChars.find(c => c.id === participants[turnOrder].character_id)?.name} realiza ação` })}>Outra Ação</Button>
                </div>
              )}
            </Panel>
          </Panel>
        </div>
      )}
    </div>
  );
  else body = (
    <div className="stack">
      <Panel title="Participantes" icon="users">
        {members.loading && !members.data ? <span className="spinner" role="status" aria-label="Carregando" /> : members.error ? <p className="muted">{members.error}</p>
          : !members.data?.length ? <EmptyState icon="users" title="Nenhum participante ainda">Gere um convite em Campanhas para chamar jogadores.</EmptyState>
          : <ul className="list">{members.data.map((m) => <li className="list-row" key={m.id}><div className="grow"><strong>{m.display_name}</strong></div><Badge>{m.member_role === 'co_mestre' ? 'Co-mestre' : 'Jogador'}</Badge></li>)}</ul>}
      </Panel>
      <Panel title="Fichas da campanha" icon="sheet" actions={<VisTag v="mestre" />}>
        {!campChars.length ? <EmptyState icon="sheet" title="Nenhuma ficha ainda">Os jogadores criam seus personagens no painel deles.</EmptyState>
          : <div className="table-wrap"><table><thead><tr><th>Personagem</th><th>Estágio</th><th>PV</th><th>ALMA</th><th><span className="sr-only">Ações</span></th></tr></thead>
            <tbody>{campChars.map((c) => <tr key={c.id}><td>{c.name}</td><td>{c.stage}</td><td>{c.sheet.pv.now}/{c.sheet.pv.max}</td><td>{c.sheet.alma.now}/{c.sheet.alma.max}</td><td><LinkButton to={`/jogador/ficha?id=${c.id}`} size="sm" variant="ghost">Abrir ficha</LinkButton></td></tr>)}</tbody></table></div>}
      </Panel>
    </div>);

  return (
    <>
      <PageHead eyebrow={`Painel do mestre${camp && real ? ' · ' + camp.name : ''}`} title={sec.label} actions={real && mine.length > 1 ? <><label className="sr-only" htmlFor="camp-sel">Campanha</label><select id="camp-sel" className="input" style={{ width: 'auto', minHeight: 40 }} value={camp?.id} onChange={(e) => setPick(e.target.value)}>{mine.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></> : undefined}>
        Você só vê e administra campanhas suas. O banco garante isso, não apenas esta tela.
      </PageHead>
      {!real && <div style={{ marginBottom: '1rem' }}><Alert tone="info" icon="hourglass">Seção reservada para as próximas fases.</Alert></div>}
      <div className="fade-in" key={section + (camp?.id ?? '')}>{body}</div>
    </>
  );
}
