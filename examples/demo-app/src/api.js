const db = require('./db');

async function getUserPosts(userId) {
  const posts = await db.query(`SELECT * FROM posts WHERE user_id = ${userId}`);
  // N+1: fetch author for each post
  for (const post of posts) {
    post.author = await db.query(`SELECT * FROM users WHERE id = ${post.author_id}`);
  }
  return posts;
}

async function createUser(body) {
  try {
    return await db.query(`INSERT INTO users SET name='${body.name}', email='${body.email}'`);
  } catch (err) {
    // silent failure demo
  }
}

module.exports = { getUserPosts, createUser };
