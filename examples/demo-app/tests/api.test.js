const test = require('node:test');
const assert = require('node:assert');

test('api module exports getUserPosts and createUser', () => {
  const api = require('../src/api');
  assert.equal(typeof api.getUserPosts, 'function');
  assert.equal(typeof api.createUser, 'function');
});
