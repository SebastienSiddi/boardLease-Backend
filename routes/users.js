var express = require("express");
var router = express.Router();
const uid2 = require("uid2");
const bcrypt = require("bcrypt");

require("../models/connection");
const User = require("../models/users");

/**
 * @name POST: users/signup
 * @desc Route serving signup form.
 * @param {{firstname: String, lastname: String, username: String, email: String, password: String}}
 * @returns {{result: Boolean, token: String | null, error: String | null}}
 */

router.post("/signup", (req, res) => {
  const { firstname, lastname, username, email, password } = req.body;
  if (!firstname || !lastname || !username || !email || !password) {
    res.json({ result: false, error: "Missing or empty fields" });
    return;
  }

  // Check if the user has not already been registered
  User.findOne({ username: username }).then((data) => {
    if (data === null) {
      const token = uid2(32);
      const newUser = new User({
        firstname,
        lastname,
        username,
        email,
        password: bcrypt.hashSync(password, 10),
        token,
      });

      newUser.save().then(() => {
        res.json({ result: true, token });
      });
    } else {
      // User already exists in database
      res.json({ result: false, error: "User already exists" });
    }
  });
});

/**
 * @name POST: users/signin
 * @desc Route serving signin form.
 * @param {{email: String, password: String}}
 * @returns {{result: Boolean, token: String | null, error: String | null}}
 */
router.post("/signin", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.json({ result: false, error: "Missing or empty fields" });
    return;
  }

  User.findOne({
    email: email,
  }).then((data) => {
    if (bcrypt.compareSync(password, data.password)) {
      res.json({ result: true, token: data.token });
    } else {
      res.json({ result: false, error: "User not found" });
    }
  });
});

module.exports = router;
