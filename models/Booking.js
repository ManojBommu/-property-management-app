const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
    propertyId: String,
    propertyTitle: String,
    tenantName: String,
    tenantEmail: String,
    tenantPhone: String,
    leaseStartDate: String,
    leaseEndDate: String,
    rentAmount: Number,
    paidAmount: Number,
    pendingAmount: Number,
    moveInDate: String,
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    paymentStatus: { type: String, enum: ['Pending', 'Resolved'], default: 'Pending' },
    bookingNotes: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Booking', BookingSchema);
