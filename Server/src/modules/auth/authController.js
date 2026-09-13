import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../users/userModel.js";

function generateToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

export async function register(req, res) {
  try {
    const { name, email, password, roles } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "name, email, and password are required" });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      roles: roles && roles.length ? roles : ["rider"],
    });

    const token = generateToken(user._id);

    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, roles: user.roles },
    });
  } catch (err) {
    res.status(500).json({ message: "Registration failed", error: err.message });
  }
}

export const login = async (req,res)=>{
    const {email,password}=req.body;
    if(!email || !password){
        return res.status(400).json({message: "all fields are required"});
    }
    try{
    const user = await User.findOne({ email:email.toLowerCase() });
    if(!user){
        res.status(401).json({
            message:"User Not Found"
        });
    }
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
        return res.status(401).json({ message: "Invalid credentials" });
    }
     const token = generateToken(user._id);
     res.status(200).json({
        message:"SignIn successful",
        token,
        name:user.name
     });
    } catch (err) {
    res.status(500).json({ message: "Login failed", error: err.message });
    }
  };