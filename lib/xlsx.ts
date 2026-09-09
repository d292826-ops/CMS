// Minimal OOXML workbook with numeric cells; ZIP uses STORE for dependency-free Worker support.
const esc = (v: any) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!)).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const encoder = new TextEncoder();
function crc32(b: Uint8Array) { let crc = 0xffffffff; for (const n of b) {
    crc ^= n;
    for (let k = 0; k < 8; k++)
        crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
} return (crc ^ 0xffffffff) >>> 0; }
function zip(files: Record<string, string>) { let offset = 0; const chunks: Uint8Array[] = [], central: Uint8Array[] = []; for (const [name, content] of Object.entries(files)) {
    const n = encoder.encode(name), data = encoder.encode(content), crc = crc32(data);
    const head = new Uint8Array(30 + n.length), h = new DataView(head.buffer);
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true);
    h.setUint32(14, crc, true);
    h.setUint32(18, data.length, true);
    h.setUint32(22, data.length, true);
    h.setUint16(26, n.length, true);
    head.set(n, 30);
    chunks.push(head, data);
    const c = new Uint8Array(46 + n.length), v = new DataView(c.buffer);
    v.setUint32(0, 0x02014b50, true);
    v.setUint16(4, 20, true);
    v.setUint16(6, 20, true);
    v.setUint32(16, crc, true);
    v.setUint32(20, data.length, true);
    v.setUint32(24, data.length, true);
    v.setUint16(28, n.length, true);
    v.setUint32(42, offset, true);
    c.set(n, 46);
    central.push(c);
    offset += head.length + data.length;
} const size = central.reduce((s, c) => s + c.length, 0), end = new Uint8Array(22), v = new DataView(end.buffer); v.setUint32(0, 0x06054b50, true); v.setUint16(8, central.length, true); v.setUint16(10, central.length, true); v.setUint32(12, size, true); v.setUint32(16, offset, true); const out = new Uint8Array(offset + size + 22); let pos = 0; for (const chunk of [...chunks, ...central, end]) {
    out.set(chunk, pos);
    pos += chunk.length;
} return out; }
export function workbook(rows: any[][], name = 'Отчёт') { const col = (n: number) => { let r = ''; for (n++; n; n = Math.floor((n - 1) / 26))
    r = String.fromCharCode(65 + (n - 1) % 26) + r; return r; }; const data = rows.map((row, i) => `<row r="${i + 1}">${row.map((v, j) => typeof v === 'number' ? `<c r="${col(j)}${i + 1}"><v>${v}</v></c>` : `<c r="${col(j)}${i + 1}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`).join('')}</row>`).join(''); return zip({ '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>', '_rels/.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>', 'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${esc(name)}" sheetId="1" r:id="rId1"/></sheets></workbook>`, 'xl/_rels/workbook.xml.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>', 'xl/worksheets/sheet1.xml': `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="15" width="22" customWidth="1"/></cols><sheetData>${data}</sheetData></worksheet>` }); }
