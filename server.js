const express = require('express');
const path = require('path');
const mongoose = require('mongoose');

const Property = require('./models/Property');
const Payment = require('./models/Payment');
const Booking = require('./models/Booking');
const Maintenance = require('./models/Maintenance');
const User = require('./models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_propmanage';

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) return res.status(403).json({ error: 'Invalid token' });
            req.user = user;
            next();
        });
    } else {
        res.status(401).json({ error: 'Token missing' });
    }
};

const adminMiddleware = (req, res, next) => {
    if (req.user && req.user.role === 'Admin') {
        next();
    } else {
        res.status(403).json({ error: 'Admin access required' });
    }
};

const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// MongoDB Connection
mongoose.connect('mongodb://127.0.0.1:27017/propmanage')
  .then(() => console.log('Connected to MongoDB successfully!'))
  .catch(err => console.error('MongoDB connection error. Starting without DB.', err.message));

// Empty Fallbacks (Per User Request)
let memoryProperties = [];
let memoryPayments = [];
let memoryBookings = [];
let memoryMaintenance = [];
let registeredTenants = [];

// API Endpoints
app.get('/api/properties', async (req, res) => {
    try {
        if(mongoose.connection.readyState === 1) {
            const props = await Property.find();
            res.json(props);
        } else {
            res.json(memoryProperties);
        }
    } catch (e) {
        res.json(memoryProperties);
    }
});

app.post('/api/properties', async (req, res) => {
    try {
        if(mongoose.connection.readyState === 1) {
            const newProp = new Property(req.body);
            await newProp.save();
            res.status(201).json(newProp);
        } else {
            const newProp = { _id: Date.now().toString(), ...req.body };
            memoryProperties.push(newProp);
            res.status(201).json(newProp);
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Update Property Status
app.put('/api/properties/:id', async (req, res) => {
    try {
        if(mongoose.connection.readyState === 1) {
            const updated = await Property.findByIdAndUpdate(req.params.id, { available: req.body.available }, { new: true });
            res.json(updated);
        } else {
            const prop = memoryProperties.find(p => p._id == req.params.id);
            if(prop) prop.available = req.body.available;
            res.json(prop);
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Delete Property
app.delete('/api/properties/:id', async (req, res) => {
    try {
        if(mongoose.connection.readyState === 1) {
            await Property.findByIdAndDelete(req.params.id);
            res.status(204).send();
        } else {
            const index = memoryProperties.findIndex(p => p._id == req.params.id);
            if(index !== -1) memoryProperties.splice(index, 1);
            res.status(204).send();
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/payments', async (req, res) => {
    try {
        if(mongoose.connection.readyState === 1) {
            const payments = await Payment.find();
            res.json(payments);
        } else {
            res.json(memoryPayments);
        }
    } catch (e) {
        res.json(memoryPayments);
    }
});

app.post('/api/payments', async (req, res) => {
    try {
        if(mongoose.connection.readyState === 1) {
            const newPay = new Payment(req.body);
            await newPay.save();
            res.status(201).json(newPay);
        } else {
            const newPay = { _id: Date.now().toString(), ...req.body };
            memoryPayments.push(newPay);
            res.status(201).json(newPay);
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Booking Endpoints
app.get('/api/bookings', async (req, res) => {
    try {
        if(mongoose.connection.readyState === 1) {
            const bookings = await Booking.find();
            res.json(bookings);
        } else {
            res.json(memoryBookings);
        }
    } catch (e) {
        res.json(memoryBookings);
    }
});

app.post('/api/bookings', async (req, res) => {
    try {
        if(mongoose.connection.readyState === 1) {
            const newBooking = new Booking(req.body);
            await newBooking.save();
            res.status(201).json(newBooking);
        } else {
            const newBooking = { _id: Date.now().toString(), ...req.body };
            memoryBookings.push(newBooking);
            res.status(201).json(newBooking);
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/bookings/:id', async (req, res) => {
    try {
        if(mongoose.connection.readyState === 1) {
            const updateData = {};
            if (req.body.status) updateData.status = req.body.status;
            if (req.body.paymentStatus) updateData.paymentStatus = req.body.paymentStatus;
            if (Object.keys(updateData).length === 0) {
                updateData.status = req.body.status || 'Pending';
            }
            const updated = await Booking.findByIdAndUpdate(req.params.id, updateData, { new: true });
            res.json(updated);
        } else {
            const booking = memoryBookings.find(b => b._id == req.params.id);
            if(booking) {
                if (req.body.status) booking.status = req.body.status;
                if (req.body.paymentStatus) booking.paymentStatus = req.body.paymentStatus;
            }
            res.json(booking);
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/bookings/:id', async (req, res) => {
    try {
        if(mongoose.connection.readyState === 1) {
            await Booking.findByIdAndDelete(req.params.id);
            res.status(204).send();
        } else {
            const index = memoryBookings.findIndex(b => b._id == req.params.id);
            if(index !== -1) memoryBookings.splice(index, 1);
            res.status(204).send();
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, name, role } = req.body;
        
        if(mongoose.connection.readyState !== 1) {
             return res.status(500).json({ error: 'Database not connected.' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ error: 'User already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);
        
        const userCount = await User.countDocuments();
        let isApproved = false;
        let finalRole = role;
        
        if (userCount === 0) {
            isApproved = true;
            finalRole = 'Admin';
        }

        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            role: finalRole,
            isApproved
        });

        await newUser.save();

        if (!isApproved) {
            return res.json({ message: 'Registration successful! Please wait for an Admin to approve your account.' });
        } else {
            return res.json({ message: 'Registration successful! You are the first user and have been granted Admin access automatically.' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password, role } = req.body;

        if(mongoose.connection.readyState !== 1) {
             return res.status(500).json({ error: 'Database not connected.' });
        }

        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ error: 'Invalid email or password' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: 'Invalid email or password' });

        if (!user.isApproved) {
             return res.status(403).json({ error: 'Your account is pending Admin approval.' });
        }
        
        if (role && user.role !== role) {
             return res.status(403).json({ error: `Role mismatch. Expected ${role} but got ${user.role}.` });
        }

        const token = jwt.sign({ id: user._id, role: user.role, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '1d' });
        
        res.json({ token, user: { name: user.name, role: user.role, email: user.email }, message: 'Login successful!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/users/pending', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const pendingUsers = await User.find({ isApproved: false }).select('-password');
        res.json(pendingUsers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/users/approve/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.id, { isApproved: true }, { new: true }).select('-password');
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Maintenance Endpoints
app.get('/api/maintenance', async (req, res) => {
    try {
        let items = [];
        if(mongoose.connection.readyState === 1) {
            items = await Maintenance.find();
        } else {
            items = memoryMaintenance;
        }
        
        // Simple role-based filtering using query params
        const role = req.query.role;
        const tenantName = req.query.tenantName;
        
        if (role === 'tenant' && tenantName) {
            items = items.filter(m => m.tenantName === tenantName);
        }
        
        res.json(items);
    } catch (e) {
        res.json(memoryMaintenance);
    }
});

app.post('/api/maintenance', async (req, res) => {
    try {
        if(mongoose.connection.readyState === 1) {
            const newMaint = new Maintenance(req.body);
            await newMaint.save();
            res.status(201).json(newMaint);
        } else {
            const newMaint = { _id: Date.now().toString(), createdAt: new Date().toISOString(), ...req.body };
            if (!newMaint.status) newMaint.status = 'Pending';
            memoryMaintenance.push(newMaint);
            res.status(201).json(newMaint);
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/maintenance/:id', async (req, res) => {
    try {
        if(mongoose.connection.readyState === 1) {
            const updated = await Maintenance.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
            res.json(updated);
        } else {
            const maint = memoryMaintenance.find(m => m._id == req.params.id);
            if(maint) maint.status = req.body.status;
            res.json(maint);
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Update Payment Status
app.put('/api/payments/:id', async (req, res) => {
    try {
        if(mongoose.connection.readyState === 1) {
            const updated = await Payment.findByIdAndUpdate(req.params.id, { status: req.body.status, updatedAt: new Date() }, { new: true });
            res.json(updated);
        } else {
            const payment = memoryPayments.find(p => p._id == req.params.id);
            if(payment) payment.status = req.body.status;
            res.json(payment);
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Delete Payment
app.delete('/api/payments/:id', async (req, res) => {
    try {
        if(mongoose.connection.readyState === 1) {
            await Payment.findByIdAndDelete(req.params.id);
            res.status(204).send();
        } else {
            const index = memoryPayments.findIndex(p => p._id == req.params.id);
            if(index !== -1) memoryPayments.splice(index, 1);
            res.status(204).send();
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
