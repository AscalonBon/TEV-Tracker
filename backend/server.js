const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

dotenv.config();

const app = express();
const requestedPort = Number(process.env.PORT) || 5000;
const preferredPorts = [requestedPort, requestedPort + 1, 5001, 5002, 5003];
const allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'http://127.0.0.1:3000'];
const JWT_SECRET = process.env.JWT_SECRET || 'tevtracker-dev-secret';

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json());

const tripSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    destination: { type: String, required: true },
    departureTime: { type: String, required: true },
    arrivalTime: { type: String, required: true },
    meansOfTransportation: { type: String, required: true },
    transportationCost: { type: Number, required: true },
  },
  { timestamps: true }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'client'], default: 'client' },
  },
  { timestamps: true }
);

const Trip = mongoose.model('Trip', tripSchema);
const User = mongoose.model('User', userSchema);
const DEFAULT_ADMIN_EMAIL = 'admin@tevtracker.com';
const DEFAULT_ADMIN_PASSWORD = 'Admin123!';

const generateToken = (user) => jwt.sign(
  { id: user._id, email: user.email, role: user.role },
  JWT_SECRET,
  { expiresIn: '7d' }
);

const seedAdminUser = async () => {
  try {
    const existingAdmin = await User.findOne({ email: DEFAULT_ADMIN_EMAIL.toLowerCase() });

    if (existingAdmin) {
      console.log(`Admin account ready: ${DEFAULT_ADMIN_EMAIL}`);
      return;
    }

    const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
    await User.create({
      name: 'System Administrator',
      email: DEFAULT_ADMIN_EMAIL.toLowerCase(),
      password: hashedPassword,
      role: 'admin',
    });

    console.log(`Seeded admin account created: ${DEFAULT_ADMIN_EMAIL} / ${DEFAULT_ADMIN_PASSWORD}`);
  } catch (error) {
    console.error('Failed to seed admin account:', error.message);
  }
};

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.id).select('-password');

    if (!user) {
      return res.status(401).json({ message: 'User not found.' });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'TEV Tracker API is running.' });
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    const normalizedRole = role === 'admin' ? 'admin' : 'client';
    const emailExists = await User.findOne({ email: email.toLowerCase() });

    if (emailExists) {
      return res.status(409).json({ message: 'An account with that email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: normalizedRole,
    });

    const token = generateToken(user);

    return res.status(201).json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create account.', error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = generateToken(user);

    return res.status(200).json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to sign in.', error: error.message });
  }
});

app.get('/api/auth/me', authenticate, async (req, res) => {
  return res.status(200).json({
    _id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
  });
});

app.use('/api/trips', authenticate);

app.get('/api/trips', async (req, res) => {
  try {
    const trips = await Trip.find().sort({ createdAt: -1 });
    res.status(200).json(trips);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch itinerary records.', error: error.message });
  }
});

app.post('/api/trips', async (req, res) => {
  try {
    const {
      date,
      destination,
      departureTime,
      arrivalTime,
      meansOfTransportation,
      transportationCost,
    } = req.body;

    if (
      !date ||
      !destination ||
      !departureTime ||
      !arrivalTime ||
      !meansOfTransportation ||
      transportationCost === undefined
    ) {
      return res.status(400).json({ message: 'All itinerary fields are required.' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only administrators can add itinerary records.' });
    }

    const trip = await Trip.create({
      date,
      destination,
      departureTime,
      arrivalTime,
      meansOfTransportation,
      transportationCost: Number(transportationCost),
    });

    return res.status(201).json(trip);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to save itinerary record.', error: error.message });
  }
});

app.put('/api/trips/:id', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only administrators can edit itinerary records.' });
    }

    const { id } = req.params;
    const {
      date,
      destination,
      departureTime,
      arrivalTime,
      meansOfTransportation,
      transportationCost,
    } = req.body;

    if (
      !date ||
      !destination ||
      !departureTime ||
      !arrivalTime ||
      !meansOfTransportation ||
      transportationCost === undefined
    ) {
      return res.status(400).json({ message: 'All itinerary fields are required.' });
    }

    const updatedTrip = await Trip.findByIdAndUpdate(
      id,
      {
        date,
        destination,
        departureTime,
        arrivalTime,
        meansOfTransportation,
        transportationCost: Number(transportationCost),
      },
      { new: true, runValidators: true },
    );

    if (!updatedTrip) {
      return res.status(404).json({ message: 'Trip not found.' });
    }

    return res.status(200).json(updatedTrip);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update itinerary record.', error: error.message });
  }
});

app.delete('/api/trips/:id', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only administrators can delete itinerary records.' });
    }

    const { id } = req.params;
    const deletedTrip = await Trip.findByIdAndDelete(id);

    if (!deletedTrip) {
      return res.status(404).json({ message: 'Trip not found.' });
    }

    return res.status(200).json({ message: 'Trip deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete itinerary record.', error: error.message });
  }
});

app.delete('/api/trips/date/:date', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only administrators can delete itinerary records.' });
    }

    const { date } = req.params;
    const deleteResult = await Trip.deleteMany({ date });

    return res.status(200).json({
      message: `${deleteResult.deletedCount} trip entries deleted for ${date}.`,
      deletedCount: deleteResult.deletedCount,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete itinerary entries for that date.', error: error.message });
  }
});

app.delete('/api/trips', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only administrators can delete itinerary records.' });
    }

    const deleteResult = await Trip.deleteMany({});

    return res.status(200).json({
      message: `${deleteResult.deletedCount} trip entries deleted.`,
      deletedCount: deleteResult.deletedCount,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete all itinerary entries.', error: error.message });
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ message: 'Internal server error.' });
});

if (!process.env.MONGO_URI) {
  console.warn('Missing MONGO_URI. Set your MongoDB Atlas connection string in the backend .env file before starting the server.');
}

const startServer = (portToUse) => {
  const server = app.listen(portToUse, () => {
    console.log(`Server running on http://localhost:${portToUse}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      const nextPort = preferredPorts.find((port) => port !== portToUse && port !== requestedPort + 1 ? true : true);
      const fallbackPort = preferredPorts.find((port) => port !== portToUse && port !== requestedPort && port !== 5000);
      const chosenPort = fallbackPort || nextPort;

      if (chosenPort) {
        console.warn(`Port ${portToUse} is busy. Retrying on ${chosenPort}.`);
        startServer(chosenPort);
        return;
      }
    }

    console.error('Server failed to start:', error.message);
    process.exit(1);
  });
};

mongoose
  .connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/tevtracker')
  .then(async () => {
    await seedAdminUser();
    startServer(preferredPorts[0]);
  })
  .catch((error) => {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  });
