const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
    id: String,
    tenant: String,
    tenantEmail: String,
    bookingId: String,
    propertyTitle: String,
    amount: Number,
    totalRent: Number,
    date: String,
    status: { type: String, enum: ['Pending', 'Resolved', 'Processing', 'Completed', 'Failed'], default: 'Pending' },
    paymentMethod: String,
    notes: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Payment', PaymentSchema);
