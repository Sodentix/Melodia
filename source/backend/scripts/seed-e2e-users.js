/**
 * Seed E2E test users: admin@test.local (admin) and user@test.local (user).
 * Run: node scripts/seed-e2e-users.js
 * Set E2E_ADMIN_PASSWORD and E2E_USER_PASSWORD or use default TestPass12!@
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

dotenv.config();

const ADMIN_EMAIL = 'admin@test.local';
const ADMIN_USERNAME = 'e2eadmin';
const USER_EMAIL = 'user@test.local';
const USER_USERNAME = 'e2euser';
const DEFAULT_PASSWORD = 'TestPass12!@';

async function hashPassword(password, salt) {
  const saltedPassword = password + salt;
  return bcrypt.hash(saltedPassword, 12);
}

async function ensureUser(email, username, userRole, password) {
  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`User ${email} already exists, skipping.`);
    return;
  }
  const salt = crypto.randomBytes(32).toString('hex');
  const passwordHash = await hashPassword(password, salt);
  await User.create({
    firstName: 'E2E',
    lastName: userRole === 'admin' ? 'Admin' : 'User',
    username,
    usernameLower: username,
    email,
    passwordHash,
    salt,
    emailVerified: true,
    userRole,
  });
  console.log(`Created ${userRole}: ${email}`);
}

async function main() {
  const adminPassword = process.env.E2E_ADMIN_PASSWORD || DEFAULT_PASSWORD;
  const userPassword = process.env.E2E_USER_PASSWORD || DEFAULT_PASSWORD;

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/melodia');
  try {
    await ensureUser(ADMIN_EMAIL, ADMIN_USERNAME, 'admin', adminPassword);
    await ensureUser(USER_EMAIL, USER_USERNAME, 'user', userPassword);
    console.log('E2E users ready. Default: admin@test.local / user@test.local with TestPass12!@');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
