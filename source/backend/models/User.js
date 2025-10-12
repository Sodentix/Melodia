const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 30,
      match: /^[a-z0-9_.-]+$/,
      index: true,
    },
    usernameLower: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      match: /^[a-z0-9_.-]+$/,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    salt: {
      type: String,
      required: true,
    },
    passwordHistory: {
      type: [
        {
          passwordHash: { type: String, required: true },
          salt: { type: String, required: true },
          changedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      required: false,
    },
    emailVerificationExpires: {
      type: Date,
      required: false,
    },
  },
  { timestamps: true }
);

userSchema.pre('validate', function ensureUsernameLower(next) {
  if (typeof this.username === 'string' && this.username.trim()) {
    const normalized = this.username.trim().toLowerCase();
    this.username = normalized;
    this.usernameLower = normalized;
  }
  next();
});

module.exports = mongoose.model('User', userSchema);


