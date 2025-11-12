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
      maxlength: 12,
      match: /^[a-z0-9_.-]+$/,
      index: true,
    },
    userRole: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    usernameLower: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 12,
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
    stats: { type: mongoose.Schema.Types.ObjectId, ref: 'Stats', index: true },
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

userSchema.methods.ensureStats = async function () {
    const Stats = this.model('Stats');
    if (this.stats) return this.stats;
    const doc = await Stats.findOneAndUpdate(
        { user: this._id },
        { $setOnInsert: { user: this._id } },
        { new: true, upsert: true }
    );
    this.stats = doc._id;
    await this.save();
    return this.stats;
};

module.exports = mongoose.model('User', userSchema);


