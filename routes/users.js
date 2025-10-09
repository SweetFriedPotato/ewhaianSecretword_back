// routes/users.js (이메일 인증 로직 복구 완료)

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const pool = require('../db');

const router = express.Router();

// Nodemailer 설정 (Gmail용)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

// ## POST /api/users/register (회원가입) ##
router.post('/register', async (req, res) => {
  const { email, password, nickname, secretWord } = req.body;
  const client = await pool.connect();

  // 1. 입력값 검증
  if (!email || !password || !nickname || !secretWord) {
    return res.status(400).json({ message: '모든 필드를 입력해주세요.' });
  }
  if (!email.endsWith('@ewhain.net') && !email.endsWith('@ewha.ac.kr')) {
    return res.status(400).json({ message: '이화인 이메일로만 가입할 수 있습니다.' });
  }
  if (secretWord !== process.env.SECRET_WORD_FOR_REGISTER) {
    return res.status(400).json({ message: '비밀단어가 일치하지 않습니다.' });
  } 

  try {
    // 트랜잭션 시작
    await client.query('BEGIN');

    // 2. 이메일 또는 닉네임 중복 확인
    const existingUser = await client.query('SELECT * FROM users WHERE email = $1 OR nickname = $2', [email, nickname]);
    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: '이미 사용 중인 이메일 또는 닉네임입니다.' });
    }

    // 3. 비밀번호 암호화
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. [트랜잭션 작업 1] 사용자 정보 DB에 저장
    const newUser = await client.query(
      'INSERT INTO users (email, password, nickname) VALUES ($1, $2, $3) RETURNING id, email',
      [email, hashedPassword, nickname]
    );
    const userId = newUser.rows[0].id;

    // 5. [트랜잭션 작업 2] 이메일 인증 토큰 생성 및 메일 발송
    const verificationToken = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const verificationLink = `${process.env.SERVER_URL}/api/users/verify?token=${verificationToken}`;

    await transporter.sendMail({
      from: process.env.MAIL_USER,
      to: email,
      subject: '[이화이언] 비밀단어 퀴즈 이메일 인증',
      html: `<h3>가입을 완료하려면 아래 링크를 클릭하세요:</h3><a href="${verificationLink}">${verificationLink}</a>`,
    });

    // 모든 작업이 성공했으므로 트랜잭션을 최종 확정(저장)합니다.
    await client.query('COMMIT');
    
    res.status(201).json({ message: '가입 성공! 이메일을 확인하여 계정을 활성화해주세요.' });

  } catch (error) {
    // try 블록 안에서 뭐든 하나라도 실패하면 여기로 와서 모든 작업을 되돌립니다.
    await client.query('ROLLBACK');
    
    console.error('Register Error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
});

// ## GET /api/users/verify (이메일 인증) ##
router.get('/verify', async (req, res) => {
  try {
    const { token } = req.query;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    await pool.query('UPDATE users SET is_verified = TRUE WHERE id = $1', [decoded.userId]);
    
    // TODO: 인증 성공 시 프론트엔드의 특정 페이지로 리디렉션
    res.redirect(`${process.env.FRONTEND_URL}/login`);
  } catch (error) {
    res.status(400).send('<h1>유효하지 않거나 만료된 인증 링크입니다.</h1>');
  }
});

// ## POST /api/users/login (로그인) ##
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: '이메일과 비밀번호를 모두 입력해주세요.' });
    }
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];
        if (!user) {
            return res.status(401).json({ message: '이메일 또는 비밀번호가 일치하지 않습니다.' });
        }
        if (!user.is_verified) {
            return res.status(403).json({ message: '이메일 인증을 먼저 완료해주세요.' });
        }
        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if (!isPasswordMatch) {
            return res.status(401).json({ message: '이메일 또는 비밀번호가 일치하지 않습니다.' });
        }
        const token = jwt.sign(
            { id: user.id, nickname: user.nickname },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );
        res.status(200).json({ token });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// ## GET /api/users/me (현재 사용자 정보 조회) ##
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: '토큰이 필요합니다.' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await pool.query('SELECT id, email, nickname FROM users WHERE id = $1', [decoded.id]);
    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user info error:', error);
    res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
  }
});

// ## GET /api/users/records (사용자 퀴즈 기록 조회) ##
router.get('/records', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: '토큰이 필요합니다.' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 퀴즈 기록 조회 (최신순으로 정렬)
    const result = await pool.query(
      'SELECT id, score, duration, created_at FROM quiz_results WHERE user_id = $1 ORDER BY created_at DESC',
      [decoded.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get records error:', error);
    res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
  }
});

module.exports = router;