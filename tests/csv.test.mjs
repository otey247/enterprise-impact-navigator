import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, toBoolean, toNumber } from '../server/csv.mjs';

test('CSV parser handles quoted commas and escaped quotes', () => {
  const rows = parseCsv('id,name,note\n1,"Acme, Inc.","Says ""ready"""\n');
  assert.deepEqual(rows, [{ id: '1', name: 'Acme, Inc.', note: 'Says "ready"' }]);
});

test('coercion helpers support enterprise data shapes', () => {
  assert.equal(toNumber('$1,250.50'), 1250.5);
  assert.equal(toBoolean('Approved'), true);
  assert.equal(toBoolean('false'), false);
});
