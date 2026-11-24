import fs from 'node:fs/promises';
export async function connect(targetId=null) {
  const pages = await (await fetch((process.env.SUPPLY_CDP_URL??'http://127.0.0.1:9224')+'/json/list')).json();
  const target = pages.find(p => p.type === 'page' && (!targetId||p.id===targetId));
  const ws = new WebSocket(target.webSocketDebuggerUrl); const pending = new Map(); let id = 0;
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  const exceptions = [];
  ws.addEventListener('message', event => { const data = JSON.parse(event.data); if(data.method==='Page.javascriptDialogOpening'&&data.params.type==='beforeunload')ws.send(JSON.stringify({id:++id,method:'Page.handleJavaScriptDialog',params:{accept:true}})); if (data.method === 'Runtime.exceptionThrown') exceptions.push(data.params.exceptionDetails.text); if (!data.id) return; const request = pending.get(data.id); if (!request) return; pending.delete(data.id); if (data.error) request.reject(new Error(data.error.message)); else request.resolve(data.result); });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const messageId = ++id; pending.set(messageId, { resolve, reject }); ws.send(JSON.stringify({ id: messageId, method, params })); });
  const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? 'Evaluation failed'); return result.result.value; };
  const wait = async (expression, timeout = 8000) => { const start = Date.now(); while (Date.now() - start < timeout) { try { if (await evaluate(expression)) return; } catch {} await new Promise(r => setTimeout(r, 100)); } throw new Error('Timed out: ' + expression); };
  const go = async url => {
    await send('Page.navigate', {url:'about:blank'});
    await wait("location.href==='about:blank' && document.readyState==='complete'");
    const nav=await send('Page.navigate',{url});if(nav.errorText)throw Error(nav.errorText);
    await wait('location.origin+location.pathname+location.search==='+JSON.stringify(new URL(url).origin+new URL(url).pathname+new URL(url).search)+" && document.readyState==='complete' && !!document.querySelector('.app-shell')");
    await new Promise(r=>setTimeout(r,100));
  };
  const click = text => evaluate(`(() => { const scope=document.querySelector('dialog[open]')??document; const b=[...scope.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(text)} && !x.disabled); if(!b)throw Error('Button missing'); b.click(); })()`);
  const value = (selector, value) => evaluate(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); const proto=el.tagName==='SELECT'?HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)}); el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true})); })()`);
  const screenshot = async path => { await evaluate('document.fonts.ready'); const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); await fs.writeFile(path, Buffer.from(result.data, 'base64')); };
  await send('Page.enable'); await send('Runtime.enable');
  return { send, evaluate, wait, go, click, value, screenshot, exceptions, close: () => ws.close() };
}
