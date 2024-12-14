const mongoose = require('mongoose');

// Define the User Schema
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  interests: { type: [String], default: [] },
  bio: { type: String, default: "" },
  personality: { type: String, default: "" },
  profilePic: { type: String, default: "" }
}, { timestamps: true }); // Adds createdAt and updatedAt fields

// Create a User model based on the schema
const User = mongoose.model('User', UserSchema);

module.exports = User;
