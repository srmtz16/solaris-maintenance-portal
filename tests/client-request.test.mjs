import test from 'node:test';
import assert from 'node:assert/strict';
import { validateClientRequest } from '../lib/client-request.ts';

const token = '123e4567-e89b-42d3-a456-426614174000';
const form = { portalKey: token, requestType: 'maintenance', message: 'Solicito mantenimiento', preferredDate: '' };

test('maps the QR token and request to exact RPC parameters', () => {
  assert.deepEqual(validateClientRequest(form), { payload: {
    p_public_token: token, p_request_type: 'maintenance', p_message: 'Solicito mantenimiento', p_preferred_date: null,
  } });
});
test('maps a failure without collecting personal data', () => {
  assert.deepEqual(Object.keys(validateClientRequest({ ...form, requestType: 'failure' }).payload).sort(), ['p_message','p_preferred_date','p_public_token','p_request_type']);
});
for (const [label, input] of [
  ['null', null], ['array', []], ['wrong field type', { ...form, message: {} }],
  ['sequential public id', { ...form, portalKey: 'FV-0001' }],
  ['invalid request type', { ...form, requestType: 'completed' }],
  ['too long message', { ...form, message: 'x'.repeat(1501) }],
  ['invalid calendar day', { ...form, preferredDate: '2027-02-30' }],
  ['date on failure', { ...form, requestType: 'failure', preferredDate: '2027-08-01' }],
  ['honeypot', { ...form, website: 'spam' }],
]) test(`rejects ${label}`, () => assert.ok('error' in validateClientRequest(input)));
test('accepts a valid preferred date', () => {
  assert.equal(validateClientRequest({ ...form, preferredDate: '2027-08-01' }).payload.p_preferred_date, '2027-08-01');
});
