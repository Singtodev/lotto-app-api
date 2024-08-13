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
    const tables = ["order_items", "orders", "lottos", "users", "draw_prizes" , "carts"];

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
          1,
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
  const { count = 1, rewardPoints = [], date = new Date() } = req.body;

  // Validate input
  if (!Number.isInteger(count) || count <= 0) {
    return res
      .status(400)
      .json({ message: "Invalid count. Must be a positive integer." });
  }
  if (
    !Array.isArray(rewardPoints) ||
    !rewardPoints.every((point) => typeof point === "number")
  ) {
    return res
      .status(400)
      .json({ message: "Invalid rewardPoints. Must be an array of numbers." });
  }
  if (isNaN(new Date(date).getTime())) {
    return res.status(400).json({ message: "Invalid date." });
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

    // Get the current max seq for the given date
    const getMaxSeqQuery =
      "SELECT MAX(seq) as maxSeq FROM draw_prizes WHERE DATE(date) = DATE(?)";
    condb.query(
      getMaxSeqQuery,
      [new Date(date)],
      (seqErr: any, seqResults: any) => {
        if (seqErr) {
          console.error("Error getting max seq:", seqErr);
          return res
            .status(500)
            .json({ message: "An error occurred while getting max sequence" });
        }

        const maxSeq = seqResults[0].maxSeq || 0;

        const insertQuery =
          "INSERT INTO draw_prizes (date, number, reward_point, seq) VALUES ?";
        const values = results.map((result: any, index: number) => [
          new Date(date),
          result.number,
          rewardPoints[index] || 0,
          maxSeq + index + 1,
        ]);

        condb.query(insertQuery, [values], (insertErr: any) => {
          if (insertErr) {
            console.error("Error inserting draw prizes:", insertErr);
            return res.status(500).json({
              message: "An error occurred while saving the draw prizes",
            });
          }

          return res.status(200).json({
            message: "Random lottos selected and saved successfully",
            prizes: results.map((result: any, index: number) => ({
              number: result.number,
              rewardPoint: rewardPoints[index] || 0,
              seq: maxSeq + index + 1,
            })),
          });
        });
      }
    );
  });
});

router.post("/draw_random_number", (req: Request, res: Response) => {
  const { count = 1, rewardPoints = [], date = new Date() } = req.body;

  // Validate input
  if (!Number.isInteger(count) || count <= 0) {
    return res
      .status(400)
      .json({ message: "Invalid count. Must be a positive integer." });
  }
  if (
    !Array.isArray(rewardPoints) ||
    !rewardPoints.every((point) => typeof point === "number")
  ) {
    return res
      .status(400)
      .json({ message: "Invalid rewardPoints. Must be an array of numbers." });
  }
  if (isNaN(new Date(date).getTime())) {
    return res.status(400).json({ message: "Invalid date." });
  }

  // Get the current max seq for the given date
  const getMaxSeqQuery =
    "SELECT MAX(seq) as maxSeq FROM draw_prizes WHERE DATE(date) = DATE(?)";
  condb.query(
    getMaxSeqQuery,
    [new Date(date)],
    (seqErr: any, seqResults: any) => {
      if (seqErr) {
        console.error("Error getting max seq:", seqErr);
        return res
          .status(500)
          .json({ message: "An error occurred while getting max sequence" });
      }

      const maxSeq = seqResults[0].maxSeq || 0;

      const randomNumbers: string[] = [];

      for (let i = 0; i < count; i++) {
        const randomNumber = Math.floor(Math.random() * 999999) + 1;
        const formattedNumber = randomNumber.toString().padStart(6, "0");
        randomNumbers.push(formattedNumber);
      }

      const insertQuery =
        "INSERT INTO draw_prizes (date, number, reward_point, seq) VALUES ?";
      const values = randomNumbers.map((number, index) => [
        new Date(date),
        number,
        rewardPoints[index] || 0,
        maxSeq + index + 1,
      ]);

      condb.query(insertQuery, [values], (err: any) => {
        if (err) {
          console.error("Error inserting draw prizes:", err);
          return res.status(500).json({
            message: "An error occurred while saving the draw prizes",
          });
        }

        return res.status(200).json({
          message: "Random numbers generated and saved successfully",
          prizes: randomNumbers.map((number, index) => ({
            number,
            rewardPoint: rewardPoints[index] || 0,
            seq: maxSeq + index + 1,
          })),
        });
      });
    }
  );
});

export default router;
