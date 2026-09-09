// Streaming OOXML ZIP. Each file uses a ZIP data descriptor, keeping memory bounded.
const enc = new TextEncoder();
const escapeXml = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!)).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const crcTable = Uint32Array.from({ length: 256 }, (_, i) => { let c = i; for (let j = 0; j < 8; j++)
    c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0); return c >>> 0; });
function crcUpdate(crc: number, b: Uint8Array) { for (const n of b)
    crc = crcTable[(crc ^ n) & 255] ^ (crc >>> 8); return crc >>> 0; }
const column = (n: number) => { let r = ''; for (n++; n; n = Math.floor((n - 1) / 26))
    r = String.fromCharCode(65 + (n - 1) % 26) + r; return r; };
function xmlRow(values: unknown[], i: number) { return `<row r="${i}">${values.map((v, j) => typeof v === 'number' ? `<c r="${column(j)}${i}"><v>${v}</v></c>` : `<c r="${column(j)}${i}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(v)}</t></is></c>`).join('')}</row>`; }
const meta: Record<string, string> = {
    '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Отчёт" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'
};
export function streamWorkbook(rows: AsyncGenerator<unknown[]>): ReadableStream<Uint8Array> {
    async function* worksheet() { yield enc.encode('<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="15" width="22" customWidth="1"/></cols><sheetData>'); let index = 0, buffer = ''; for await (const row of rows) {
        buffer += xmlRow(row, ++index);
        if (buffer.length > 32768) {
            yield enc.encode(buffer);
            buffer = '';
        }
    } if (buffer)
        yield enc.encode(buffer); yield enc.encode('</sheetData></worksheet>'); }
    async function* zip() { let offset = 0; const central: Uint8Array[] = []; const sources: ([
        string,
        AsyncGenerator<Uint8Array>
    ])[] = Object.entries(meta).map(([name, xml]) => [name, (async function* () { yield enc.encode(xml); })()]); sources.push(['xl/worksheets/sheet1.xml', worksheet()]); for (const [name, source] of sources) {
        const start = offset, n = enc.encode(name), head = new Uint8Array(30 + n.length), v = new DataView(head.buffer);
        v.setUint32(0, 0x04034b50, true);
        v.setUint16(4, 20, true);
        v.setUint16(6, 8, true);
        v.setUint16(26, n.length, true);
        head.set(n, 30);
        yield head;
        offset += head.length;
        let crc = 0xffffffff, size = 0;
        for await (const chunk of source) {
            crc = crcUpdate(crc, chunk);
            size += chunk.length;
            offset += chunk.length;
            yield chunk;
        }
        crc = (crc ^ 0xffffffff) >>> 0;
        const descriptor = new Uint8Array(16), d = new DataView(descriptor.buffer);
        d.setUint32(0, 0x08074b50, true);
        d.setUint32(4, crc, true);
        d.setUint32(8, size, true);
        d.setUint32(12, size, true);
        yield descriptor;
        offset += 16;
        const c = new Uint8Array(46 + n.length), h = new DataView(c.buffer);
        h.setUint32(0, 0x02014b50, true);
        h.setUint16(4, 20, true);
        h.setUint16(6, 20, true);
        h.setUint16(8, 8, true);
        h.setUint32(16, crc, true);
        h.setUint32(20, size, true);
        h.setUint32(24, size, true);
        h.setUint16(28, n.length, true);
        h.setUint32(42, start, true);
        c.set(n, 46);
        central.push(c);
    } const centralStart = offset; for (const c of central) {
        yield c;
        offset += c.length;
    } const end = new Uint8Array(22), v = new DataView(end.buffer); v.setUint32(0, 0x06054b50, true); v.setUint16(8, central.length, true); v.setUint16(10, central.length, true); v.setUint32(12, offset - centralStart, true); v.setUint32(16, centralStart, true); yield end; }
    const generator = zip();
    return new ReadableStream({ async pull(controller) { try {
            const r = await generator.next();
            if (r.done)
                controller.close();
            else
                controller.enqueue(r.value);
        }
        catch (e) {
            controller.error(e);
        } }, async cancel() { await generator.return(undefined); } });
}
