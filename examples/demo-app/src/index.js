const { getUserPosts, createUser } = require('./api');

async function main() {
  await getUserPosts(42);
  await createUser({ name: 'demo', email: 'demo@example.com' });
}

main();
