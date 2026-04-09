const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  maxUploadFiles: {
    type: Number,
    default: 10,
    max: 30,
    min: 1
  },
  smtpHost: { type: String },
  smtpPort: { type: Number },
  smtpUser: { type: String },
  smtpPass: { type: String },
  smtpFrom: { type: String }
}, { timestamps: true });

const Settings = mongoose.model('Settings', settingsSchema);
module.exports = Settings;