const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String },
  password: { type: String },
  status: { type: Boolean },
  token: { type: String },
  pfp: { type: String},
}, {
    versionKey: false
});

module.exports = mongoose.model("user", userSchema);