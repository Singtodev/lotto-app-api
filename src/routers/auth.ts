import express, { Router, Request, Response } from "express";
import {
  validateAuthLoginBody,
  validateAuthRegisterBody,
} from "../middleware/validateAuth";
import jwt from "jsonwebtoken";
import condb from "../utils/connectDB";
import bcrypt from "bcrypt";
import { UserModel } from "../models/user";

const router: Router = express.Router();
const secret = process.env.JWT_SECRET || "Enigma";

router.post(
  "/register",
  validateAuthRegisterBody,
  (req: Request, res: Response) => {
    const userData: UserModel | any = req.body;

    condb.query(
      "SELECT * FROM users WHERE email = ?",
      [userData.email],
      (error: any, existingUsers: any) => {
        if (error) {
          console.error("Error checking existing user:", error);
          return res
            .status(500)
            .json({ message: "An error occurred during registration" });
        }

        if (Array.isArray(existingUsers) && existingUsers.length > 0) {
          return res
            .status(400)
            .json({ message: "Email already exists" });
        }

        bcrypt.hash(userData.password!, 10, (err, hashedPassword) => {
          if (err) {
            console.error("Error hashing password:", err);
            return res
              .status(500)
              .json({ message: "An error occurred during registration" });
          }

          condb.query(
            "INSERT INTO users (email, first_name, last_name, password) VALUES (?, ?, ?, ?)",
            [
              userData.email,
              userData.first_name,
              userData.last_name,
              hashedPassword,
            ],
            (error: any, result: any) => {
              if (error) {
                console.error("Error inserting user:", error);
                return res
                  .status(500)
                  .json({ message: "An error occurred during registration" });
              }

              delete userData.password;
              delete userData.password_confirmation;

              if ("insertId" in result) {
                const userId = result.insertId;
                const token = jwt.sign({ id: userId, ...userData }, secret, {
                  expiresIn: process.env.JWT_EXPIRE,
                });
                res.status(201).json({
                  message: "Registered successfully",
                  data: userData,
                  token,
                });
              } else {
                res.status(500).json({ message: "Failed to insert user" });
              }
            }
          );
        });
      }
    );
  }
);

router.post("/login", (req: Request, res: Response) => {
  const { email, password } = req.body;

  condb.query(
    "SELECT * FROM users WHERE email = ?",
    [email],
    (error: any, users: any) => {
      if (error) {
        console.error("Error finding user:", error);
        return res
          .status(500)
          .json({ message: "An error occurred during login" });
      }

      if (!Array.isArray(users) || users.length === 0) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const user = users[0];

      bcrypt.compare(password, user.password, (err, isMatch) => {
        if (err) {
          console.error("Error comparing passwords:", err);
          return res
            .status(500)
            .json({ message: "An error occurred during login" });
        }

        if (!isMatch) {
          return res.status(401).json({ message: "Invalid credentials" });
        }

        const userData = {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
        };

        const token = jwt.sign(userData, secret, {
          expiresIn: process.env.JWT_EXPIRE,
        });

        res.json({
          message: "Logged in successfully",
          data: userData,
          token,
        });
      });
    }
  );
});

export default router;
