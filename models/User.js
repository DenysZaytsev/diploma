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
  pendingEmail: {
    type: String,
  },
  emailConfirmationToken: {
    type: String,
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
  },
  avatar: {
    type: String,
  },
  notifications: {
    // Типи сповіщень
    onStatusChange: { type: Boolean, default: true }, // Зміна статусу власного чи погодженого документа
    onNewTask: { type: Boolean, default: true },      // Нове завдання (передано на погодження / на підпис)
    onAdminAlerts: { type: Boolean, default: true },  // Системні сповіщення (для адміна)
    onUserEvents: { type: Boolean, default: true }    // Дії з користувачами (для адміна)
  }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
module.exports = User;
