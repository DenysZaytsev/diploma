const mongoose = require('mongoose');

const delegationSchema = new mongoose.Schema({
  delegator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  delegate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  department: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['approver', 'signatory'],
    required: true
  },
  dateFrom: {
    type: Date,
    required: true
  },
  dateTo: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  reason: {
    type: String
  }
}, { timestamps: true });

delegationSchema.index({ delegate: 1, isActive: 1 });
delegationSchema.index({ delegator: 1 });
delegationSchema.index({ dateFrom: 1, dateTo: 1 });

const Delegation = mongoose.model('Delegation', delegationSchema);
module.exports = Delegation;
