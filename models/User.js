const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['admin', 'approver', 'signatory', 'employee'],
    default: 'employee',
  },
  fullName: {
    type: String,
    required: true,
  },
  department: {
    type: String,
  },
  isBlocked: {
    type: Boolean,
    default: false,
  },
  isSuperAdmin: {
    type: Boolean,
    default: false,
  }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
module.exports = User;
