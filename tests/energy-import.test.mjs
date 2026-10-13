import test from 'node:test';
import assert from 'node:assert/strict';
import {smappeeFileSource} from '../lib/energy-import.ts';
import {zipSync,strToU8} from 'fflate';
test('CSV handles quoted headers, CRLF, zero and provenance checksum',async()=>{const bytes=Buffer.from('"Date",Consumption,Production,Import,Export\r\n2026-10-01 00:00:00,0,0,0,0\r\n');const a=await smappeeFileSource.read(bytes,'a.csv','text/csv');const b=await smappeeFileSource.read(bytes,'b.csv','text/plain');assert.equal(a.rows.length,1);assert.equal(a.headers[0],'Date');assert.equal(a.rows[0][1],'0');assert.equal(a.checksum,b.checksum);});
test('wrong MIME, oversized, malformed CSV and duplicate headings fail',async()=>{await assert.rejects(()=>smappeeFileSource.read(Buffer.from('a,b\n1,2'),'a.csv','image/png'));await assert.rejects(()=>smappeeFileSource.read(new Uint8Array(1500001),'a.xlsx',''));await assert.rejects(()=>smappeeFileSource.read(Buffer.from('a,a\n1,2'),'a.csv',''));await assert.rejects(()=>smappeeFileSource.read(Buffer.from('a,b\n"unterminated'),'a.csv',''));});
test('XLSX decompression limits reject small compressed bombs before workbook parsing',async()=>{const bytes=zipSync({'xl/worksheets/sheet1.xml':strToU8('a'.repeat(12000001))});await assert.rejects(()=>smappeeFileSource.read(bytes,'a.xlsx',''),/demasiado grande/);});
