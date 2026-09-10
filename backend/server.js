const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const requestedPort = Number(process.env.PORT) || 5000;
const preferredPorts = [requestedPort, requestedPort + 1, 5001, 5002, 5003];
const allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'http://127.0.0.1:3000'];

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

const Trip = mongoose.model('Trip', tripSchema);

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'TEV Tracker API is running.' });
});

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
  .then(() => {
    startServer(preferredPorts[0]);
  })
  .catch((error) => {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  });
