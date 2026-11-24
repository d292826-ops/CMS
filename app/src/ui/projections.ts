import type { DemoState, Document, Role, User } from '../domain/types.ts';
export const ROLE_NAMES: Record<Role, string> = { MECHANIC: 'Механик', DRIVER: 'Водитель', WAREHOUSE: 'Кладовщик', FINANCE_DIRECTOR: 'Финансовый директор', OWNER: 'Собственник' };
export function selectedUser(state: DemoState): User | null { return state.data.users.find(user => user.id === state.selected_user_id) ?? null; }
export function canSeeFinance(user: User | null): boolean { return user?.role === 'FINANCE_DIRECTOR' || user?.role === 'OWNER'; }
export function canSeeDocumentMoney(user: User | null): boolean { return user?.role === 'WAREHOUSE' || canSeeFinance(user); }
export function projectDocument(doc: Document, user: User): Omit<Document, 'unit_price_minor' | 'amount_minor'> & Partial<Pick<Document, 'unit_price_minor' | 'amount_minor'>> {
  const { unit_price_minor, amount_minor, ...visible } = doc;
  return canSeeDocumentMoney(user) ? { ...visible, unit_price_minor, amount_minor } : visible;
}
export function canReadDocument(state:DemoState,doc:Document,user:User|null):boolean {
 if(!user)return false;if(canSeeFinance(user))return true;if(doc.kind==='SOURCE')return false;if(user.role==='WAREHOUSE')return doc.warehouse_id===user.warehouse_id;
 const original=doc.kind==='RETURN'?state.data.documents.find(d=>d.id===doc.return_of_document_id):doc;
 return original?.recipient_user_id===user.id||state.data.requests.some(r=>r.id===original?.request_id&&r.author_user_id===user.id);
}
