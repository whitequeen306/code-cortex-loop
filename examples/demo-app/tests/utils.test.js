const test = require('node:test');
const assert = require('node:assert');
const { legacyFormatter, processOrder } = require('../src/utils');

test('legacyFormatter uppercases string values', () => {
  assert.equal(legacyFormatter('hello'), 'HELLO');
});

test('processOrder sums in-stock line items', () => {
  const order = { items: [{ sku: 'a', qty: 2, price: 10 }] };
  const inventory = { a: { qty: 5 } };
  const total = processOrder(order, null, inventory, null, null, null);
  assert.equal(total, 20);
});

test('processOrder applies premium discount', () => {
  const order = { items: [{ sku: 'a', qty: 1, price: 100 }] };
  const inventory = { a: { qty: 1 } };
  const total = processOrder(order, { premium: true }, inventory, null, null, null);
  assert.equal(total, 90);
});
