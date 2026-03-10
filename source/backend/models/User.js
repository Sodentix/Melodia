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
      select: false,
    },
    salt: {
      type: String,
      required: true,
      select: false,
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
      select: false,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      required: false,
      select: false,
    },
    emailVerificationExpires: {
      type: Date,
      required: false,
      select: false,
    },
    passwordResetToken: {
      type: String,
      required: false,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      required: false,
      select: false,
    },
    pendingEmail: {
      type: String,
      required: false,
      lowercase: true,
      trim: true,
    },
    pendingEmailToken: {
      type: String,
      required: false,
      select: false,
    },
    pendingEmailExpires: {
      type: Date,
      required: false,
      select: false,
    },
    avatarUrl: {
      type: String,
      required: false,
      trim: true,
    },
    loginDevices: {
      type: [
        {
          ip: { type: String, trim: true, maxlength: 100 },
          userAgent: { type: String, trim: true, maxlength: 500 },
          countryCode: { type: String, uppercase: true, trim: true, maxlength: 3 },
          lastAttemptAt: { type: Date, default: Date.now },
          lastSuccessAt: { type: Date },
          lastStatus: { type: String, trim: true, maxlength: 60 },
          attemptCount: { type: Number, default: 1, min: 1 },
          blocked: { type: Boolean, default: false },
        },
      ],
      default: [],
      select: false,
    },
    stats: { type: mongoose.Schema.Types.ObjectId, ref: 'Stats', index: true },
    settings: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        theme: 'dark',
        language: 'de',
        soundEnabled: true,
        musicVolume: 80,
        sfxVolume: 80,
        notifications: true,
        showStatsOnHome: true,
        reducedMotion: false,
      }),
    },
    deletedAt: {
      type: Date,
      required: false,
      default: null,
      index: true,
    },
    deletedEmail: {
      type: String,
      required: false,
      lowercase: true,
      trim: true,
    },
    deletedUsername: {
      type: String,
      required: false,
      trim: true,
    },
  },
  { timestamps: true }
);

/** Filter to exclude soft-deleted users. Use with find/findOne. */
userSchema.statics.notDeletedFilter = function () {
  return { $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] };
};

/** Find users excluding soft-deleted. Merges conditions with notDeletedFilter. */
userSchema.statics.findNotDeleted = function (conditions = {}) {
  const notDeleted = this.notDeletedFilter();
  const cond = Object.keys(conditions).length === 0 ? notDeleted : { $and: [conditions, notDeleted] };
  return this.find(cond);
};

/** Find one user excluding soft-deleted. */
userSchema.statics.findOneNotDeleted = function (conditions) {
  const notDeleted = this.notDeletedFilter();
  return this.findOne({ $and: [conditions, notDeleted] });
};

/** Find by id excluding soft-deleted. */
userSchema.statics.findByIdNotDeleted = function (id) {
  return this.findOneNotDeleted({ _id: id });
};

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


