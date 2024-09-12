import express, { Router, Request, Response } from "express";
import condb from "../utils/connectDB";
import { MysqlError } from "mysql";

const router: Router = express.Router();

// GET all users
router.get("/", (req: Request, res: Response) => {
  try {
    condb.query(
      "SELECT * FROM users",
      (err: MysqlError | null, results: any) => {
        if (err) {
          console.error(err);
          res.status(500).json({ message: "Internal Server Error" });
        } else {
          res.json({ message: "GET all users", data: results });
        }
      }
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// GET a specific user
router.get("/:id", (req: Request, res: Response) => {
  const userId = req.params.id;
  try {
    condb.query(
      "SELECT * FROM users WHERE id = ?",
      [userId],
      (err: MysqlError | null, results: any) => {
        if (err) {
          console.error(err);
          res.status(500).json({ message: "Internal Server Error" });
        } else if (results.length === 0) {
          res.status(404).json({ message: `User with ID ${userId} not found` });
        } else {
          res.json({ message: `GET user with id ${userId}`, data: results[0] });
        }
      }
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// PUT update a user
router.put("/:id", (req: Request, res: Response) => {
  const userId = req.params.id;
  const userData = req.body;

  try {
    // ตรวจสอบว่าผู้ใช้มีอยู่ในฐานข้อมูลหรือไม่
    condb.query(
      "SELECT * FROM users WHERE id = ?",
      [userId],
      (err: MysqlError | null, results: any) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ message: "Internal Server Error" });
        }

        if (results.length === 0) {
          return res
            .status(404)
            .json({ message: `User with ID ${userId} not found` });
        }

        const existingUser = results[0];
        const updatedUserData = { ...existingUser, ...userData };

        // เช็คว่ามีการเปลี่ยนแปลงอีเมลหรือไม่
        if (userData.email && userData.email !== existingUser.email) {
          // ตรวจสอบว่าอีเมลที่ต้องการอัปเดตมีอยู่ในฐานข้อมูลหรือไม่
          condb.query(
            "SELECT * FROM users WHERE email = ?",
            [userData.email],
            (emailCheckErr: MysqlError | null, emailCheckResults: any) => {
              if (emailCheckErr) {
                console.error(emailCheckErr);
                return res
                  .status(500)
                  .json({ message: "Internal Server Error" });
              }

              if (emailCheckResults.length > 0) {
                return res
                  .status(400)
                  .json({ message: "Email already exists" });
              }

              // ลบข้อมูลที่ไม่ต้องการก่อนอัปเดต
              delete updatedUserData.role;
              delete updatedUserData.wallet;
              delete updatedUserData.password;

              // อัปเดตข้อมูลผู้ใช้ในฐานข้อมูล
              condb.query(
                "UPDATE users SET ? WHERE id = ?",
                [updatedUserData, userId],
                (updateErr: MysqlError | null) => {
                  if (updateErr) {
                    console.error(updateErr);
                    return res
                      .status(500)
                      .json({ message: "Internal Server Error" });
                  }

                  res.json({
                    message: `Updated user with ID ${userId}`,
                    data: updatedUserData,
                  });
                }
              );
            }
          );
        } else {
          // ลบข้อมูลที่ไม่ต้องการก่อนอัปเดต
          delete updatedUserData.role;
          delete updatedUserData.wallet;
          delete updatedUserData.password;

          // อัปเดตข้อมูลผู้ใช้ในฐานข้อมูล
          condb.query(
            "UPDATE users SET ? WHERE id = ?",
            [updatedUserData, userId],
            (updateErr: MysqlError | null) => {
              if (updateErr) {
                console.error(updateErr);
                return res
                  .status(500)
                  .json({ message: "Internal Server Error" });
              }

              res.json({
                message: `Updated user with ID ${userId}`,
                data: updatedUserData,
              });
            }
          );
        }
      }
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});
// DELETE a user
router.delete("/:id", (req: Request, res: Response) => {
  const id = req.params.id;
  try {
    condb.query(
      "DELETE FROM lottos WHERE id = ?",
      [id],
      (err: MysqlError | null, result: any) => {
        if (err) {
          console.error(err);
          res.status(500).json({ message: "Internal Server Error" });
        } else if (result.affectedRows === 0) {
          res.status(404).json({ message: "Lotto not found" });
        } else {
          res.json({ message: `Lotto with ID ${id} deleted` });
        }
      }
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
