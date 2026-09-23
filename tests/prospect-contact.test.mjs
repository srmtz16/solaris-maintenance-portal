import test from 'node:test';
import assert from 'node:assert/strict';
import { contactTopic, whatsappUrl, SOLARIS_WHATSAPP } from '../lib/prospect-contact.ts';

test('orientation and procedures do not request panel counts', () => {
  for (const topic of ['Orientación', 'Gestoría', 'Pasaporte Solar']) {
    const message = new URL(whatsappUrl(SOLARIS_WHATSAPP, topic)).searchParams.get('text');
    assert.ok(message.startsWith('Hola,'));
    assert.ok(!message.includes('Número aproximado de paneles'));
  }
});
test('maintenance contact preserves details and encodes special characters', () => {
  const data = new FormData();
  for (const [key, value] of Object.entries({name:'María & José',phone:'7778311043',zone:'Mérida',panels:'12',failure:'No',installation:'Comercial',comments:'Acceso por escalera + azotea'})) data.set(key, value);
  const url = new URL(whatsappUrl('+52 777 831 1043', 'Mantenimiento', data));
  assert.equal(url.pathname, '/527778311043');
  const message = url.searchParams.get('text');
  assert.match(message, /Número aproximado de paneles: 12/);
  assert.match(message, /Nombre: María & José/);
  assert.match(message, /Zona: Mérida/);
  assert.match(message, /Tipo de instalación: Comercial/);
  assert.match(message, /Acceso por escalera \+ azotea/);
});
test('unrecognized or repeated service parameters fall back to orientation', () => {
  assert.equal(contactTopic('Gestoría'), 'Gestoría');
  for (const value of [undefined, '', 'unknown', ['Mantenimiento', 'Gestoría']]) assert.equal(contactTopic(value), 'Orientación');
});
