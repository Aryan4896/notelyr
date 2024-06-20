require("dotenv").config();
const cookieParser = require("cookie-parser");
const userModel = require("./models/user");
const postModel = require("./models/post");
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const app = express();

const PORT = process.env.PORT || 3001;

// Connect to MongoDB using the environment variable
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB", err);
  });

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.get("/login", (req, res) => {
  res.render("login");
});
app.get("/register", (req, res) => {
  res.render("index");
});
app.get("/", (req, res) => {
  res.render("index");
});
app.post("/register", async (req, res) => {
  let { username, email, password, age } = req.body;

  let user = await userModel.findOne({ email });
  if (user) {
    return res.status(500).send("user already registered");
  }

  bcrypt.genSalt(10, (err, salt) => {
    bcrypt.hash(password, salt, async (err, hash) => {
      let user = await userModel.create({
        username,
        email,
        age,
        password: hash,
      });
      let token = jwt.sign({ email: email, userid: user._id }, "secret");
      res.cookie("token", token);
      res.redirect("/profile");
    });
  });
});
app.post("/login", async (req, res) => {
  let { email, password } = req.body;

  let user = await userModel.findOne({ email });
  if (!user) {
    return res.status(500).send("something went wrong");
  }
  //if password doesnt matches
  bcrypt.compare(password, user.password, (err, result) => {
    if (result) {
      let token = jwt.sign({ email: email, userid: user._id }, "secret");
      res.cookie("token", token);
      res.status(200).redirect("/profile");
    } else res.redirect("/login");
  });
});

app.get("/logout", (req, res) => {
  res.cookie("token", "");
  res.redirect("/login");
});
app.get("/profile", isLoggedIn, async (req, res) => {
  let user = await userModel
    .findOne({ email: req.user.email })
    .populate("posts");

  res.render("profile", { user });
  //   console.log(user);
});

app.post("/post", isLoggedIn, async (req, res) => {
  let user = await userModel.findOne({ email: req.user.email });
  let post = await postModel.create({
    user: user._id,
    content: req.body.content,
  });
  user.posts.push(post._id);
  await user.save();
  res.redirect("/profile");
});

app.get("/like/:id", isLoggedIn, async (req, res) => {
  let post = await postModel.findOne({ _id: req.params.id }).populate("user");
  if (post.likes.indexOf(req.user.userid) === -1) {
    post.likes.push(req.user.userid);
  } else {
    post.likes.splice(post.likes.indexOf(req.user.userid), 1);
  }
  await post.save();
  res.redirect("/profile");
});

app.get("/edit/:id", isLoggedIn, async (req, res) => {
  let post = await postModel.findOne({ _id: req.params.id }).populate("user");
  res.render("edit", { post });
});
app.post("/update/:id", isLoggedIn, async (req, res) => {
  try {
    await postModel.findOneAndUpdate(
      { _id: req.params.id },
      { content: req.body.content }
    );
    res.redirect("/profile");
  } catch (error) {
    res.status(500).send("Error updating post");
  }
});

//a middleware for protected route - and only if we are logged in it will perform according to that
function isLoggedIn(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    // If the token is missing or empty, send a "please login first" message
    return res.send("please login first");
  }

  try {
    let data = jwt.verify(token, "secret");
    req.user = data;
    next();
  } catch (err) {
    return res.status(401).send("Invalid token, please login again.");
  }
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
