const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reporter:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reportedUser:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reportedStore: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },

  type: {
    type: String,
    enum: ['abusive_message', 'fake_listing', 'no_show', 'other'],
    required: true
  },

  reason: { type: String, required: true, maxlength: 1000 },

  status: { type: String, enum: ['pending', 'dismissed', 'actioned'], default: 'pending' },
  action: { type: String, enum: ['none', 'warn', 'mute', 'remove'], default: 'none' },
  adminNote:  String,
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('Report', reportSchema);