const mongoose = require('mongoose');

const documentTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  code: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  description: {
    type: String,
  }
}, { timestamps: true });

const DocumentType = mongoose.model('DocumentType', documentTypeSchema);
module.exports = DocumentType;