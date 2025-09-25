//회원가입, 로그인 등 사용자 관련 API
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const pool = require('../db'); // DB 연결을 위해 pool 가져오기 (db.js 파일 생성 필요)

const router = express.Router();

// Nodemailer 설정
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

// POST /api/users/register (회원가입)
router.post('/register', async (req, res) => {
  const { email, password, nickname, secretWord } = req.body;

  // 1. 입력값 검증
  if (!email || !password || !nickname || !secretWord) {
    return res.status(400).json({ message: '모든 필드를 입력해주세요.' });
  }
  if (!email.endsWith('@ewhain.net') && !email.endsWith('@ewha.ac.kr')) {
    return res.status(400).json({ message: '이화인 이메일로만 가입할 수 있습니다.' });
  }
  if (secretWord !== '이화이언TF화이팅') { // 실제 비밀단어로 변경
    return res.status(400).json({ message: '비밀단어가 일치하지 않습니다.' });
  }

  try {
    // 2. 이메일/닉네임 중복 확인
    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1 OR nickname = $2', [email, nickname]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: '이미 사용 중인 이메일 또는 닉네임입니다.' });
    }

    // 3. 비밀번호 암호화
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. 사용자 정보 DB에 저장
    const newUser = await pool.query(
      'INSERT INTO users (email, password, nickname) VALUES ($1, $2, $3) RETURNING id, email',
      [email, hashedPassword, nickname]
    );

    // 5. 이메일 인증 토큰 생성 및 메일 발송
    const verificationToken = jwt.sign({ userId: newUser.rows[0].id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const verificationLink = `http://localhost:3001/api/users/verify?token=${verificationToken}`; // 프론트엔드 주소로 변경 필요
    
    await transporter.sendMail({
      from: process.env.MAIL_USER,
      to: email,
      subject: '[이화이언] 비밀단어 퀴즈 이메일 인증',
      html: `<h3>가입을 완료하려면 아래 링크를 클릭하세요:</h3><a href="${verificationLink}">${verificationLink}</a>`,
    });

    res.status(201).json({ message: '가입 성공! 이메일을 확인하여 계정을 활성화해주세요.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// GET /api/users/verify (이메일 인증)
router.get('/verify', async (req, res) => {
  try {
    const { token } = req.query;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    await pool.query('UPDATE users SET is_verified = TRUE WHERE id = $1', [decoded.userId]);
    // TODO: 인증 성공 페이지로 리디렉션
    res.send('이메일 인증이 완료되었습니다! 로그인해주세요.');
  } catch (error) {
    res.status(400).send('유효하지 않은 인증 링크입니다.');
  }
});

// POST /api/users/login (로그인)
router.post('/login', async (req, res) => {
  // ... 로그인 로직 구현 (이메일로 사용자 찾기, 비밀번호 비교, JWT 발급)
});

module.exports = router;