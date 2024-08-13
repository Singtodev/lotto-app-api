import express, { Router, Request, Response } from "express";
import condb from "../utils/connectDB";
import { MysqlError } from "mysql";

const router: Router = express.Router();

// Get all lotto
router.get("/", (req: Request, res: Response) => {
  try {
    condb.query(
      "SELECT * FROM lottos",
      (err: MysqlError | null, results: any) => {
        if (err) {
          console.error(err);
          res.status(500).json({ message: "Internal Server Error" });
        } else {
          res.json({ message: "All lotto retrieved", data: results });
        }
      }
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Get lotto by status
router.get("/status/:status", (req: Request, res: Response) => {
  const status = req.params.status;
  try {
    condb.query(
      "SELECT * FROM lottos WHERE status = ?",
      [status],
      (err: MysqlError | null, results: any) => {
        if (err) {
          console.error(err);
          res.status(500).json({ message: "Internal Server Error" });
        } else {
          res.json({
            message: `Lotto of status ${status} retrieved`,
            data: results,
          });
        }
      }
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Get lotto by ID
router.get("/:id", (req: Request, res: Response) => {
  const id = req.params.id;
  try {
    condb.query(
      "SELECT * FROM lottos WHERE id = ?",
      [id],
      (err: MysqlError | null, results: any) => {
        if (err) {
          console.error(err);
          res.status(500).json({ message: "Internal Server Error" });
        } else if (results.length === 0) {
          res.status(404).json({ message: "Lotto not found" });
        } else {
          res.json({
            message: `Lotto with ID ${id} retrieved`,
            data: results[0],
          });
        }
      }
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Update lotto
router.put("/:id", (req: Request, res: Response) => {
  const id = req.params.id;
  const updateData = req.body;

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({ message: "No fields provided for update" });
  }

  try {
    condb.query(
      "SELECT * FROM lottos WHERE id = ?",
      [id],
      (selectErr: MysqlError | null, selectResult: any) => {
        if (selectErr) {
          console.error(selectErr);
          return res.status(500).json({ message: "Internal Server Error" });
        }

        if (selectResult.length === 0) {
          return res.status(404).json({ message: "Lotto not found" });
        }
        const currentData = selectResult[0];
        const mergedData = { ...currentData, ...updateData };
        const updateFields = Object.keys(updateData)
          .map((key) => `${key} = ?`)
          .join(", ");
        const updateValues = Object.values(updateData);
        updateValues.push(id);
        condb.query(
          `UPDATE lottos SET ${updateFields} WHERE id = ?`,
          updateValues,
          (updateErr: MysqlError | null, updateResult: any) => {
            if (updateErr) {
              console.error(updateErr);
              return res.status(500).json({ message: "Internal Server Error" });
            }

            res.json({
              message: `Lotto with ID ${id} updated`,
              updatedFields: Object.keys(updateData),
            });
          }
        );
      }
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Check lotto
router.post("/check", (req: Request, res: Response) => {
  const { number, date } = req.body;

  // ตรวจสอบว่ามีการส่ง number และ date มาหรือไม่
  if (!number || !date) {
    return res.status(400).json({ message: "number and date are required" });
  }

  // ตรวจสอบรูปแบบของ date (ควรเป็น YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return res
      .status(400)
      .json({ message: "Invalid date format. Use YYYY-MM-DD" });
  }

  // คำสั่ง SQL สำหรับตรวจสอบ lotto จาก draw_prizes table
  const query = `
    SELECT dpid, date, number, reward_point, seq
    FROM draw_prizes
    WHERE number = ? AND date = ?
  `;

  condb.query(query, [number, date], (err: any, results: any) => {
    if (err) {
      console.error("Error checking lotto:", err);
      return res
        .status(500)
        .json({ message: "An error occurred while checking the lotto" });
    }

    if (results.length === 0) {
      return res.status(200).json({
        message: "Lotto checked successfully",
        result: {
          number: number,
          checked_date: date,
          win: false,
        },
      });
    }

    const prize = results[0];
    return res.status(200).json({
      message: "Lotto checked successfully",
      result: {
        dpid: prize.dpid,
        number: prize.number,
        win_date: prize.date,
        reward_point: prize.reward_point,
        seq: prize.seq,
        win: true,
      },
    });
  });
});
export default router;
