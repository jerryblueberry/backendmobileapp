const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
// try
const path = require("path")

const app = express();
const port = 8000;
const cors = require('cors');
app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(passport.initialize());


const jwt = require('jsonwebtoken');
require('dotenv').config();

const MONGO_URL = process.env.DB;

mongoose
  .connect(MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('Connected To Mongo Db');
  })
  .catch((err) => {
    console.log('Error Connecting to MongoDb', err);
  });
  //  try
  app.use("/files", express.static(path.join(__dirname, "files")));

app.listen(port, () => {
  console.log(`Server Running on Port ${port}`);
});

const User = require('./models/user');
const Message = require('./models/message');

//   end point for user registration

app.post('/register', (req, res) => {
  const { name, email, password, image } = req.body;
  //  create a new User Object
  const newUser = new User({ name, email, password, image });

  //  save the user to the database
  newUser
    .save()
    .then(() => {
      res.status(200).json({ message: 'User Registered Successfully' });
    })
    .catch((err) => {
      res.status(500).json({ message: 'Error registering the User', err });
    });
});
//  function to create a token for the user
const createToken = (userId) => {
  //  set the token payload
  const payload = {
    userId: userId,
  };
  //  generate the token with a secret key and expiration time
  const token = jwt.sign(payload, 'Q$r2K6W8n!jCW%Zk', { expiresIn: '1h' });

  return token;
};

//  end point for login

app.post('/login', (req, res) => {
  const { email, password } = req.body;

  //  check if the email and password are provided
  if (!email || !password) {
    return res
      .status(404)
      .json({ message: 'Email and the password are required' });
  }
  //  check for that user in the database

  User.findOne({ email })
    .then((user) => {
      if (!user) {
        //  user not found
        return res.status(404).json({ message: 'User not Found' });
      }
      //  compare the provided password with the password in the database
      if (user.password !== password) {
        return res.status(404).status.json({ message: 'Invalid Password' });
      }

      const token = createToken(user._id);
      res.status(200).json({ token });
    })
    .catch((error) => {
      console.log('Error in Finding the User', error);
      res.status(500).json({ message: 'Internal Server Error' });
    });
});

//  end point to access all the users except the user who is currently logged in!
app.get('/users/:userId', (req, res) => {
  const loggedInUserId = req.params.userId;

  User.find({ _id: { $ne: loggedInUserId } })
    .then((users) => {
      res.status(200).json(users);
    })
    .catch((err) => {
      console.log('Error retrieving users', err);
      res.status(500).json({ message: 'Error retreiving users' });
    });
});

//  end point to update the user Profile
app.put('/users/:userId', async (req, res) => {
  const loggedInUserId = req.params.userId;
  const updatedUserData = req.body;

  // Check if loggedInUserId is a valid ObjectId
  if (!mongoose.isValidObjectId(loggedInUserId)) {
    return res.status(400).json({ message: 'Invalid user ID' });
  }

  try {
    // Update the user profile by the valid ObjectId
    const updatedUser = await User.findByIdAndUpdate(loggedInUserId, updatedUserData, { new: true });

    if (!updatedUser) {
      return res.status(404).json({ message: 'User Not Found' });
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    console.log('Error Updating User Profile', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


// End point to access logged-in user
app.get('/loggedUser/:userId', (req, res) => {
  const loggedInUserId = req.params.userId;

  User.findOne({ _id: loggedInUserId })
    .then((user) => {
      if (user) {
        res.status(200).json(user);
      } else {
        res.status(404).json({ message: 'Logged-in user not found' });
      }
    })
    .catch((err) => {
      console.log('Error retrieving logged-in user', err);
      res.status(500).json({ message: 'Error retrieving logged-in user' });
    });
});


//  end point to send a request to user
app.post('/friend-request', async (req, res) => {
  const { currentUserId, selectedUserId } = req.body;

  try {
    //  update the recepients friend Request Array
    await User.findByIdAndUpdate(selectedUserId, {
      $push: { friendRequests: currentUserId },
    });
    // yo chai joslai friend request pathako ho tesko ma array update garna

    //  update the sender's sentFriendRequests array
    await User.findByIdAndUpdate(currentUserId, {
      $push: { sentFriendRequests: selectedUserId },
    });
    //  yo chai jun manche le friend request pathako ho usko sentFriend Request ma array update garna
    res.sendStatus(200);
  } catch (error) {
    res.sendStatus(500);
  }
});

//  end point  to show all the friend requests of the particular user
app.get('/friend-request/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    //  fetch the user document based on their user id
    const user = await User.findById(userId)
      .populate('friendRequests', 'name email image')
      .lean();
    const friendRequests = user.friendRequests;
    res.json(friendRequests);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

//  end point to   accept a friend request of a particular person

app.post('/friend-request/accept', async (req, res) => {
  try {
    const { senderId, recepientId } = req.body;

    //   retrieve the document of sender and the reepient
    const sender = await User.findById(senderId);
    const recepient = await User.findById(recepientId);

    sender.friends.push(recepientId);
    recepient.friends.push(senderId);

    

    //  this is to filter or to remove the friendRequests Array for the recepient
    recepient.friendRequests = recepient.friendRequests.filter(
      (request) => request.toString() !== senderId.toString()
    );
    //  this is to filter or remove the sentFriendRequest array for the sender

    sender.sentFriendRequests = sender.sentFriendRequests.filter(
      (request) => request.toString() !== recepientId.toString()
    );

    await sender.save();
    await recepient.save();

    res.status(200).json({ message: 'Friend Request Accepted Successfully' });
  } catch (error) {
    console.log('Error Message', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

//  endpoint to access all the friends of the logged in user

app.get('/accepted-friends/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).populate(
      'friends',
      'name email image'
    );

    const acceptedFriends = user.friends;
    res.json(acceptedFriends);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


const multer = require("multer");

// Configure multer for handling file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "files/"); // Specify the desired destination folder
  },
  filename: function (req, file, cb) {
    // Generate a unique filename for the uploaded file
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });
//  end point to post message and store them in backend

app.post('/messages', upload.single('imageFile'), async (req, res) => {
  try {
    const { senderId, recepientId, messageType, messageText } = req.body;

    const newMessage = new Message({
      senderId,
      recepientId,
      messageType,
      message:messageText,
      timeStamp: new Date(),
      imageUrl: messageType === 'image' ? req.file.path : null,
    });
    await newMessage.save();

    res.status(200).json({ message: 'Message Sent Successfully' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

//  end point to get the user Details to design the chat room header

app.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    //  fetch the user data from the user Id
    const recepientId = await User.findById(userId);
    res.json(recepientId);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

//  endpoint to fetch the messages between two users in the chatroom

app.get('/messages/:senderId/:recepientId', async (req, res) => {
  try {
    const { senderId, recepientId } = req.params;
    const messages = await Message.find({
      $or: [
        { senderId: senderId, recepientId: recepientId },
        { senderId: recepientId, recepientId: senderId },
      ],
    }).populate('senderId', '_id name');
    res.json(messages);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

//  end point to delete the messages
app.post('/deleteMessages',async(req,res) => {
  try {
    const {messages} = req.body;
    if(!Array.isArray(messages) || messages.length === 0){
      return res.status(400).json({message:"Invalid req body"});

    }

    await Message.deleteMany({_id:{$in:messages}});
    res.json({message:"Message Deleted Successfully"});
  } catch (error) {
    console.log("error",error)
    res.status(500).json({error:"Internal Server Error"});
  }
})

app.get("/friend-requests/sent/:userId",async(req,res) => {
  try{
    const {userId} = req.params;
    const user = await User.findById(userId).populate("sentFriendRequests","name email image").lean();

    const sentFriendRequests = user.sentFriendRequests;

    res.json(sentFriendRequests);
  } catch(error){
    console.log("error",error);
    res.status(500).json({ error: "Internal Server" });
  }
})

app.get("/friends/:userId",(req,res) => {
  try{
    const {userId} = req.params;

    User.findById(userId).populate("friends").then((user) => {
      if(!user){
        return res.status(404).json({message: "User not found"})
      }

      const friendIds = user.friends.map((friend) => friend._id);

      res.status(200).json(friendIds);
    })
  } catch(error){
    console.log("error",error);
    res.status(500).json({message:"internal server error"})
  }
})

  