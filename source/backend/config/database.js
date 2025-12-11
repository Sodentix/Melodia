const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/melodia';

    // Config options
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Fail fast to try fallback
    };

    try {
      const conn = await mongoose.connect(mongoURI, options);
      console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (err) {
      console.error(`Failed to connect to primary URI (${mongoURI}): ${err.message}`);
      console.log('Attempting fallback to localhost...');
      const localhostURI = 'mongodb://localhost:27017/melodia';
      const conn = await mongoose.connect(localhostURI, options);
      console.log(`MongoDB Connected (Fallback): ${conn.connection.host}`);
    }

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed through app termination');
      process.exit(0);
    });

  } catch (error) {
    console.error('Database connection failed:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
