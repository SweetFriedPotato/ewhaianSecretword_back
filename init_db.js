const pool = require('./db');

async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 기존 테이블 삭제
    await client.query('DROP TABLE IF EXISTS quiz_scores');
    await client.query('DROP TABLE IF EXISTS quiz_results');
    await client.query('DROP TABLE IF EXISTS users');

    // users 테이블 생성
    await client.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        nickname VARCHAR(100) UNIQUE NOT NULL,
        is_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log(' users 테이블 생성 완료');

    // quiz_results 테이블 생성 (duration 포함)
    await client.query(`
      CREATE TABLE quiz_results (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        score INTEGER NOT NULL,
        duration INTEGER DEFAULT 0,
        answers JSONB,
        submitted_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log(' quiz_results 테이블 생성 완료');

    // quiz_scores 테이블 생성
    await client.query(`
      CREATE TABLE quiz_scores (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        score INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('quiz_scores 테이블 생성 완료');

    await client.query('COMMIT');
    console.log(' 데이터베이스 초기화 완료!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

initDatabase();
