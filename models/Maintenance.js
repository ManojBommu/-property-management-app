const mongoose = require('mongoose');

const MaintenanceSchema = new mongoose.Schema({
    tenantName: String,
    tenantEmail: String,
    propertyId: String,
    propertyTitle: String,
    issue: String,
    description: String,
    issueImage: String,
    status: { type: String, enum: ['Pending', 'Processing', 'Completed'], default: 'Pending' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Maintenance', MaintenanceSchema);