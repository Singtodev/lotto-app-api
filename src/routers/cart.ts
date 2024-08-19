import express, { Router, Request, Response } from "express";
import condb from "../utils/connectDB";
import { MysqlError } from "mysql";
const router: Router = express.Router();

// GET current wallet balance

router.post('/add', (req: Request | any, res: Response) => {
  const { lotto_id } = req.body;
  const { id } = req.user;

  // ตรวจสอบว่ามี order ที่มี status = 0 สำหรับ user นี้หรือไม่
  const checkOrderQuery = "SELECT oid FROM orders WHERE uid = ? AND status = 0 LIMIT 1";


  condb.query(checkOrderQuery, [id], (checkErr: MysqlError | null, checkResults: any) => {
    if (checkErr) {
      console.error('เกิดข้อผิดพลาดในการตรวจสอบ order:', checkErr);
      return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเพิ่มสลากเข้าตะกร้า' });
    }

    let orderId: number;

    if (checkResults.length === 0) {
      // ถ้าไม่มี order ที่มี status = 0 ให้สร้าง order ใหม่
      const createOrderQuery = "INSERT INTO orders (uid, date, total, status) VALUES (?, CURRENT_TIMESTAMP, 0, 0)";
      condb.query(createOrderQuery, [id], (createErr: MysqlError | null, createResult: any) => {
        if (createErr) {
          console.error('เกิดข้อผิดพลาดในการสร้าง order:', createErr);
          return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเพิ่มสลากเข้าตะกร้า' });
        }
        orderId = createResult.insertId;
        checkLottoStatus(orderId);
      });
    } else {
      // ถ้ามี order ที่มี status = 0 อยู่แล้ว ให้ใช้ order นั้น
      orderId = checkResults[0].oid;
      console.log(orderId);
      checkLottoStatus(orderId);
    }
  });

  function checkLottoStatus(orderId: number) {
    // ตรวจสอบ status ของสลากในตาราง lottos
    const checkLottoQuery = "SELECT status FROM lottos WHERE id = ? LIMIT 1";
    condb.query(checkLottoQuery, [lotto_id], (lottoErr: MysqlError | null, lottoResults: any) => {
      if (lottoErr) {
        console.error('เกิดข้อผิดพลาดในการตรวจสอบสถานะสลาก:', lottoErr);
        return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเพิ่มสลากเข้าตะกร้า' });
      }

      if (lottoResults.length === 0) {
        return res.status(404).json({ message: 'ไม่พบสลากที่ระบุ' });
      }

      if (lottoResults[0].status == 1) {
        return res.status(400).json({ message: 'สลากนี้ถูกจองแล้ว ไม่สามารถเพิ่มได้' });
      }

      if (lottoResults[0].status == 2) {
        return res.status(400).json({ message: 'สลากนี้มีคนซื้อแล้ว ไม่สามารถเพิ่มได้' });
      }

      if (lottoResults[0].status == 3) {
        return res.status(400).json({ message: 'สลากนี้หมดอายุ ไม่สามารถเพิ่มได้' });
      }

      // ถ้า status เป็น 0 ให้ดำเนินการต่อ
      checkDuplicateAndAddToCart(orderId);
    });
  }

  function checkDuplicateAndAddToCart(orderId: number) {
    // ตรวจสอบว่าสลากนี้มีอยู่ในตะกร้าแล้วหรือไม่
    const checkDuplicateQuery = "SELECT cid FROM carts WHERE lid = ? AND oid = ?";
    condb.query(checkDuplicateQuery, [lotto_id, orderId], (dupErr: MysqlError | null, dupResults: any) => {
      if (dupErr) {
        console.error('เกิดข้อผิดพลาดในการตรวจสอบสลากซ้ำ:', dupErr);
        return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเพิ่มสลากเข้าตะกร้า' });
      }

      if (dupResults.length > 0) {
        // ถ้าพบสลากซ้ำ
        return res.status(400).json({ message: 'สลากนี้มีอยู่ในตะกร้าแล้ว ไม่สามารถเพิ่มซ้ำได้' });
      }

      // ถ้าไม่ซ้ำ ให้เพิ่มเข้าตะกร้า
      addToCart(orderId);
    });
  }

  function addToCart(orderId: number) {
    // สร้าง record ใหม่ใน cart table และอัปเดต status ของสลากเป็น 1
    condb.beginTransaction((beginErr: MysqlError | null) => {
      if (beginErr) {
        console.error('เกิดข้อผิดพลาดในการเริ่ม transaction:', beginErr);
        return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเพิ่มสลากเข้าตะกร้า' });
      }

      const addToCartQuery = "INSERT INTO carts (lid, oid) VALUES (?, ?)";
      condb.query(addToCartQuery, [lotto_id, orderId], (addErr: MysqlError | null, addResult: any) => {
        if (addErr) {
          return condb.rollback(() => {
            console.error('เกิดข้อผิดพลาดในการเพิ่มสลากเข้าตะกร้า:', addErr);
            res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเพิ่มสลากเข้าตะกร้า' });
          });
        }

        const updateLottoStatusQuery = "UPDATE lottos SET status = 1 WHERE id = ?";
        condb.query(updateLottoStatusQuery, [lotto_id], (updateErr: MysqlError | null) => {
          if (updateErr) {
            return condb.rollback(() => {
              console.error('เกิดข้อผิดพลาดในการอัปเดตสถานะสลาก:', updateErr);
              res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเพิ่มสลากเข้าตะกร้า' });
            });
          }

          condb.commit((commitErr: MysqlError | null) => {
            if (commitErr) {
              return condb.rollback(() => {
                console.error('เกิดข้อผิดพลาดในการ commit transaction:', commitErr);
                res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเพิ่มสลากเข้าตะกร้า' });
              });
            }
            res.status(200).json({ message: 'เพิ่มสลากเข้าตะกร้าสำเร็จ', cid: addResult.insertId });
          });
        });
      });
    });
  }
});

router.post('/buy', (req: Request | any, res: Response) => {
  const { id } = req.user;

  if (!id) {
    return res.status(400).json({ message: 'User ID is required' });
  }

  // ตรวจสอบ order ล่าสุดที่มี status = 0
  const checkOrderQuery = "SELECT oid FROM orders WHERE uid = ? AND status = 0 ORDER BY date DESC LIMIT 1";
  condb.query(checkOrderQuery, [id], (orderErr: MysqlError | null, orderResults: any) => {
    if (orderErr) {
      console.error('เกิดข้อผิดพลาดในการตรวจสอบ order:', orderErr);
      return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการตรวจสอบ order' });
    }

    if (orderResults.length === 0) {
      return res.status(400).json({ message: 'ไม่พบรายการสั่งซื้อที่รอการชำระเงิน' });
    }

    const orderId = orderResults[0].oid;

    // ตรวจสอบว่ามีสินค้าในตะกร้าอย่างน้อย 1 รายการ
    const checkCartItemsQuery = "SELECT COUNT(*) as itemCount FROM carts WHERE oid = ?";
    condb.query(checkCartItemsQuery, [orderId], (cartErr: MysqlError | null, cartResults: any) => {
      if (cartErr) {
        console.error('เกิดข้อผิดพลาดในการตรวจสอบรายการในตะกร้า:', cartErr);
        return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการตรวจสอบรายการในตะกร้า' });
      }

      const itemCount = cartResults[0].itemCount;
      if (itemCount === 0) {
        return res.status(400).json({ message: 'ตะกร้าสินค้าว่างเปล่า กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการก่อนทำการซื้อ' });
      }

      // คำนวณยอดรวมจากตะกร้าสินค้า โดยใช้ price จากตาราง lottos
      const calculateTotalQuery = `
        SELECT SUM(l.price) as total 
        FROM carts c 
        JOIN lottos l ON c.lid = l.id 
        WHERE c.oid = ?`;
      condb.query(calculateTotalQuery, [orderId], (totalErr: MysqlError | null, totalResults: any) => {
        if (totalErr) {
          console.error('เกิดข้อผิดพลาดในการคำนวณยอดรวม:', totalErr);
          return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการคำนวณยอดรวม' });
        }

        const totalAmount = totalResults[0].total || 0;

        // ตรวจสอบยอดเงินในกระเป๋า
        const checkWalletQuery = "SELECT wallet FROM users WHERE id = ?";
        condb.query(checkWalletQuery, [id], (walletErr: MysqlError | null, walletResults: any) => {
          if (walletErr) {
            console.error('เกิดข้อผิดพลาดในการตรวจสอบกระเป๋าเงิน:', walletErr);
            return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการตรวจสอบกระเป๋าเงิน' });
          }

          const walletAmount = walletResults[0].wallet;

          if (walletAmount < totalAmount) {
            return res.status(400).json({ message: 'ยอดเงินในกระเป๋าไม่เพียงพอ' });
          }

          // เริ่ม transaction
          condb.beginTransaction((beginErr: MysqlError) => {
            if (beginErr) {
              console.error('เกิดข้อผิดพลาดในการเริ่ม transaction:', beginErr);
              return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเริ่มกระบวนการซื้อ' });
            }

            // อัปเดตสถานะ order และยอดเงิน
            const updateOrderQuery = "UPDATE orders SET status = 1, total = ? WHERE oid = ?";
            condb.query(updateOrderQuery, [totalAmount, orderId], (updateOrderErr: MysqlError | null) => {
              if (updateOrderErr) {
                return condb.rollback(() => {
                  console.error('เกิดข้อผิดพลาดในการอัปเดต order:', updateOrderErr);
                  res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัปเดต order' });
                });
              }

              const updateWalletQuery = "UPDATE users SET wallet = wallet - ? WHERE id = ?";
              condb.query(updateWalletQuery, [totalAmount, id], (updateWalletErr: MysqlError | null) => {
                if (updateWalletErr) {
                  return condb.rollback(() => {
                    console.error('เกิดข้อผิดพลาดในการอัปเดตกระเป๋าเงิน:', updateWalletErr);
                    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัปเดตกระเป๋าเงิน' });
                  });
                }

                // อัปเดตสถานะของ lottos เป็น 2
                const updateLottosQuery = `
                  UPDATE lottos l
                  JOIN carts c ON l.id = c.lid
                  SET l.status = 2
                  WHERE c.oid = ?`;
                condb.query(updateLottosQuery, [orderId], (updateLottosErr: MysqlError | null) => {
                  if (updateLottosErr) {
                    return condb.rollback(() => {
                      console.error('เกิดข้อผิดพลาดในการอัปเดตสถานะ lottos:', updateLottosErr);
                      res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัปเดตสถานะ lottos' });
                    });
                  }

                  condb.commit((commitErr: MysqlError) => {
                    if (commitErr) {
                      return condb.rollback(() => {
                        console.error('เกิดข้อผิดพลาดในการ commit transaction:', commitErr);
                        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการยืนยันการซื้อ' });
                      });
                    }
                    res.status(200).json({ message: 'ซื้อสลากสำเร็จ', orderId, totalAmount });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});

router.post('/remove', async (req: Request | any, res: Response) => {
  const { id } = req.user;
  const { cid } = req.body;

  if (!id) {
    return res.status(400).json({ message: 'User ID is required' });
  }

  if (!cid) {
    return res.status(400).json({ message: 'Cart item ID is required' });
  }

  try {
    // ตรวจสอบว่ารายการในตะกร้าเป็นของผู้ใช้หรือไม่
    const checkOwnershipQuery = `
      SELECT c.cid, c.lid
      FROM carts c
      JOIN orders o ON c.oid = o.oid
      WHERE c.cid = ? AND o.uid = ? AND o.status = 0
    `;

    condb.query(checkOwnershipQuery, [cid, id], (ownershipErr: MysqlError | null, ownershipResults: any) => {
      if (ownershipErr) {
        console.error('เกิดข้อผิดพลาดในการตรวจสอบความเป็นเจ้าของ:', ownershipErr);
        return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการตรวจสอบความเป็นเจ้าของ' });
      }

      if (ownershipResults.length === 0) {
        return res.status(404).json({ message: 'ไม่พบรายการในตะกร้าหรือคุณไม่มีสิทธิ์ลบรายการนี้' });
      }

      const lid = ownershipResults[0].lid;

      // ถ้ารายการเป็นของผู้ใช้ ดำเนินการลบ
      const removeItemQuery = `
        DELETE FROM carts
        WHERE cid = ?
      `;

      condb.query(removeItemQuery, [cid], (removeErr: MysqlError | null, removeResults: any) => {
        if (removeErr) {
          console.error('เกิดข้อผิดพลาดในการลบรายการจากตะกร้า:', removeErr);
          return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการลบรายการจากตะกร้า' });
        }

        if (removeResults.affectedRows === 0) {
          return res.status(404).json({ message: 'ไม่สามารถลบรายการได้ อาจเกิดจากรายการถูกลบไปแล้ว' });
        }

        // หลังจากลบสำเร็จ อัปเดตสถานะของ lotto กลับเป็น available (0)
        const updateLottoStatusQuery = `
          UPDATE lottos
          SET status = 0
          WHERE id = ?
        `;

        condb.query(updateLottoStatusQuery, [lid], (updateErr: MysqlError | null, updateResults: any) => {
          if (updateErr) {
            console.error('เกิดข้อผิดพลาดในการอัปเดตสถานะลอตเตอรี่:', updateErr);
            return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัปเดตสถานะลอตเตอรี่' });
          }

          res.status(200).json({ message: 'ลบรายการออกจากตะกร้าและอัปเดตสถานะลอตเตอรี่สำเร็จ' });
        });
      });
    });
  } catch (error) {
    console.error('เกิดข้อผิดพลาดที่ไม่คาดคิด:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดที่ไม่คาดคิด' });
  }
});

router.get('/check', async (req: Request | any, res: Response) => {
  try {
    const { id } = req.user;

    if (!id) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // ค้นหา order ล่าสุดของผู้ใช้ที่มี status เป็น 0
    const getLatestOrderQuery = `
      SELECT oid
      FROM orders
      WHERE uid = ? AND status = 0
      ORDER BY date DESC 
      LIMIT 1
    `;

    condb.query(getLatestOrderQuery, [id], (orderErr: MysqlError | null, orderResults: any) => {
      if (orderErr) {
        console.error('เกิดข้อผิดพลาดในการค้นหา order ล่าสุด:', orderErr);
        return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการค้นหา order ล่าสุด' });
      }

      if (orderResults.length === 0) {
        return res.status(404).json({ message: 'ไม่มีสินค้าในตระกร้า' });
      }

      const latestOrderId = orderResults[0].oid;

      // ดึงข้อมูลจาก carts และ lottos ที่เกี่ยวข้องกับ order ล่าสุด
      const getCartItemsQuery = `
        SELECT c.cid, c.lid as id, l.number, l.price, l.expired_date, l.status
        FROM carts c
        JOIN lottos l ON c.lid = l.id
        WHERE c.oid = ?
      `;

      condb.query(getCartItemsQuery, [latestOrderId], (cartErr: MysqlError | null, cartResults: any) => {
        if (cartErr) {
          console.error('เกิดข้อผิดพลาดในการดึงข้อมูลจากตะกร้า:', cartErr);
          return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลจากตะกร้า' });
        }

        // คำนวณยอดรวม
        const totalAmount = cartResults.reduce((sum: number, item: any) => sum + parseFloat(item.price), 0);

        const response = {
          message: "ตรวจสอบตระกร้า",
          orderId: latestOrderId,
          items: cartResults,
          totalAmount: totalAmount.toFixed(2)
        };

        res.status(200).json(response);
      });
    });
  } catch (error) {
    console.error('เกิดข้อผิดพลาดที่ไม่คาดคิด:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดที่ไม่คาดคิด' });
  }
});

router.get('/order/item/:oid', (req: Request, res: Response) => {
  const { oid } = req.params;

  if (!oid) {
    return res.status(400).json({ message: 'Order ID is required' });
  }

  // Query to get order items and related lotto information
  const getOrderItemsQuery = `
    SELECT c.cid, c.lid as id, l.number, l.price, l.expired_date, l.status
    FROM carts c
    JOIN lottos l ON c.lid = l.id
    WHERE c.oid = ?
  `;

  condb.query(getOrderItemsQuery, [oid], (err: MysqlError | null, results: any) => {
    if (err) {
      console.error('เกิดข้อผิดพลาดในการดึงข้อมูลรายการสั่งซื้อ:', err);
      return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายการสั่งซื้อ' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'ไม่พบรายการสั่งซื้อสำหรับ Order ID นี้' });
    }

    // Calculate total amount
    const totalAmount = results.reduce((sum: number, item: any) => sum + parseFloat(item.price), 0);

    const response = {
      message: "รายการสินค้าในคำสั่งซื้อ",
      orderId: oid,
      items: results,
      totalAmount: totalAmount.toFixed(2)
    };

    res.status(200).json(response);
  });
});

router.get('/order/me', (req: Request | any, res: Response) => {
  try {
    const { id } = req.user;

    if (!id) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const getUserOrdersQuery = `
      SELECT 
        o.oid, 
        o.date as order_date, 
        o.status as order_status,
        c.cid, 
        l.id as lotto_id, 
        l.number, 
        l.price, 
        l.expired_date, 
        l.status as lotto_status
      FROM orders o
      JOIN carts c ON o.oid = c.oid
      JOIN lottos l ON c.lid = l.id
      WHERE o.uid = ?
      ORDER BY o.date DESC
    `;

    condb.query(getUserOrdersQuery, [id], (err: MysqlError | null, results: any) => {
      if (err) {
        console.error('เกิดข้อผิดพลาดในการดึงข้อมูลรายการสั่งซื้อ:', err);
        return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายการสั่งซื้อ' });
      }

      if (results.length === 0) {
        return res.status(404).json({ message: 'ไม่พบรายการสั่งซื้อสำหรับผู้ใช้นี้' });
      }

      // Group results by order
      const groupedOrders = results.reduce((acc: any, item: any) => {
        if (!acc[item.oid]) {
          acc[item.oid] = {
            orderId: item.oid,
            orderDate: item.order_date,
            orderStatus: item.order_status,
            items: [],
            totalAmount: 0
          };
        }
        
        acc[item.oid].items.push({
          cartId: item.cid,
          lottoId: item.lotto_id,
          number: item.number,
          price: parseFloat(item.price),
          expiredDate: item.expired_date,
          lottoStatus: item.lotto_status
        });

        acc[item.oid].totalAmount += parseFloat(item.price);
        return acc;
      }, {});

      const orders = Object.values(groupedOrders).map((order: any) => ({
        ...order,
        totalAmount: order.totalAmount.toFixed(2)
      }));

      const response = {
        message: "รายการสั่งซื้อทั้งหมดของคุณ",
        orders: orders
      };

      res.status(200).json(response);
    });
  } catch (error) {
    console.error('เกิดข้อผิดพลาดที่ไม่คาดคิด:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดที่ไม่คาดคิด' });
  }
});


export default router;