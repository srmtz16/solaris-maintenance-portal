import test from 'node:test';
import assert from 'node:assert/strict';
import { documentAccessInput, documentStoragePath, isPortalDocumentUrl } from '../lib/document-access.ts';
test('document access rejects malformed IDs and bearer tokens', () => {
 for(const id of ['0','-1','1/../2','1?token=abc','1e3','']) assert.equal(documentAccessInput(id,null),null);
 assert.equal(documentAccessInput('12','invalid'),null);
 assert.deepEqual(documentAccessInput('12',null),{p_document_id:'12',p_public_token:null});
});
test('document signing is constrained to one bucket and validated paths', () => {
 for(const path of ['/file','a/../file','a/./file','a//file','a\\file','a?b','a#b','']) assert.equal(documentStoragePath({bucket:'system-documents',path}),null);
 assert.equal(documentStoragePath({bucket:'service-evidence',path:'report.pdf'}),null);
 assert.equal(documentStoragePath({bucket:'system-documents',path:'FV-0001/reports/example.pdf'}),'FV-0001/reports/example.pdf');
});
test('only exact internal document routes are accepted as relative links', () => {
 assert.equal(isPortalDocumentUrl('/api/documents/12'),true);
 assert.equal(isPortalDocumentUrl('/api/documents/12?token=00000000-0000-4000-8000-000000000000'),true);
 for(const url of ['//evil.test','/api/documents/12/../admin','javascript:alert(1)','/api/documents/12?redirect=https://evil.test']) assert.equal(isPortalDocumentUrl(url),false);
});
