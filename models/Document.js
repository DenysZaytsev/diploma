const mongoose = require('mongoose');

const fileVersionSchema = new mongoose.Schema({
  originalName: String,
  mimeType: String,
  size: Number,
  path: String,
  version: { type: Number, default: 1 },
  uploadedAt: { type: Date, default: Date.now },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

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
    type: String,
    required: true,
  },
  department: {
    type: String,
    required: true,
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
  files: [fileVersionSchema],
  // Feature 1: File Versioning — history of replaced files
  fileVersions: [{
    fileId: mongoose.Schema.Types.ObjectId,
    originalName: String,
    mimeType: String,
    size: Number,
    path: String,
    version: Number,
    uploadedAt: Date,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    replacedAt: { type: Date, default: Date.now }
  }],
  // Feature 3: Document Tags/Keywords
  tags: [{
    type: String,
    trim: true
  }],
  // Feature 6: Related Documents
  relatedDocuments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document'
  }],
  // Feature 7: Document Security Classification
  confidentiality: {
    type: String,
    enum: ['public', 'internal', 'confidential', 'secret'],
    default: 'internal'
  },
  // Full-text search content (Feature 14)
  textContent: {
    type: String,
    select: false
  },
  isDeleted: {
    type: Boolean,
    default: false,
  }
}, { timestamps: true });

// Indexes
documentSchema.index({ isDeleted: 1, status: 1 });
documentSchema.index({ creator: 1 });
documentSchema.index({ department: 1 });
documentSchema.index({ createdAt: -1 });
documentSchema.index({ dueDate: 1 });
documentSchema.index({ tags: 1 });
documentSchema.index({ confidentiality: 1 });
documentSchema.index({ textContent: 'text' });

const Document = mongoose.model('Document', documentSchema);
module.exports = Document;
