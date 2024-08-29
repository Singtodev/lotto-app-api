import express, { Router, Request, Response } from "express";
import condb from "../utils/connectDB";
import { MysqlError } from "mysql";
import {
  checkValidationResult,
  lottoValidationRules,
} from "../middleware/validateLotto";

const router: Router = express.Router();

function generateLottoNumbers(count: number): string[] {
  const lottoSet = new Set<string>();
  while (lottoSet.size < count) {
    const number = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, "0");
    lottoSet.add(number);
  }
  return Array.from(lottoSet);
}

router.post("/reset", async (req: Request, res: Response) => {
  try {
    // ตรวจสอบสิทธิ์การเข้าถึง (ควรทำเพิ่มเติม)

    // รายชื่อตารางที่ต้องการ reset ทั้งหมด
    const tables = ["orders", "lottos", "users", "draw_prizes", "carts"];

    // ปิดการตรวจสอบ foreign key constraints ชั่วคราว
    await query("SET FOREIGN_KEY_CHECKS = 0");

    // ทำการ truncate ตารางที่ไม่ใช่ users
    for (const table of tables.filter((t) => t !== "users")) {
      await query(`TRUNCATE TABLE ${table}`);
    }

    // สำหรับตาราง users ให้ลบเฉพาะ users ที่ไม่ใช่ role 2
    await query(`DELETE FROM users WHERE role != 2`);

    // รีเซ็ต auto-increment ของตาราง users
    await query(`ALTER TABLE users AUTO_INCREMENT = 1`);

    // เปิดการตรวจสอบ foreign key constraints อีกครั้ง
    await query("SET FOREIGN_KEY_CHECKS = 1");

    res.status(200).json({
      message:
        "All tables have been reset successfully, except for users with role 2",
    });
  } catch (error) {
    console.error("Error resetting tables:", error);
    res
      .status(500)
      .json({ message: "An error occurred while resetting tables" });
  }
});

// ฟังก์ชันสำหรับ execute query แบบ Promise
function query(sql: string, values?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    condb.query(sql, values, (error: any, results: any) => {
      if (error) reject(error);
      else resolve(results);
    });
  });
}

router.post(
  "/generate_lotto",
  lottoValidationRules,
  checkValidationResult,
  (req: Request, res: Response) => {
    const { expired_date, count, price } = req.body;

    condb.beginTransaction((transactionErr: MysqlError | null) => {
      if (transactionErr) {
        console.error("Error starting transaction:", transactionErr);
        return res
          .status(500)
          .json({ message: "Failed to start database transaction" });
      }

      // ลบข้อมูลเก่าทั้งหมด
      condb.query("DELETE FROM lottos", (deleteErr: MysqlError | null) => {
        if (deleteErr) {
          return condb.rollback(() => {
            console.error("Error removing old records:", deleteErr);
            res
              .status(500)
              .json({ message: "Failed to remove old lottery numbers" });
          });
        }

        // สร้างเลขล็อตโต้ใหม่
        const lottoNumbers = generateLottoNumbers(count);
        const values = lottoNumbers.map((number) => [
          number,
          price,
          0,
          expired_date,
        ]);

        // เพิ่มข้อมูลใหม่
        const query =
          "INSERT INTO lottos (number, price, status, expired_date) VALUES ?";
        condb.query(query, [values], (insertErr: MysqlError | null) => {
          if (insertErr) {
            return condb.rollback(() => {
              console.error("Error inserting new records:", insertErr);
              res
                .status(500)
                .json({ message: "Failed to insert new lottery numbers" });
            });
          }

          // ยืนยันการทำรายการ
          condb.commit((commitErr: MysqlError | null) => {
            if (commitErr) {
              return condb.rollback(() => {
                console.error("Error committing transaction:", commitErr);
                res
                  .status(500)
                  .json({ message: "Failed to commit changes to database" });
              });
            }

            // ส่งผลลัพธ์กลับ
            res.json({
              message: `Successfully generated and inserted ${count} lottery numbers`,
              numbers: lottoNumbers,
            });
          });
        });
      });
    });
  }
);

router.post("/draw_random_from_lottos", (req: Request, res: Response) => {
  const { rewardPoints = [] } = req.body;

  // Validate input
  if (
    !Array.isArray(rewardPoints) ||
    !rewardPoints.every((point) => typeof point === "number")
  ) {
    return res
      .status(400)
      .json({ message: "Invalid rewardPoints. Must be an array of numbers." });
  }

  const count = rewardPoints.length;
  if (count === 0) {
    return res
      .status(400)
      .json({ message: "rewardPoints array must not be empty." });
  }

  // Delete all existing records from draw_prizes
  const deleteQuery = "DELETE FROM draw_prizes";
  condb.query(deleteQuery, (deleteErr: any) => {
    if (deleteErr) {
      console.error("Error deleting existing draw prizes:", deleteErr);
      return res.status(500).json({
        message: "An error occurred while deleting existing draw prizes",
      });
    }

    const query = "SELECT id, number FROM lottos ORDER BY RAND() LIMIT ?";

    condb.query(query, [count], (err: any, results: any) => {
      if (err) {
        console.error("Error selecting random lottos:", err);
        return res
          .status(500)
          .json({ message: "An error occurred while selecting random lottos" });
      }

      if (results.length === 0) {
        return res.status(404).json({ message: "No lottos available" });
      }

      const insertQuery =
        "INSERT INTO draw_prizes (number, reward_point, seq) VALUES ?";
      const values = results.map((result: any, index: number) => [
        result.number,
        rewardPoints[index],
        index + 1,
      ]);

      condb.query(insertQuery, [values], (insertErr: any) => {
        if (insertErr) {
          console.error("Error inserting draw prizes:", insertErr);
          return res.status(500).json({
            message: "An error occurred while saving the draw prizes",
          });
        }

        // Update orders with status 1 to status 2
        const updateOrdersQuery =
          "UPDATE orders SET status = 2 WHERE status = 1";
        condb.query(updateOrdersQuery, (updateErr: any, updateResult: any) => {
          if (updateErr) {
            console.error("Error updating orders:", updateErr);
            return res.status(500).json({
              message: "An error occurred while updating orders",
            });
          }

          return res.status(200).json({
            message:
              "Existing draw prizes deleted, random lottos selected, saved successfully, and orders updated",
            prizes: results.map((result: any, index: number) => ({
              number: result.number,
              rewardPoint: rewardPoints[index],
              seq: index + 1,
            })),
            ordersUpdated: updateResult.affectedRows,
          });
        });
      });
    });
  });
});

router.post("/draw_random_number", (req: Request, res: Response) => {
  const { rewardPoints = [] } = req.body;

  // Validate input
  if (
    !Array.isArray(rewardPoints) ||
    !rewardPoints.every((point) => typeof point === "number")
  ) {
    return res
      .status(400)
      .json({ message: "Invalid rewardPoints. Must be an array of numbers." });
  }

  const count = rewardPoints.length;
  if (count === 0) {
    return res
      .status(400)
      .json({ message: "rewardPoints array must not be empty." });
  }

  // Delete existing records from draw_prizes
  const deleteQuery = "DELETE FROM draw_prizes";
  condb.query(deleteQuery, (deleteErr: any) => {
    if (deleteErr) {
      console.error("Error deleting existing draw prizes:", deleteErr);
      return res.status(500).json({
        message: "An error occurred while deleting existing draw prizes",
      });
    }

    // Generate random numbers
    const randomNumbers: string[] = [];
    for (let i = 0; i < count; i++) {
      const randomNumber = Math.floor(Math.random() * 999999) + 1;
      const formattedNumber = randomNumber.toString().padStart(6, "0");
      randomNumbers.push(formattedNumber);
    }

    // Insert new draw prizes
    const insertQuery =
      "INSERT INTO draw_prizes (number, reward_point, seq) VALUES ?";
    const values = randomNumbers.map((number, index) => [
      number,
      rewardPoints[index],
      index + 1,
    ]);

    condb.query(insertQuery, [values], (insertErr: any) => {
      if (insertErr) {
        console.error("Error inserting draw prizes:", insertErr);
        return res.status(500).json({
          message: "An error occurred while saving the draw prizes",
        });
      }

      // Update orders with status 1 to status 2
      const updateOrdersQuery = "UPDATE orders SET status = 2 WHERE status = 1";
      condb.query(updateOrdersQuery, (updateErr: any, updateResult: any) => {
        if (updateErr) {
          console.error("Error updating orders:", updateErr);
          return res.status(500).json({
            message: "An error occurred while updating orders",
          });
        }

        return res.status(200).json({
          message:
            "Existing draw prizes deleted, new numbers generated, saved successfully, and orders updated",
          prizes: randomNumbers.map((number, index) => ({
            number,
            rewardPoint: rewardPoints[index],
            seq: index + 1,
          })),
          ordersUpdated: updateResult.affectedRows,
        });
      });
    });
  });
});
export default router;
