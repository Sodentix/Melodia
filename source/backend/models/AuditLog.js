const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: {
      type: String,
      required: true,
      enum: ['user.role_change', 'user.delete', 'user.restore', 'categories.update'],
    },
    targetType: { type: String, required: true },
    targetId: { type: String, required: false },
    details: { type: mongoose.Schema.Types.Mixed, required: false },
    ip: { type: String, required: false, trim: true, maxlength: 100 },
    userAgent: { type: String, required: false, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
