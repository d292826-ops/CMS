import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {connect} from './driver.mjs';

const b = await connect();
const base = (process.env.SUPPLY_BASE_URL ?? 'http://127.0.0.1:4173/').replace(/\/$/, '');
const out = new URL('../results/review-fixes.json', import.meta.url);
const checks = [];
const at = (path, mode = '') => b.go(base + '/' + (mode ? '?case=' + mode : '') + '#' + path);
const state = () => b.evaluate('JSON.parse(localStorage.getItem("supply-demo:v1"))');
async function check(finding, label, run) {
  await run(); checks.push({finding, label, status: 'PASS'});
}
async function role(id) {
  await at('/'); await b.value('#participant', id);
  await b.click(await b.evaluate('document.querySelector("#participant").closest("form").querySelector("button").textContent.trim()'));
  await b.wait('document.querySelector(".active-user").textContent.includes(' + JSON.stringify(id) + ')');
}
async function reset() {
  await at('/'); await b.click('Начать демонстрацию заново'); await b.click('Восстановить исходный набор');
  await b.wait('document.querySelector(".active-user").textContent.includes("не выбран")');
}
async function dataset(id) {
  await at('/'); await b.evaluate('document.querySelectorAll("details").forEach(d=>d.open=true)');
  await b.value('#dataset', id); await b.click('Загрузить учебный пример'); await b.click('Заменить демоданные');
}
async function changeOtherTab() {
  const id = (await state()).selected_user_id;
  const {targetId} = await b.send('Target.createTarget', {url: 'about:blank'});
  const other = await connect(targetId);
  try {
    await other.go(base + '/#/'); await other.value('#participant', id);
    await other.click(await other.evaluate('document.querySelector("#participant").closest("form").querySelector("button").textContent.trim()'));
    await other.wait('document.querySelector(".active-user").textContent.includes(' + JSON.stringify(id) + ')');
  } finally {other.close(); await b.send('Target.closeTarget', {targetId});}
}
async function active(label) {
  await b.wait('document.querySelectorAll(".nav-item[aria-current=page]").length===1');
  assert.equal(await b.evaluate('document.querySelector(".nav-item[aria-current=page]").textContent.trim()'), label);
  assert.equal(await b.evaluate('document.querySelector(".nav-item[aria-current=page]").classList.contains("active")'), true);
}

try {
  await check(1, 'Потеря ответа не отрицает сохранение и не создаёт повторное списание', async () => {
    await reset(); await role('K1'); await at('/requests/request-control/issue', 'lost-response');
    await b.value('#issue-recipient', 'D1'); await b.click('Подтвердить фактическую выдачу'); await b.click('Провести выдачу');
    await b.wait('document.querySelector(".state-message").textContent.includes("Документ, списание и расход сохранены")');
    assert.equal(await b.evaluate('!!document.querySelector(".state-error")'), false);
    assert.equal(await b.evaluate('document.body.innerText.includes("Списание не выполнено")'), false);
    await b.click('Открыть сохранённую выдачу'); await b.wait('!!document.querySelector(".document-details")');
    const s = await state(); assert.equal(s.data.stock_movements.length, 1);
    const issued = s.data.documents.filter(d => d.kind === 'ISSUE'); assert.equal(issued.length, 1);
    assert.equal(issued[0].posting_state, 'POSTED');
    assert.equal(s.data.financial_operations.filter(row => row.document_id === issued[0].id).length, 1);
  });
  await check(2, 'Черновик выдачи остаётся под защитой в каталоге и очищается после отказа и сброса', async () => {
    await reset(); await role('K1'); await at('/requests/request-control/issue'); await b.value('#issue-recipient', 'D1');
    await b.click('Сверить с номенклатурой'); await b.wait('!!document.querySelector("#catalog-search")');
    await b.click('Выбрать участника'); await b.wait('!!document.querySelector("dialog[open]")');
    await b.click('Остаться'); await b.click('Вернуться без выбора'); await b.wait('!!document.querySelector("#issue-recipient")');
    assert.equal(await b.evaluate('document.querySelector("#issue-recipient").value'), 'D1');
    await b.click('Сверить с номенклатурой'); await b.click('Выбрать участника'); await b.click('Отменить ввод');
    await b.wait('!!document.querySelector("#participant")');
    await b.click('Начать демонстрацию заново'); await b.click('Восстановить исходный набор');
    await role('K1'); await at('/requests/request-control/issue');
    assert.equal(await b.evaluate('document.querySelector("#issue-recipient").value'), '');
    assert.equal((await state()).data.documents.filter(d => d.kind === 'ISSUE').length, 0);
  });
  await check(3, 'Выбор позиции убирает только её ошибку; отмена и новый участник очищают подсказки', async () => {
    await reset(); await role('M1'); await at('/requests/new'); await b.click('Отправить заявку');
    assert.equal(await b.evaluate('document.querySelectorAll(".field-error").length'), 3);
    await b.click('Найти в номенклатуре'); await b.click('Выбрать P-001'); await b.wait('!!document.querySelector("#request-item")');
    assert.equal(await b.evaluate('document.querySelectorAll(".field-error").length'), 2);
    for (const id of ['vehicle', 'quantity']) assert.equal(await b.evaluate(`document.querySelector('#request-${id}').getAttribute('aria-invalid')`), 'true');
    await b.value('#request-vehicle', 'A'); assert.equal(await b.evaluate('document.querySelectorAll(".field-error").length'), 1);
    await b.click('Отменить ввод'); await b.click('Отменить ввод'); await b.wait('location.hash==="#/requests"');
    await b.click('Создать заявку'); assert.equal(await b.evaluate('document.querySelectorAll(".field-error").length'), 0);
  });
  await check(4, 'Обновление после конфликта сохраняет получателя; ошибка чтения не сбрасывает форму', async () => {
    await reset(); await role('K1'); await at('/requests/request-control/issue'); await b.value('#issue-recipient', 'D1');
    await changeOtherTab(); await b.click('Подготовить документ'); await b.wait('document.body.innerText.includes("Обновить данные")');
    const raw = await b.evaluate('localStorage.getItem("supply-demo:v1")');
    await b.evaluate('localStorage.setItem("supply-demo:v1", "{")'); await b.click('Обновить данные');
    assert.equal(await b.evaluate('document.querySelector("#issue-recipient").value'), 'D1');
    assert.equal(await b.evaluate('localStorage.getItem("supply-demo:v1")'), '{');
    await b.evaluate('localStorage.setItem("supply-demo:v1",' + JSON.stringify(raw) + ')');
    await b.click('Обновить данные'); await b.wait('!document.querySelector(".state-error")');
    assert.equal(await b.evaluate('document.querySelector("#issue-recipient").value'), 'D1');
    await b.click('Подготовить документ'); await b.wait('document.body.innerText.includes("Документ подготовлен")');
    assert.equal((await state()).data.stock_movements.length, 0);
    await b.click('Подтвердить фактическую выдачу'); await b.click('Провести выдачу'); await b.wait('!!document.querySelector(".document-details")');
    assert.equal((await state()).data.stock_movements.length, 1);
  });
  await check(4, 'Обновление заявки, пояснения, отмены и возврата не выполняет операцию автоматически', async () => {
    await reset(); await role('M1'); await at('/requests/new?item=P-001');
    await b.value('#request-vehicle', 'A'); await b.value('#request-quantity', '2'); await b.value('#request-comment', 'Проверить фильтр');
    await changeOtherTab(); await b.click('Отправить заявку'); await b.wait('document.body.innerText.includes("Обновить данные")');
    await b.click('Обновить данные'); await b.wait('!document.querySelector(".state-error")');
    assert.equal(await b.evaluate('document.querySelector("#request-comment").value'), 'Проверить фильтр');
    assert.equal((await state()).data.requests.length, 1);
    await b.click('Отправить заявку'); await b.wait('location.hash.startsWith("#/requests/")');
    const requestId = (await state()).data.requests.at(-1).id;
    await changeOtherTab(); await b.click('Отменить заявку'); await b.click('Да, отменить заявку');
    await b.wait('document.body.innerText.includes("Обновить данные")');
    await b.click('Обновить данные'); await b.wait('!document.querySelector(".state-error")');
    assert.equal((await state()).data.requests.find(r => r.id === requestId).cancelled_at, null);
    await b.click('Отменить заявку'); await b.click('Да, отменить заявку'); await b.wait('document.querySelector(".status-chip").textContent.includes("Отменена")');

    await dataset('issued-price-changed'); await role('D1');
    const issueId = (await state()).data.documents.find(d => d.kind === 'ISSUE').id;
    await at('/documents/' + issueId); await b.click('Есть расхождение'); await b.value('#discrepancy-comment', 'Не совпала маркировка');
    await changeOtherTab(); await b.click('Сохранить пояснение'); await b.wait('document.body.innerText.includes("Обновить данные")');
    await b.click('Обновить данные'); await b.wait('!document.querySelector(".state-error")');
    assert.equal(await b.evaluate('document.querySelector("#discrepancy-comment").value'), 'Не совпала маркировка');
    assert.equal((await state()).data.documents.find(d => d.id === issueId).discrepancy_comment, null);
    await b.click('Сохранить пояснение'); await b.wait('!document.querySelector("#discrepancy-comment")');

    await role('K1'); await at('/documents/' + issueId + '/return'); await changeOtherTab();
    await b.click('Подтвердить полный возврат'); await b.click('Провести возврат'); await b.wait('document.body.innerText.includes("Обновить данные")');
    await b.click('Обновить данные'); await b.wait('!document.querySelector(".state-error")');
    assert.equal((await state()).data.documents.filter(d => d.kind === 'RETURN').length, 0);
    await b.click('Подтвердить полный возврат'); await b.click('Провести возврат'); await b.wait('!!document.querySelector(".state-success")');
    assert.equal((await state()).data.documents.filter(d => d.kind === 'RETURN').length, 1);
  });
  await check(5, 'Ошибки получателя и пояснения имеют связь с полем, фокус и корректное снятие', async () => {
    await reset(); await role('K1'); await at('/requests/request-control/issue'); await b.click('Подготовить документ');
    assert.equal(await b.evaluate('document.activeElement.id'), 'issue-recipient');
    assert.equal(await b.evaluate('document.querySelector("#issue-recipient").getAttribute("aria-describedby")'), 'issue-recipient-error');
    assert.equal(await b.evaluate('document.querySelector("#issue-recipient").getAttribute("aria-invalid")'), 'true');
    await b.value('#issue-recipient', 'D1'); assert.equal(await b.evaluate('document.querySelector("#issue-recipient").getAttribute("aria-describedby")'), null);
    await dataset('issued-price-changed'); await role('D1');
    const id = (await state()).data.documents.find(d => d.kind === 'ISSUE').id;
    await at('/documents/' + id); await b.click('Есть расхождение'); await b.click('Сохранить пояснение');
    assert.equal(await b.evaluate('document.activeElement.id'), 'discrepancy-comment');
    assert.equal(await b.evaluate('document.querySelector("#discrepancy-comment").getAttribute("aria-invalid")'), 'true');
    assert.equal(await b.evaluate('document.querySelector("#discrepancy-comment").getAttribute("aria-describedby")'), 'discrepancy-comment-error');
    await b.value('#discrepancy-comment', 'Проверить деталь');
    assert.equal(await b.evaluate('!!document.querySelector("#discrepancy-comment-error")'), false);
    assert.equal(await b.evaluate('document.querySelector("#discrepancy-comment").getAttribute("aria-invalid")'), 'false');
  });
  await check(6, 'Текущий раздел выделен у всех ролей и вложенных экранов; h2 соответствует токену', async () => {
    await reset();
    for (const id of ['M1', 'D1']) {
      await role(id); await active('Начало демонстрации');
      await at('/requests'); await active('Мои заявки');
      await at('/requests/new'); await active('Создать заявку');
      await at('/catalog'); await active('Номенклатура');
    }
    await role('K1'); await at('/warehouse/requests'); await active('Очередь склада');
    await at('/requests/request-control/issue'); await active('Очередь склада');
    await at('/catalog'); await active('Номенклатура');
    for (const id of ['F1', 'S1']) {
      await role(id); await at('/vehicles/A?period=2026-11&article=fuel'); await active('Финансовый разбор');
      assert.equal(await b.evaluate('getComputedStyle(document.querySelector("h2")).letterSpacing'), '-0.3px');
      await b.click('Открыть источник'); await b.wait('!!document.querySelector(".document-details")'); await active('Финансовый разбор');
    }
  });
  await check('R2-1', 'Повторная подготовка сохраняет уточнённого получателя и тот же документ', async () => {
    await reset(); await role('K1'); await at('/requests/request-control/issue');
    await b.value('#issue-recipient','D1'); await b.click('Подготовить документ');
    const first=(await state()).data.documents.find(d=>d.kind==='ISSUE');
    await b.value('#issue-recipient','D2'); await b.click('Подготовить документ');
    assert.equal(await b.evaluate('document.querySelector("#issue-recipient").value'),'D2');
    const prepared=(await state()).data.documents.filter(d=>d.kind==='ISSUE');
    assert.equal(prepared.length,1);assert.equal(prepared[0].id,first.id);assert.equal(prepared[0].recipient_user_id,'D2');
    assert.equal((await state()).data.stock_movements.length,0);
    const before=JSON.stringify(await state());await b.click('Подготовить документ');assert.equal(JSON.stringify(await state()),before);
    await b.click('Подтвердить фактическую выдачу');await b.click('Провести выдачу');await b.wait('!!document.querySelector(".document-details")');
    assert.equal((await state()).data.documents.find(d=>d.id===first.id).recipient_user_id,'D2');
    assert.equal((await state()).data.stock_movements.length,1);
  });
  await check('R2-2', 'Пустая отклонённая заявка не переносит подсказки новому участнику', async () => {
    await reset();await role('M1');await at('/requests/new');await b.click('Отправить заявку');
    assert.equal(await b.evaluate('document.querySelectorAll(".field-error").length'),3);
    await b.click('Выбрать участника');await b.wait('!!document.querySelector("#participant")');
    await b.value('#participant','D1');await b.click('Сменить участника');await b.click('Создать заявку');
    assert.equal(await b.evaluate('document.querySelectorAll(".field-error").length'),0);
  });
  await check('R2-3', 'Подсказка количества остаётся при 0 → -1 → текст и снимается на 2', async () => {
    await reset();await role('M1');await at('/requests/new?item=P-001');await b.value('#request-vehicle','A');
    await b.value('#request-quantity','0');await b.click('Отправить заявку');
    for(const quantity of ['-1','text']){await b.value('#request-quantity',quantity);assert.equal(await b.evaluate('document.querySelector("#request-quantity").getAttribute("aria-invalid")'),'true');assert.equal(await b.evaluate('!!document.querySelector("#request-quantity-error")'),true);}
    await b.value('#request-quantity','2');assert.equal(await b.evaluate('!!document.querySelector("#request-quantity-error")'),false);
  });
  await check('R2-4', 'Смена участника при конфликте требует решения о черновике и не меняет автора молча', async () => {
    await reset();await role('M1');await at('/requests/new?item=P-001');
    await b.value('#request-vehicle','A');await b.value('#request-quantity','2');await b.value('#request-comment','Черновик механика');
    const {targetId}=await b.send('Target.createTarget',{url:'about:blank'});const other=await connect(targetId);
    const otherRole=async id=>{await other.go(base+'/#/');await other.value('#participant',id);await other.click(await other.evaluate('document.querySelector("#participant").closest("form").querySelector("button").textContent.trim()'));};
    try{
      await otherRole('D1');await b.click('Отправить заявку');await b.wait('document.body.innerText.includes("Обновить данные")');
      await b.click('Обновить данные');await b.wait('!!document.querySelector("dialog[open]")');await b.click('Остаться');
      assert.equal(await b.evaluate('document.querySelector("#request-comment").value'),'Черновик механика');
      assert.equal(await b.evaluate('document.querySelector(".active-user").textContent.includes("M1")'),true);
      await b.click('Обновить данные');await b.click('Отменить ввод и обновить');await b.wait('document.querySelector(".active-user").textContent.includes("D1")');
      assert.equal(await b.evaluate('document.querySelector("#request-comment").value'),'');assert.equal((await state()).data.requests.length,1);
      // Same revision conflict first, participant changes only before refresh.
      await reset();await role('M1');await at('/requests/new?item=P-001');await b.value('#request-vehicle','A');await b.value('#request-quantity','2');await b.value('#request-comment','Сохранять только за М1');
      await otherRole('M1');await b.click('Отправить заявку');await b.wait('document.body.innerText.includes("Обновить данные")');await otherRole('D1');
      await b.click('Обновить данные');await b.wait('!!document.querySelector("dialog[open]")');await b.click('Остаться');
      assert.equal(await b.evaluate('document.querySelector("#request-comment").value'),'Сохранять только за М1');
      assert.equal((await state()).data.requests.length,1);
      await b.click('Обновить данные');await b.click('Отменить ввод и обновить');await b.wait('document.querySelector(".active-user").textContent.includes("D1")');
      assert.equal(await b.evaluate('document.querySelector("#request-vehicle").value'),'');assert.equal(await b.evaluate('document.querySelector("#request-quantity").value'),'');
      await b.click('Отправить заявку');assert.equal((await state()).data.requests.length,1);
    }finally{other.close();await b.send('Target.closeTarget',{targetId});}
  });
  assert.equal(b.exceptions.length, 0);
  await dataset('baseline-november-2026'); await at('/');
  await fs.writeFile(out, JSON.stringify({date: new Date().toISOString(), base, findings: 10, round1Findings: 6, round2Findings: 4, checks, exceptions: b.exceptions}, null, 2));
  console.log(JSON.stringify({findings: 10, round1Findings: 6, round2Findings: 4, checks: checks.length, exceptions: b.exceptions.length}));
} catch (error) {
  await fs.writeFile(out, JSON.stringify({checks, error: String(error), exceptions: b.exceptions}, null, 2));
  console.error(error); process.exitCode = 1;
} finally {b.close();}
