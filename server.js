const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const multer = require('multer');
const cors = require('cors');
const bcrypt = require('bcrypt');
const User = require('./models/User');
const axios = require('axios');
const app = express();
const port = 4000;
const nodemailer = require("nodemailer");
const API_KEY = 'c0ef56ccca986fa61939b6ef12edfd14';
app.use(express.json());
app.use(cors());
app.use(bodyParser.json());

mongoose.connect('mongodb+srv://theprithivraj:h1h2h3h4@prithiv.xaz8u.mongodb.net/LinkUpDB?retryWrites=true&w=majority&appName=prithiv', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.log('Error connecting to MongoDB: ', err));

const storage = multer.memoryStorage(); 

const upload = multer({ storage });

const transporter = nodemailer.createTransport({
  service: "gmail", 
  auth: {
    user: "theprithivraj@gmail.com", 
    pass: "revw iely latz khae",  
  },
});

const uploadToImgBB = async (imageBuffer, mimetype) => {
  try {
    const formData = new FormData();
    formData.append('image', imageBuffer.toString('base64')); 
    const response = await axios.post('https://api.imgbb.com/1/upload', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      params: {
        key: API_KEY,
      }
    });
    
    if (response.data.success) {
      return response.data.data.url;  
    } else {
      throw new Error('Failed to upload image to ImgBB');
    }
  } catch (error) {
    console.error('Error uploading image to ImgBB:', error);
    throw new Error('Failed to upload image');
  }
};


app.post('/createUser', upload.single('profilePic'), async (req, res) => {
  try {
    console.log('Request body:', req.body);
    console.log('Uploaded file:', req.file);

    if (!req.file) {
      return res.status(400).json({ message: 'Profile picture is required' });
    }

    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    const imageUrl = await uploadToImgBB(req.file.buffer, req.file.mimetype);
    console.log('Image uploaded to ImgBB, URL:', imageUrl);

    const user = new User({
      name: req.body.name,
      email: req.body.email,
      password: hashedPassword,
      interests: req.body.interests.split(','),
      bio: req.body.bio,
      personality: req.body.personality,
      profilePic: imageUrl, 
    });

    await user.save();

    return res.status(200).json({ message: 'User created successfully', user });
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

app.post("/api/send-email", async (req, res) => {
  const { to, subject, message } = req.body;

  if (!to || !subject || !message) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const mailOptions = {
    from: "theprithivraj@gmail.com", 
    to: to,
    subject: subject,
    text: message,
  };

  try {
    await transporter.sendMail(mailOptions);
    return res.status(200).json({ message: "Email sent successfully!" });
  } catch (error) {
    console.error("Error sending email:", error);
    return res.status(500).json({ error: "Failed to send email" });
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
