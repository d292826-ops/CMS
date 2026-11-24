import { useRef, useState } from 'react';
import { useDemo } from '../state/DemoProvider.tsx';
import { commitDemoCommand } from '../state/commands.ts';
import { prepareIssue, postIssue } from '../domain/issue.ts';
import { currentStock, documentStatus } from '../domain/status.ts';
import { Button, Field } from '../ui/components.tsx';
import { selectedUser } from '../ui/projections.ts';
import { formatMoney } from '../ui/format.ts';
export function IssueCheckPanel() {
  const demo = useDemo(); const attempt = useRef(crypto.randomUUID());
  const [recipient, setRecipient] = useState(''); const [quantity, setQuantity] = useState('2'); const [message, setMessage] = useState('');
  if (!demo.state) return null; const state = demo.state; const actor = selectedUser(state);
  if (actor?.role !== 'WAREHOUSE') return null;
  const request = state.data.requests.find(r => r.id === 'request-control'); if (!request) return null;
  const item = state.data.items.find(i => i.id === request.item_id)!; const vehicle = state.data.vehicles.find(v => v.id === request.vehicle_id)!;
  const doc = state.data.documents.find(d => d.kind === 'ISSUE' && d.request_id === request.id);
  const run = (post: boolean) => {
    const input = { requestId: request.id, actorId: actor.id, recipientId: recipient, attemptId: attempt.current, occurredAt: new Date().toISOString(), itemId: item.id, vehicleId: vehicle.id, vin: vehicle.vin, quantity, unitId: item.unit_id };
    const result = commitDemoCommand(demo.storage, state, current => post ? postIssue(current, input) : prepareIssue(current, input), post ? 'ISSUE_POSTED' : 'ISSUE_PREPARED');
    if (!result.ok) { demo.accept(result); setMessage(result.message); return; }
    demo.accept({ ok: true, value: result.value.state }); setMessage(post ? 'Контрольная выдача проведена' : 'Документ подготовлен без списания');
  };
  return <details className="control-panel"><summary>Контрольная выдача — этап 2</summary><p>Заявка {request.number} · {vehicle.display_name} · {item.article}</p><Field label="Фактический получатель" htmlFor="check-recipient"><select id="check-recipient" value={recipient} onChange={e => setRecipient(e.target.value)}><option value="">Выберите получателя</option>{state.data.users.filter(u => ['MECHANIC', 'DRIVER'].includes(u.role)).map(u => <option key={u.id} value={u.id}>{u.id} — {u.display_name}</option>)}</select></Field><Field label="Количество" htmlFor="check-quantity"><input id="check-quantity" value={quantity} onChange={e => setQuantity(e.target.value)}/></Field><div className="actions"><Button variant="secondary" onClick={() => run(false)}>Подготовить контрольную выдачу</Button><Button onClick={() => run(true)}>Подтвердить контрольную выдачу</Button></div><p role="status">{message}</p><p>Остаток: <strong data-check-stock>{currentStock(state, request.warehouse_id, request.item_id)} шт.</strong></p>{doc && <p>{doc.number}: {documentStatus(state, doc)} · {formatMoney(doc.amount_minor)}</p>}</details>;
}
