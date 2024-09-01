import express, { Router, Request, Response } from "express";
import condb from "../utils/connectDB";
import { MysqlError } from "mysql";

const router: Router = express.Router();

// Get all lotto
router.get("/", (req: Request, res: Response) => {
  try {
    const searchNumber = req.query.number;
    let query = "SELECT * FROM lottos";
    let queryParams: any[] = [];

    if (searchNumber) {
      query += " WHERE number LIKE ?";
      queryParams.push(`%${searchNumber}%`);
    }

    condb.query(query, queryParams, (err: MysqlError | null, results: any) => {
      if (err) {
        console.error(err);
        res.status(500).json({ message: "Internal Server Error" });
      } else {
        res.json({ message: "Lotto data retrieved", data: results });
      }
    });
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
  if (!number) {
    return res.status(400).json({ message: "number is required" });
  }

  const checkPrizeQuery = `
    SELECT dpid, number, reward_point, seq
    FROM draw_prizes
    WHERE number = ?
  `;

  condb.query(checkPrizeQuery, [number], (err: any, results: any) => {
    if (err) {
      console.error("Error checking lotto:", err);
      return res
        .status(500)
        .json({ message: "An error occurred while checking the lotto" });
    }

    if (results.length === 0) {
      // ไม่ถูกรางวัล - อัพเดตสถานะเป็น 4
      const updateLottoQuery = `
        UPDATE lottos
        SET status = 4
        WHERE number = ?
      `;

      condb.query(
        updateLottoQuery,
        [number],
        (updateErr: any, updateResult: any) => {
          if (updateErr) {
            console.error("Error updating lotto status:", updateErr);
            return res.status(500).json({
              message: "An error occurred while updating lotto status",
            });
          }

          return res.status(200).json({
            message: "Lotto checked successfully",
            result: {
              number: number,
              win: false,
              status: 4,
            },
          });
        }
      );
    } else {
      const prize = results[0];
      return res.status(200).json({
        message: "Lotto checked successfully",
        result: {
          dpid: prize.dpid,
          number: prize.number,
          reward_point: prize.reward_point,
          seq: prize.seq,
          win: true,
        },
      });
    }
  });
});

router.post("/redeem", (req: Request | any, res: Response) => {
  const { id } = req.user;
  const { number } = req.body;

  if (!number) {
    return res.status(400).json({ message: "number is required" });
  }

  // ตรวจสอบว่าเลขนี้อยู่ในตะกร้าของผู้ใช้ที่ร้องขอหรือไม่ และตรวจสอบสถานะ
  const query = `
    SELECT c.oid, o.uid, l.number, c.lid, u.wallet, l.status
    FROM carts c
    JOIN orders o ON c.oid = o.oid
    JOIN lottos l ON c.lid = l.id
    JOIN users u ON o.uid = u.id
    WHERE l.number = ?
  `;

  condb.query(query, [number], (err: any, results: any) => {
    if (err) {
      console.error("Error checking lotto ownership:", err);
      return res
        .status(500)
        .json({ message: "An error occurred while checking lotto ownership" });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "ลอตเตอรี่ยังไม่ถูกคนซื้อ" });
    }

    const { uid, lid, wallet, status } = results[0];

    // ตรวจสอบว่าเป็นของผู้ใช้ที่ร้องขอหรือไม่
    if (uid != id) {
      return res.status(403).json({ message: "ไม่ใช่ลอตเตอรี่ของคุณ" });
    }

    // เช็คสถานะของ lotto
    if (status == 3) {
      return res.status(400).json({ message: "ลอตเตอรี่ถูกรับรางวัลแล้ว" });
    }

    if (status != 2) {
      return res.status(400).json({ message: "ต้องมีคนซื้อก่อน" });
    }

    // ตรวจสอบรางวัลจาก draw_prizes
    const prizeQuery = `
      SELECT reward_point
      FROM draw_prizes
      WHERE number = ?
    `;

    condb.query(prizeQuery, [number], (prizeErr: any, prizeResults: any) => {
      if (prizeErr) {
        console.error("Error checking prize:", prizeErr);
        return res
          .status(500)
          .json({ message: "An error occurred while checking prize" });
      }

      if (prizeResults.length === 0) {
        return res.status(404).json({ message: "ไม่ถูกรางวัล" });
      }

      const rewardPoint = prizeResults[0].reward_point;
      const newWallet = wallet + rewardPoint;

      // เริ่ม transaction
      condb.beginTransaction((beginErr: any) => {
        if (beginErr) {
          console.error("Error beginning transaction:", beginErr);
          return res
            .status(500)
            .json({ message: "An error occurred while beginning transaction" });
        }

        // อัพเดท wallet ของ user
        const updateUserQuery = `
          UPDATE users
          SET wallet = ?
          WHERE id = ?
        `;

        condb.query(updateUserQuery, [newWallet, id], (updateUserErr: any) => {
          if (updateUserErr) {
            console.error("Error updating user wallet:", updateUserErr);
            return condb.rollback(() => {
              res.status(500).json({
                message: "An error occurred while updating user wallet",
              });
            });
          }

          // อัพเดทสถานะของล็อตเตอรี่
          const updateLottoQuery = `
            UPDATE lottos
            SET status = 3
            WHERE id = ?
          `;

          condb.query(updateLottoQuery, [lid], (updateLottoErr: any) => {
            if (updateLottoErr) {
              console.error("Error updating lotto status:", updateLottoErr);
              return condb.rollback(() => {
                res.status(500).json({
                  message: "An error occurred while updating lotto status",
                });
              });
            }

            // Commit transaction
            condb.commit((commitErr: any) => {
              if (commitErr) {
                console.error("Error committing transaction:", commitErr);
                return condb.rollback(() => {
                  res.status(500).json({
                    message: "An error occurred while committing transaction",
                  });
                });
              }

              // ส่งผลลัพธ์กลับ
              return res.status(200).json({
                message: "Lotto redeemed successfully",
                result: {
                  number: number,
                  reward_point: rewardPoint,
                  new_total_wallet: newWallet,
                  lotto_status: 3,
                },
              });
            });
          });
        });
      });
    });
  });
});

router.get("/prizes/reward/getall", (req: Request, res: Response) => {
  const query = `
    SELECT *
    FROM draw_prizes
    ORDER BY seq ASC
  `;

  condb.query(query, (err: any, results: any) => {
    if (err) {
      console.error("Error fetching prizes:", err);
      return res
        .status(500)
        .json({ message: "An error occurred while fetching prizes" });
    }

    return res.status(200).json({
      message: "Prizes fetched successfully",
      prizes: results,
    });
  });
});
export default router;
