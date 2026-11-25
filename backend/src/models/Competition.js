const mongoose = require('mongoose');

const competitionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please enter a competition name.'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Please enter the competition rules.']
  },
  banner: {
    type: String,
    default: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4'
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: {
    type: String,
    enum: ['upcoming', 'active', 'ended'],
    default: 'active'
  },
  reward: {
    type: String,
    default: 'Recognition Badge + 500 Contribution Points'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

module.exports = mongoose.model('Competition', competitionSchema);