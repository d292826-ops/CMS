import type { DemoState, Document, FinancialOperation, Role } from '../domain/types.ts';

const CREATED = '2026-11-01T00:00:00+12:00';
export function createSeedState(): DemoState {
  const people: [string, string, Role][] = [
    ['M1', 'Алексей Морозов', 'MECHANIC'], ['D1', 'Сергей Волков', 'DRIVER'], ['D2', 'Игорь Соколов', 'DRIVER'],
    ['K1', 'Ольга Смирнова', 'WAREHOUSE'], ['F1', 'Дмитрий Орлов', 'FINANCE_DIRECTOR'], ['S1', 'Андрей Крылов', 'OWNER'],
  ];
  const sources = ['income-A', 'fuel-A', 'other-A', 'income-B', 'other-B'];
  const documents: Document[] = sources.map(id => ({ id: `source-${id}`, kind: 'SOURCE', number: id.startsWith('income') ? 'Д-001' : `И-${id}`, document_date: '2026-11-05', created_at: CREATED, created_by_user_id: null, posting_state: 'POSTED', posted_at: null, request_id: null, return_of_document_id: null, warehouse_id: null, vehicle_id: id.endsWith('-A') ? 'A' : 'B', vehicle_vin_snapshot: null, item_id: null, unit_id: null, quantity: null, recipient_user_id: null, unit_price_minor: null, amount_minor: null, discrepancy_comment: null, discrepancy_author_id: null, discrepancy_at: null }));
  const rows: [string, string, string, number][] = [['income-A', 'income', 'Перевозка стройматериалов', 300000], ['income-A', 'income', 'Работа на объекте', 200000], ['fuel-A', 'fuel', 'Дизельное топливо', 20000], ['fuel-A', 'fuel', 'Заправка', 50000], ['other-A', 'other', 'Прочие учтённые затраты', 30000], ['income-B', 'income', 'Работа машины Б', 60000], ['other-B', 'other', 'Учтённые затраты машины Б', 100000]];
  const financial_operations: FinancialOperation[] = rows.map(([source, article, description, amount], index) => ({ id: `finance-${index + 1}`, document_id: `source-${source}`, vehicle_id: source.endsWith('-A') ? 'A' : 'B', article_id: article, accounting_date: '2026-11-05', amount_minor: amount, description, item_id: null, quantity: null, unit_id: null, unit_price_minor: null }));
  return {
    id: 'supply-demo', dataset_id: 'baseline-november-2026', schema_version: 1, revision: 0, saved_at: CREATED,
    selected_user_id: null, default_warehouse_id: 'warehouse-main', currency: 'RUB', accounting_timezone: 'Asia/Kamchatka',
    data: {
      users: people.map(([id, name, role]) => ({ id, display_name: name, role, warehouse_id: role === 'WAREHOUSE' ? 'warehouse-main' : null, is_default_clerk: role === 'WAREHOUSE', is_active: true, created_at: CREATED })),
      vehicles: [
        { id: 'A', display_name: 'КамАЗ 65115', registration_number: 'А743КХ41', vin: 'XTEST000000000001', is_active: true },
        { id: 'B', display_name: 'КамАЗ 65115', registration_number: 'В218МН41', vin: 'XTEST000000000002', is_active: true },
        { id: 'NO-VIN', display_name: 'Экскаватор — неполный пример', registration_number: null, vin: null, is_active: true },
      ],
      units: [{ id: 'pcs', code: 'pcs', name: 'шт.', quantity_scale: 0 }, { id: 'meter', code: 'meter', name: 'м', quantity_scale: 3 }],
      items: [
        { id: 'P-001', article: 'LF9009', name: 'Фильтр масляный Fleetguard', unit_id: 'pcs', reference_unit_price_minor: 50000, is_active: true },
        { id: 'P-002', article: 'LF14000NN', name: 'Фильтр масляный Fleetguard', unit_id: 'pcs', reference_unit_price_minor: 70000, is_active: true },
        { id: 'P-UNKNOWN-PRICE', article: 'BELT-6PK', name: 'Ремень приводной', unit_id: 'pcs', reference_unit_price_minor: null, is_active: true },
        { id: 'P-ZERO', article: 'PAD-5320', name: 'Колодка тормозная', unit_id: 'pcs', reference_unit_price_minor: 140000, is_active: true },
        { id: 'P-UNKNOWN-STOCK', article: 'BEARING-6205', name: 'Подшипник ступицы', unit_id: 'pcs', reference_unit_price_minor: 85000, is_active: true },
        { id: 'P-METER', article: 'HOSE-16', name: 'Рукав топливный 16 мм', unit_id: 'meter', reference_unit_price_minor: 30000, is_active: true },
      ],
      warehouses: [{ id: 'warehouse-main', name: 'Основной склад запчастей', is_active: true }],
      stock_positions: [ ['P-001', '10'], ['P-002', '4'], ['P-UNKNOWN-PRICE', '5'], ['P-ZERO', '0'], ['P-UNKNOWN-STOCK', null], ['P-METER', '12.5'] ].map(([item, initial]) => ({ id: `stock-${item}`, warehouse_id: 'warehouse-main', item_id: item!, initial_quantity: initial })),
      requests: [{ id: 'request-control', number: 'З-0001', created_at: CREATED, author_user_id: 'M1', warehouse_id: 'warehouse-main', assigned_clerk_id: 'K1', vehicle_id: 'A', item_id: 'P-001', quantity: '2', comment: 'Контрольный пример для проверки выдачи', cancelled_at: null }],
      documents, confirmations: [], stock_movements: [],
      financial_articles: [
        { id: 'income', name: 'Доходы', direction: 'INCOME', included_in_result: true, description: 'Подготовленные доходы машины' },
        { id: 'fuel', name: 'Топливо', direction: 'EXPENSE', included_in_result: true, description: 'Учтённые затраты на топливо' },
        { id: 'other', name: 'Прочее', direction: 'EXPENSE', included_in_result: true, description: 'Другие учтённые затраты' },
        { id: 'parts', name: 'Запчасти', direction: 'EXPENSE', included_in_result: true, description: 'Расходы по фактическим выдачам и возвратам' },
      ],
      financial_operations,
      financial_coverage: ['A', 'B'].flatMap(vehicle => ['income', 'fuel', 'other', 'parts'].map(article => ({ id: `coverage-${vehicle}-${article}`, vehicle_id: vehicle, period_start: '2026-11-01', article_id: article, base_status: 'COMPLETE' as const, note: 'Полнота только согласованного учебного набора' }))),
    },
  };
}
