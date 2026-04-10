const mongoose = require('mongoose');

const savedFilterSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  filters: {
    search: String,
    type: { type: String },
    status: String,
    department: String,
    direction: String,
    deadlineBefore: String,
    createdFrom: String,
    createdTo: String,
    tags: [String],
    confidentiality: String
  }
}, { timestamps: true });

const SavedFilter = mongoose.model('SavedFilter', savedFilterSchema);
module.exports = SavedFilter;
