const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const multer = require('multer');
const cors = require('cors');
const bcrypt = require('bcrypt');
const User = require('./models/User');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 4000;

app.use(express.json());
app.use(cors());
app.use(bodyParser.json());

mongoose.connect('mongodb+srv://theprithivraj:h1h2h3h4@prithiv.xaz8u.mongodb.net/LinkUpDB?retryWrites=true&w=majority&appName=prithiv', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.log('Error connecting to MongoDB: ', err));

const storage = multer.memoryStorage(); 

const upload = multer({ storage });

app.post('/createUser', upload.single('profilePic'), async (req, res) => {
  try {
    console.log('Request body:', req.body);
    console.log('Uploaded file:', req.file);
    if (!req.file) {
      return res.status(400).json({ message: 'Profile picture is required' });
    }

    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    const response = await axios.post(
      'https://linkup-ml.onrender.com/upload_image/',
      req.file.buffer,
      { headers: { 'Content-Type': req.file.mimetype } }
    );

    console.log('Flask API response:', response.data);

    if (response.data && response.data.imageUrl) {
      const user = new User({
        name: req.body.name,
        email: req.body.email,
        password: hashedPassword,
        interests: req.body.interests.split(','),
        bio: req.body.bio,
        personality: req.body.personality,
        profilePic: response.data.imageUrl,
      });

      await user.save();
      return res.status(200).json({ message: 'User created successfully', user });
    } else {
      return res.status(400).json({ message: 'Image upload failed' });
    }
  } catch (error) {
    console.error('Error creating user:', error.stack || error);
    return res.status(500).json({ message: 'Internal server error', error });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid password' });
    }
    res.status(200).json({ message: 'Login successful', userId: user._id });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Internal server error', error });
  }
});

app.post('/api/top-profiles', async (req, res) => {
  const { userId } = req.body;
  try {
    const loggedInUser = await User.findById(userId);
    if (!loggedInUser) {
      return res.status(400).json({ message: 'User not found' });
    }
    const response = await axios.post('https://linkup-ml.onrender.com/predict', {
      interests: loggedInUser.interests
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log("Flask API response:", response.data);
    const topMatches = response.data;  
    res.status(200).json({ topMatches });
  } catch (error) {
    console.error('Error fetching top matches:', error);
    res.status(500).json({ message: 'Internal server error', error });
  }
});

app.get('/api/profile/:name', async (req, res) => {
  const { name } = req.params;
  try {
    const profile = await User.findOne({ name });
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    res.json(profile);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const updateUserPasswords = async () => {
  const users = await User.find();
  for (let user of users) {
    if (!user.password.startsWith('$2b$')) { 
      user.password = await bcrypt.hash(user.password, 10);
      await user.save();
    }
  }
  console.log('Passwords updated successfully');
};

app.listen(port, () => {
  console.log(`Server running`);
});
