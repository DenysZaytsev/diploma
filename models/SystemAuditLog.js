const mongoose = require('mongoose');

const systemAuditLogSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  adminName: {
    type: String,
    required: true,
  },
  adminEmail: {
    type: String,
    required: true,
  },
  action: {
    type: String,
    required: true,
  },
  targetEmail: {
    type: String,
  },
  details: {
    type: String,
  },
}, { timestamps: true });

const SystemAuditLog = mongoose.model('SystemAuditLog', systemAuditLogSchema);
module.exports = SystemAuditLog;