import express, { Router, Request, Response } from "express";
import condb from "../utils/connectDB";
import { MysqlError } from "mysql";
const router: Router = express.Router();

// GET current wallet balance
router.get("/get_wallet", (req: Request | any, res: Response) => {
  const { phone } = req.user;
  try {
    condb.query(
      "SELECT wallet FROM users WHERE phone = ?",
      [phone],
      (error: MysqlError | null, results: any) => {
        if (error) {
          console.error("Error finding user:", error);
          return res
            .status(500)
            .json({ message: "An error occurred while fetching wallet balance" });
        }

        if (!Array.isArray(results) || results.length === 0) {
          return res.status(404).json({ message: "User not found" });
        }

        const user = results[0];
        res.json({ message: "Current wallet balance", wallet: user.wallet });
      }
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// POST increase wallet
router.post("/increase", (req: Request | any, res: Response) => {
  const { phone } = req.user;
  const { amount } = req.body;

  if (!amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ message: "Invalid amount" });
  }

  try {
    condb.beginTransaction((err: MysqlError | null) => {
      if (err) {
        console.error("Error starting transaction:", err);
        return res.status(500).json({ message: "An error occurred while processing the request" });
      }

      condb.query(
        "UPDATE users SET wallet = wallet + ? WHERE phone = ?",
        [amount, phone],
        (error: MysqlError | null, result: any) => {
          if (error) {
            return condb.rollback(() => {
              console.error("Error increasing wallet:", error);
              res.status(500).json({ message: "An error occurred while increasing wallet" });
            });
          }

          if (result.affectedRows === 0) {
            return condb.rollback(() => {
              res.status(404).json({ message: "User not found" });
            });
          }

          condb.query(
            "SELECT wallet FROM users WHERE phone = ?",
            [phone],
            (selectError: MysqlError | null, results: any) => {
              if (selectError) {
                return condb.rollback(() => {
                  console.error("Error fetching updated wallet:", selectError);
                  res.status(500).json({ message: "An error occurred while fetching updated wallet" });
                });
              }

              condb.commit((commitError: MysqlError | null) => {
                if (commitError) {
                  return condb.rollback(() => {
                    console.error("Error committing transaction:", commitError);
                    res.status(500).json({ message: "An error occurred while completing the transaction" });
                  });
                }

                const updatedWallet = results[0].wallet;
                res.json({ message: "Wallet increased successfully", amount, wallet: updatedWallet });
              });
            }
          );
        }
      );
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// POST decrease wallet
router.post("/decrease", (req: Request | any, res: Response) => {
  const { phone } = req.user;
  const { amount } = req.body;

  if (!amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ message: "Invalid amount" });
  }

  try {
    condb.beginTransaction((err: MysqlError | null) => {
      if (err) {
        console.error("Error starting transaction:", err);
        return res.status(500).json({ message: "An error occurred while processing the request" });
      }

      condb.query(
        "UPDATE users SET wallet = wallet - ? WHERE phone = ? AND wallet >= ?",
        [amount, phone, amount],
        (error: MysqlError | null, result: any) => {
          if (error) {
            return condb.rollback(() => {
              console.error("Error decreasing wallet:", error);
              res.status(500).json({ message: "An error occurred while decreasing wallet" });
            });
          }

          if (result.affectedRows === 0) {
            return condb.rollback(() => {
              res.status(400).json({ message: "Insufficient funds or user not found" });
            });
          }

          condb.query(
            "SELECT wallet FROM users WHERE phone = ?",
            [phone],
            (selectError: MysqlError | null, results: any) => {
              if (selectError) {
                return condb.rollback(() => {
                  console.error("Error fetching updated wallet:", selectError);
                  res.status(500).json({ message: "An error occurred while fetching updated wallet" });
                });
              }

              condb.commit((commitError: MysqlError | null) => {
                if (commitError) {
                  return condb.rollback(() => {
                    console.error("Error committing transaction:", commitError);
                    res.status(500).json({ message: "An error occurred while completing the transaction" });
                  });
                }

                const updatedWallet = results[0].wallet;
                res.json({ message: "Wallet decreased successfully", amount, wallet: updatedWallet });
              });
            }
          );
        }
      );
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});


export default router;