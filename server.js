// const express = require('express');
// const mongoose = require('mongoose');
// const bodyParser = require('body-parser');
// const multer = require('multer');
// const cors = require('cors');
// const bcrypt = require('bcrypt');
// const User = require('./models/User');
// const axios = require('axios');
// const path = require('path'); 
// const app = express();
// const port = 4000;

// app.use(express.json());
// app.use(cors());
// app.use(bodyParser.json());
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// mongoose.connect('mongodb+srv://theprithivraj:h1h2h3h4@prithiv.xaz8u.mongodb.net/LinkUpDB?retryWrites=true&w=majority&appName=prithiv', { useNewUrlParser: true, useUnifiedTopology: true })
//   .then(() => console.log('Connected to MongoDB'))
//   .catch((err) => console.log('Error connecting to MongoDB: ', err));

//   const storage = multer.diskStorage({
//     destination: (req, file, cb) => {
//       console.log('Uploading to uploads folder');
//       cb(null, 'uploads/');
//     },
//     filename: (req, file, cb) => {
//       console.log('Saving file:', file.originalname);
//       cb(null, Date.now() + '-' + file.originalname);
//     },
//   });
  
// const upload = multer({ storage });

// app.post('/createUser', upload.single('profilePic'), async (req, res) => {
//   try {
//     const hashedPassword = await bcrypt.hash(req.body.password, 10);
//     const user = new User({
//       name: req.body.name,
//       email: req.body.email,
//       password: hashedPassword,
//       interests: req.body.interests.split(','),
//       bio: req.body.bio,
//       personality: req.body.personality,
//       profilePic: req.file.path, 
//     });
//     await user.save();
//     res.status(200).json({ message: 'User created successfully', user });
//   } catch (error) {
//     res.status(400).json({ message: 'Error creating user', error });
//   }
// });
// app.post('/login', async (req, res) => {
//   const { email, password } = req.body;
//   if (!email || !password) {
//     return res.status(400).json({ message: 'Email and password are required' });
//   }
//   try {
//     const user = await User.findOne({ email });
//     if (!user) {
//       return res.status(400).json({ message: 'User not found' });
//     }
//     const isPasswordValid = await bcrypt.compare(password, user.password);
//     if (!isPasswordValid) {
//       return res.status(400).json({ message: 'Invalid password' });
//     }
//     res.status(200).json({ message: 'Login successful', userId: user._id });
//   } catch (error) {
//     console.error('Error during login:', error);
//     res.status(500).json({ message: 'Internal server error', error });
//   }
// });
// app.post('/api/top-profiles', async (req, res) => {
//   const { userId } = req.body;
//   try {
//     const loggedInUser = await User.findById(userId);
//     if (!loggedInUser) {
//       return res.status(400).json({ message: 'User not found' });
//     }
//     const response = await axios.post('https://linkup-ml.onrender.com/predict', {
//       interests: loggedInUser.interests
//     }, {
//       headers: {
//         'Content-Type': 'application/json'
//       }
//     });
//     console.log("Flask API response:", response.data);
//     const topMatches = response.data;  
//     res.status(200).json({ topMatches });
//   } catch (error) {
//     console.error('Error fetching top matches:', error);
//     res.status(500).json({ message: 'Internal server error', error });
//   }
// });

// app.get('/api/profile/:name', async (req, res) => {
//   const { name } = req.params;
//   try {
//     const profile = await User.findOne({ name });
//     if (!profile) {
//       return res.status(404).json({ error: 'Profile not found' });
//     }
//     res.json(profile);
//   } catch (error) {
//     console.error('Error fetching profile:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });
// const updateUserPasswords = async () => {
//   const users = await User.find();
//   for (let user of users) {
//     if (!user.password.startsWith('$2b$')) { 
//       user.password = await bcrypt.hash(user.password, 10);
//       await user.save();
//     }
//   }
//   console.log('Passwords updated successfully');
// };
// app.listen(port, () => {
//   console.log(`Server running at http://localhost:${port}`);
// });

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const multer = require('multer');
const cors = require('cors');
const bcrypt = require('bcrypt');
const User = require('./models/User');
const axios = require('axios');
const path = require('path');
const Grid = require('gridfs-stream');
const { Readable } = require('stream');
const app = express();
const port = 4000;

// Middlewares
app.use(express.json());
app.use(cors());
app.use(bodyParser.json());

// MongoDB connection and GridFS setup
let gfs;
mongoose.connect('mongodb+srv://theprithivraj:h1h2h3h4@prithiv.xaz8u.mongodb.net/LinkUpDB?retryWrites=true&w=majority&appName=prithiv', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Connected to MongoDB');
    const conn = mongoose.connection;
    gfs = Grid(conn.db, mongoose.mongo); // Initialize GridFS
    gfs.collection('profile_pictures');  // Set GridFS collection name for profile pictures
  })
  .catch((err) => {
    console.error('Error connecting to MongoDB:', err);
    process.exit(1);  // Exit the process if DB connection fails
  });

// Multer configuration for file uploads
const storage = multer.memoryStorage();  // Use memory storage to store image in memory
const upload = multer({ storage });

// Routes

// Create user and upload profile picture to MongoDB
app.post('/createUser', upload.single('profilePic'), async (req, res) => {
  try {
    const { name, email, password, interests, bio, personality } = req.body;
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a stream to write the image file to GridFS
    const file = req.file;
    const readStream = Readable.from(file.buffer);  // Convert buffer to readable stream
    const writeStream = gfs.createWriteStream({
      filename: file.originalname,
      content_type: file.mimetype,
    });

    // Pipe the image buffer to GridFS
    readStream.pipe(writeStream);

    // Wait for the file to be uploaded and get the file ID
    writeStream.on('close', async (uploadedFile) => {
      const user = new User({
        name,
        email,
        password: hashedPassword,
        interests: interests.split(','),
        bio,
        personality,
        profilePic: uploadedFile._id,  // Store the file ID in MongoDB
      });

      await user.save();
      res.status(200).json({ message: 'User created successfully', user });
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(400).json({ message: 'Error creating user', error: error.message });
  }
});

// Fetch user profile by ID
app.get('/api/profile/:name', async (req, res) => {
  const { name } = req.params;
  try {
    const profile = await User.findOne({ name });
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // If profile has a profile picture, retrieve it from GridFS
    if (profile.profilePic) {
      const file = await gfs.files.findOne({ _id: profile.profilePic });
      if (!file) {
        return res.status(404).json({ error: 'Profile picture not found' });
      }

      // Stream the image from GridFS
      const readStream = gfs.createReadStream(file.filename);
      res.set('Content-Type', file.contentType); // Set appropriate Content-Type for the image
      readStream.pipe(res);  // Pipe the stream to the response
    } else {
      res.status(200).json(profile); // Return profile if no image is present
    }
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
