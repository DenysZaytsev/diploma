const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  regNumber: {
    type: String,
    unique: true,
  },
  direction: {
    type: String,
    enum: ['incoming', 'outgoing', 'internal'],
    required: true,
  },
  type: {
    type: String, // 'contract' | 'act' | 'invoice' | 'declaration' (може бути динамічним)
    required: true,
  },
  department: {
    type: String,
    required: true, // Документ завжди належить відділу ініціатора
  },
  counterparty: {
    type: String,
  },
  dueDate: {
    type: Date,
  },
  status: {
    type: String,
    enum: ['draft', 'on_approval', 'on_signing', 'signed', 'rejected', 'archived'],
    default: 'draft',
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  approver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  signatory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  files: [{
    originalName: String,
    mimeType: String,
    size: Number,
    path: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  isDeleted: {
    type: Boolean,
    default: false,
  }
}, { timestamps: true });

const Document = mongoose.model('Document', documentSchema);
module.exports = Document;
