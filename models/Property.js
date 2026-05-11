const mongoose = require('mongoose');

const PropertySchema = new mongoose.Schema({
    title: String, 
    rent: Number, 
    type: String,
    available: { type: Boolean, default: true },
    image: String,
    amenities: { type: [String], default: [] },
    facilities: { type: [String], default: [] }
});

module.exports = mongoose.model('Property', PropertySchema);
