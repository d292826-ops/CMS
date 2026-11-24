import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect } from './driver.mjs';
const b = await connect(); const base = (process.env.SUPPLY_BASE_URL ?? 'http://127.0.0.1:4173/').replace(/\/$/, '');
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'supply-backup-download-'));
const checks = []; const out = new URL('../results/', import.meta.url);
const at = p => b.go(base + '/#' + p);
const raw = () => b.evaluate('localStorage.getItem("supply-demo:v1")');
const state = async () => JSON.parse(await raw());
async function role(id) { await at('/'); await b.value('#participant', id); await b.click(await b.evaluate('document.querySelector("#participant").closest("form").querySelector("button").textContent.trim()')); }
async function check(name, fn) { await fn(); checks.push({ name, status: 'PASS' }); }
async function upload(file) {
  const { root } = await b.send('DOM.getDocument');
  const { nodeId } = await b.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#backup-file' });
  await b.send('DOM.setFileInputFiles', { nodeId, files: [file] });
}
let original, file, issued;
try {
  await b.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await at('/'); await b.evaluate('localStorage.clear()'); await at('/');
  await check('Скачанный JSON содержит созданную заявку, выдачу и оба подтверждения', async () => {
    await role('M1'); await at('/requests/new?item=P-001'); await b.value('#request-vehicle', 'A'); await b.value('#request-quantity', '2'); await b.click('Отправить заявку'); await b.wait('!location.hash.includes("/new")');
    const request = (await state()).data.requests.at(-1);
    await role('K1'); await at('/requests/' + request.id + '/issue'); await b.value('#issue-recipient', 'D1'); await b.click('Подтвердить фактическую выдачу'); await b.click('Провести выдачу'); await b.wait('document.querySelector("h1").textContent==="В-0001"');
    issued = (await state()).data.documents.find(d => d.request_id === request.id);
    await role('D1'); await at('/documents/' + issued.id); await b.click('Подтвердить получение'); await b.click('Да, получил'); await b.wait('document.querySelector(".document-details").textContent.includes("Выдан и подписан")');
    await at('/'); original = await state();
    await b.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dir });
    await b.click('Скачать резервную копию JSON');
    for (let i = 0; i < 50; i++) { const found = (await fs.readdir(dir)).find(n => n.endsWith('.json')); if (found) { file = path.join(dir, found); break; } await new Promise(r => setTimeout(r, 100)); }
    assert(file, 'JSON download missing');
    const copy = JSON.parse(await fs.readFile(file, 'utf8')); assert.equal(copy.format, 'otdel-snabzheniya-backup-v1');
    assert.deepEqual(copy.state.data, original.data); assert.equal(copy.state.data.stock_movements.length, 1); assert.equal(copy.state.data.confirmations.length, 2);
  });
  await check('Отмена восстановления автокопии не меняет данные; подтверждение возвращает изменения после сброса', async () => {
    await b.click('Начать демонстрацию заново'); await b.click('Восстановить исходный набор');
    assert.equal((await state()).data.stock_movements.length, 0);
    const before = await raw(); const history = await b.evaluate('localStorage.getItem("supply-demo:backups:v1")');
    await b.value('#backup-snapshot', '0'); await b.click('Восстановить выбранную автокопию'); await b.click('Отмена');
    assert.equal(await raw(), before); assert.equal(await b.evaluate('localStorage.getItem("supply-demo:backups:v1")'), history);
    await b.click('Восстановить выбранную автокопию'); await b.click('Восстановить копию'); await b.wait('document.querySelector(".backup-panel").innerText.includes("Резервная копия восстановлена")');
    assert.deepEqual((await state()).data, original.data); assert((await state()).revision > original.revision);
  });
  await check('Файл восстанавливает выданную запчасть после полной очистки браузерного хранения без повторного списания', async () => {
    await b.evaluate('localStorage.clear()'); await at('/'); assert.equal(await raw(), null);
    await upload(file); await b.wait('!!document.querySelector("dialog[open]")'); assert.equal(await raw(), null);
    await b.click('Восстановить копию'); await b.wait('!!localStorage.getItem("supply-demo:v1")');
    assert.deepEqual((await state()).data, original.data);
    await at('/documents/' + issued.id); assert.equal(await b.evaluate('document.querySelector(".document-details").textContent.includes("Выдан и подписан")'), true);
    await role('F1'); await at('/vehicles/A?period=2026-11'); assert.match(await b.evaluate('document.querySelector("[data-result]").textContent'), /3.?000/);
  });
  await check('Повреждённый, чужой, противоречивый и слишком большой файл не заменяют демонстрацию', async () => {
    await at('/');
    const broken = JSON.parse(await fs.readFile(file, 'utf8')); broken.state.data.stock_movements[0].quantity_delta = '-999';
    for (const [name, text] of [['bad.json', '{broken'], ['other.json', '{"format":"foreign"}'], ['links.json', JSON.stringify(broken)], ['large.json', 'x'.repeat(2 * 1024 * 1024 + 1)]]) {
      const target = path.join(dir, name); await fs.writeFile(target, text); const before = await raw();
      const history = await b.evaluate('localStorage.getItem("supply-demo:backups:v1")');
      await upload(target); await b.wait('!!document.querySelector(".backup-panel [role=alert]")');
      assert.equal(await raw(), before); assert.equal(await b.evaluate('localStorage.getItem("supply-demo:backups:v1")'), history);
      assert.equal(await b.evaluate('!!document.querySelector("dialog[open]")'), false);
    }
  });
  await check('Изменение после предпросмотра блокирует восстановление из устаревшего подтверждения', async () => {
    await upload(file); await b.wait('!!document.querySelector("dialog[open]")');
    await b.evaluate('(()=>{const s=JSON.parse(localStorage.getItem("supply-demo:v1"));s.revision++;s.selected_user_id="M1";localStorage.setItem("supply-demo:v1",JSON.stringify(s));})()');
    const before = await raw(); await b.click('Восстановить копию');
    await b.wait('document.querySelector(".backup-panel").innerText.includes("данные изменились в другой вкладке")'); assert.equal(await raw(), before);
  });
  await check('Отказ записи автокопии отменяет изменение и сохраняет первичный набор', async () => {
    await at('/'); const before = await raw(); const history = await b.evaluate('localStorage.getItem("supply-demo:backups:v1")');
    await b.evaluate('window.__backupSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==="supply-demo:backups:v1")throw new DOMException("quota","QuotaExceededError");return window.__backupSet.call(this,k,v)}');
    try {
      await b.value('#participant', 'K1'); await b.click('Сменить участника'); await b.wait('document.body.innerText.includes("Не удалось сохранить автокопию")');
      assert.equal(await raw(), before); assert.equal(await b.evaluate('localStorage.getItem("supply-demo:backups:v1")'), history);
    } finally { await b.evaluate('Storage.prototype.setItem=window.__backupSet;delete window.__backupSet'); }
  });
  await check('Явное исправление повреждённой истории не сбрасывает заявки и документы', async () => {
    await b.evaluate('localStorage.setItem("supply-demo:backups:v1","{broken")'); await at('/'); const before = await raw();
    await b.click('Начать новую историю копий'); await b.click('Отмена'); assert.equal(await raw(), before);
    assert.equal(await b.evaluate('localStorage.getItem("supply-demo:backups:v1")'), '{broken');
    await b.click('Начать новую историю копий'); await b.click('Заменить повреждённую историю'); assert.equal(await raw(), before);
    assert.equal(await b.evaluate('localStorage.getItem("supply-demo:backups:v1")'), '[]');
  });
  await check('Резервная копия восстанавливается и при повреждённом основном сохранении', async () => {
    await b.evaluate('localStorage.setItem("supply-demo:v1","{broken")'); await at('/');
    await upload(file); await b.wait('!!document.querySelector("dialog[open]")'); await b.click('Восстановить копию'); await b.wait('document.querySelector(".backup-panel").innerText.includes("Резервная копия восстановлена")');
    assert.deepEqual((await state()).data, original.data);
    assert.equal((await state()).data.stock_movements.length, 1);
  });
  await check('Резервирование доступно на телефоне и не переполняет экран', async () => {
    await b.screenshot(fileURLToPath(new URL('backups-desktop.png', out)));
    for (const width of [390, 320]) {
      await b.send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: true });
      assert.equal(await b.evaluate('document.documentElement.scrollWidth<=innerWidth'), true, 'width ' + width);
      if (width === 390) await b.screenshot(fileURLToPath(new URL('backups-mobile.png', out)));
    }
    await b.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  });
  assert.equal(b.exceptions.length, 0);
  await fs.writeFile(new URL('backups.json', out), JSON.stringify({ date: new Date().toISOString(), base, checks, exceptions: b.exceptions, exportedBytes: (await fs.stat(file)).size }, null, 2));
  console.log(JSON.stringify({ checks: checks.length, exceptions: b.exceptions.length, exportRestoreVerified: true }));
} catch (error) {
  await fs.writeFile(new URL('backups.json', out), JSON.stringify({ base, checks, error: String(error), exceptions: b.exceptions }, null, 2));
  console.error(error); process.exitCode = 1;
} finally { b.close(); }
