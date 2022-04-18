var createError = require('http-errors');
var express = require('express');
var cookieParser = require('cookie-parser')
var path = require('path');
var logger = require('morgan');
const bodyParser = require('body-parser');
const dbo = require('./db/conn.js');
const User = require("./model/user");
const mongoose = require('mongoose');
require("dotenv").config();
require("./db/database").connect();
const jwt = require("jsonwebtoken");
const auth = require("./middleware/auth");
const { MongoClient } = require("mongodb");
var AWS = require('aws-sdk');
AWS.config.update({region: 'us-east-1'});
const multer  = require('multer');
const upload = multer({ dest: 'uploads/' });
const { io } = require("socket.io-client");
const { body,validationResult } = require('express-validator');

var app = express();



// const socket = io("ws://localhost:3001");

// socket.on("hello", (arg) =>{
//   console.log(arg);
// });

// app.post('/lll', auth, function(req, res) {
//   console.log(req.user.username);
//   socket.emit("howdy", 'a');
// });

// const userId = 'abc';

// socket.on('askForUserId', () => {
//   socket.emit('userIdReceived', userId);
// });



var indexRouter = require('./routes/index');
const { type } = require('express/lib/response');
app.use('/', indexRouter);
app.use(cookieParser());


app.set('view engine', 'ejs');

app.get('/login', function(req, res) {
  res.render('pages/login');
});

app.get('/register', function(req, res) {
  res.render('pages/register');
});

app.get('/profile', auth, function(req, res) {
  username = req.user.username;
  res.render('pages/profile', {username: username});
});


//to serve css, js & img to board.ejs 
app.use(express.static(__dirname + '/views/pages'));
app.use(express.static(__dirname));

const socket = io("ws://localhost:3001");

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true})); 

socket.on('data', (message) => {
  console.log('You received a message');
  console.log(message);
  let ele = document.getElementById('rec');
  let node = document.createTextNode ('succ');
  ele.appendChild(node);
});

app.get('/board', auth, function(req, res) {
  // console.log(socket);
  socket.emit('userIdReceived', req.user.username);
  socket.on('send', (message) => {
    console.log(message);
  })
  res.render('../board', {username: req.user.username});
});

app.post('/send', async (req, res) => {
  socket.emit('send', {receiverId: req.body.username, data: "messagehere"});
})



app.post("/registeruser", async (req, res) => {
  try {
    const a = req.body;
    const username = a.username;
    const password = a.password;
    const status = false;
    const oldUser = await User.findOne({ username });

    if (oldUser) {
      return res.status(409).send("User Already Exists.");
    }

    const user = await User.create({
      username,
      password,
      status,
    });

    const token = jwt.sign(
      { user_id: user._id, username },
      process.env.TOKEN_KEY,
      {
        expiresIn: "2h",
      }
    );
    user.token = token;
    user.pfp = 'empty';
    user.save();
    
    res.status(201).json(user);
  } catch (err) {
    console.log(err);
  }
});

app.post('/loginuser', async (req, res) => {
  const a = req.body;
  try {
    const username = a.username;
    const password = a.password;

    if (!(username && password)){
      console.log('missing');
      res.status(400).send("All input is required");
    }
    const user = await User.findOne({ username });

    if (user && (password == user.password)) {
      const token = jwt.sign(
        { user_id: user._id, username },
        process.env.TOKEN_KEY,
        {
          expiresIn: "2h",
        }
      );
      let options = {
        path:"/",
        sameSite:true,
        maxAge: 1000 * 60 * 60 * 24, // would expire after 24 hours
        httpOnly: true, // The cookie only accessible by the web server
      }
      res.cookie('x-access-token',token, options); 
      user.status = true;
      user.save();
      user.token = token;
      // res.setHeader('Content-Type', 'application/json')
      // res.status(200).json(user);

      res.status(200).json({url : '/ind1'});
      // window.location.href = ('/ind1/?token='+token);
    } else {
    res.status(400).send("Invalid Credentials");
    }
  } catch (err) {
    console.log(err);
  }
});

// socket.on('send', (message) => {
//   console.log('You received a message');
//   console.log(message.data);
// });

app.get('/ind1', auth, (req, res) => {
  // socket.on('askForUserId', () => {
    // socket.emit('userIdReceived', req.user.username);
  // });
  res.render('pages/homepage');
});

app.get('/logout', auth, async (req, res) => {
  // console.log(req.user);
  username = req.user.username;
  const user = await User.findOne({ username });
  // console.log(user);
  user.status = false;
  user.save();
  res.clearCookie("x-access-token");
  res.render('pages/login');
})



app.post('/test', auth, upload.single('img'), async (req, res) => {
  console.log(1);
  var s3 = new AWS.S3({apiVersion: '2006-03-01', signatureVersion: 'v4',});
  username = req.user.username;
  var uploadParams = {Bucket: 'trialbucket112', Key: username, Body: ''};
  var file = req.file.path;

  var fs = require('fs');
  var fileStream = fs.createReadStream(file);
  fileStream.on('error', function(err) {
    console.log('File Error', err);
  });
  uploadParams.Body = fileStream;
  uploadParams.Key = path.basename(username);

  s3.upload (uploadParams, function (err, data) {
    if (err) {
      console.log("Error", err);
    } if (data) {
      console.log("Upload Success", data.Location);
    }
  });
  const user = await User.findOne({ username });
  var params = {Bucket: 'trialbucket112', Key: username};
  var promise = s3.getSignedUrlPromise('getObject', params);
  console.log(req.body.username);
  promise.then(function(url) {
    console.log('The URL is', url);
    user.pfp = url;
    user.save();
  }, function(err) { console.log(err); });
})

app.get('/test1', (req, res) => {
  s3 = new AWS.S3({apiVersion: '2006-03-01'});

  var bucketParams = {
    Bucket : 'trialbucket112',
  };

  s3.listObjects(bucketParams, function(err, data) {
    if (err) {
      console.log("Error", err);
    } else {
      console.log("Success", data);
    }
  });
})

//connecting to mongodb
dbo.connectToServer(function(err){
  if (err){
    console.error(err);
    process.exit();
  }
})

app.listen(parseInt(process.argv[2]));
module.exports = app;