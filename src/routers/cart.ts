import express, { Router, Request, Response } from "express";
import condb from "../utils/connectDB";
import { MysqlError } from "mysql";
const router: Router = express.Router();

// GET current wallet balance

router.post('/add', (req: Request | any, res: Response) => {
    const { lotto_id } = req.body;
    const { id } = req.user;
  
    if (!lotto_id || !id) {
      return res.status(400).json({ message: 'Lotto ID and User ID are required' });
    }
  
    condb.beginTransaction((beginErr: MysqlError) => {
      if (beginErr) {
        console.error('Error beginning transaction:', beginErr);
        return res.status(500).json({ message: 'Failed to begin transaction' });
      }
  
      const checkCartQuery = 'SELECT cid FROM carts WHERE uid = ? AND lid = ?';
      condb.query(checkCartQuery, [id, lotto_id], (checkErr: MysqlError | null, checkResults: any[]) => {
        if (checkErr) {
          return condb.rollback(() => {
            console.error('Error checking cart:', checkErr);
            res.status(500).json({ message: 'Failed to check cart' });
          });
        }
  
        if (checkResults.length > 0) {
          return condb.rollback(() => {
            res.status(400).json({ message: 'This lotto is already in your cart and cannot be added again' });
          });
        }
  
        const addToCartQuery = 'INSERT INTO carts (uid, lid) VALUES (?, ?)';
        condb.query(addToCartQuery, [id, lotto_id], (addErr: MysqlError | null, addResult: any) => {
          if (addErr) {
            return condb.rollback(() => {
              console.error('Error adding to cart:', addErr);
              res.status(500).json({ message: 'Failed to add lotto to cart' });
            });
          }
  
          const updateLottoStatusQuery = 'UPDATE lottos SET status = ? WHERE id = ?';
          const newStatus = 2;
          condb.query(updateLottoStatusQuery, [newStatus, lotto_id], (updateErr: MysqlError | null) => {
            if (updateErr) {
              return condb.rollback(() => {
                console.error('Error updating lotto status:', updateErr);
                res.status(500).json({ message: 'Failed to update lotto status' });
              });
            }
  
            condb.commit((commitErr: MysqlError) => {
              if (commitErr) {
                return condb.rollback(() => {
                  console.error('Error committing transaction:', commitErr);
                  res.status(500).json({ message: 'Failed to commit transaction' });
                });
              }
  
              res.status(201).json({
                message: 'Lotto added to cart and status updated successfully',
                cid: addResult.insertId
              });
            });
          });
        });
      });
    });
  });

router.post('/buy', async (req: Request | any, res: Response) => {
    const { id } = req.user;
  
    if (!id) {
      return res.status(400).json({ message: 'User ID is required' });
    }
  
    condb.beginTransaction((beginErr: MysqlError) => {
      if (beginErr) {
        console.error('Error beginning transaction:', beginErr);
        return res.status(500).json({ message: 'Failed to begin transaction' });
      }
  
      // Query cart items with lotto prices
      const cartQuery = `
        SELECT c.cid, c.lid, l.price
        FROM carts c
        LEFT JOIN lottos l ON c.lid = l.id
        WHERE c.uid = ?
      `;
  
      condb.query(cartQuery, [id], (cartErr: MysqlError | null, cartResults: any[]) => {
        if (cartErr) {
          return condb.rollback(() => {
            console.error('Error querying cart:', cartErr);
            res.status(500).json({ message: 'Failed to query cart' });
          });
        }
  
        if (cartResults.length === 0) {
          return condb.rollback(() => {
            res.status(400).json({ message: 'Your cart is empty' });
          });
        }
  
        // Calculate total price
        const totalPrice = cartResults.reduce((sum, item) => sum + item.price, 0);
  
        // Check user's wallet
        const walletQuery = 'SELECT wallet FROM users WHERE id = ?';
        condb.query(walletQuery, [id], (walletErr: MysqlError | null, walletResults: any[]) => {
          if (walletErr) {
            return condb.rollback(() => {
              console.error('Error querying user wallet:', walletErr);
              res.status(500).json({ message: 'Failed to query user wallet' });
            });
          }
  
          const userWallet = walletResults[0]?.wallet || 0;
  
          if (userWallet < totalPrice) {
            return condb.rollback(() => {
              res.status(400).json({ message: 'Insufficient wallet to complete purchase' });
            });
          }
  
          // Update user wallet
          const updateWalletQuery = 'UPDATE users SET wallet = wallet - ? WHERE id = ?';
          condb.query(updateWalletQuery, [totalPrice, id], (updateWalletError: MysqlError | null) => {
            if (updateWalletError) {
              return condb.rollback(() => {
                console.error('Error updating user wallet:', updateWalletError);
                res.status(500).json({ message: 'Failed to update user wallet' });
              });
            }
  
            // Update lotto status
            const updateLottoStatusQuery = 'UPDATE lottos SET status = ? WHERE id IN (?)';
            const lottoIds = cartResults.map(item => item.lid);
  
            condb.query(updateLottoStatusQuery, [3, lottoIds], (updateLottoErr: MysqlError | null) => {
              if (updateLottoErr) {
                return condb.rollback(() => {
                  console.error('Error updating lotto status:', updateLottoErr);
                  res.status(500).json({ message: 'Failed to update lotto status' });
                });
              }
  
              // Add record to orders table
              const addOrderQuery = 'INSERT INTO `orders` (uid, date, total) VALUES (?, NOW(), ?)';
              condb.query(addOrderQuery, [id, totalPrice], (addOrderErr: MysqlError | null, addOrderResult: any) => {
                if (addOrderErr) {
                  return condb.rollback(() => {
                    console.error('Error adding order:', addOrderErr);
                    res.status(500).json({ message: 'Failed to add order' });
                  });
                }
  
                const orderId = addOrderResult.insertId;
  
                // Add records to order_items table
                const addOrderItemsQuery = 'INSERT INTO `order_items` (oid, lid, price) VALUES ?';
                const orderItemsValues = cartResults.map(item => [orderId, item.lid, item.price]);
  
                condb.query(addOrderItemsQuery, [orderItemsValues], (addOrderItemsErr: MysqlError | null) => {
                  if (addOrderItemsErr) {
                    return condb.rollback(() => {
                      console.error('Error adding order items:', addOrderItemsErr);
                      res.status(500).json({ message: 'Failed to add order items' });
                    });
                  }
  
                  // Clear cart
                  const clearCartQuery = 'DELETE FROM carts WHERE uid = ?';
                  condb.query(clearCartQuery, [id], (clearCartErr: MysqlError | null) => {
                    if (clearCartErr) {
                      return condb.rollback(() => {
                        console.error('Error clearing cart:', clearCartErr);
                        res.status(500).json({ message: 'Failed to clear cart' });
                      });
                    }
  
                    condb.commit((commitErr: MysqlError) => {
                      if (commitErr) {
                        return condb.rollback(() => {
                          console.error('Error committing transaction:', commitErr);
                          res.status(500).json({ message: 'Failed to commit transaction' });
                        });
                      }
  
                      res.status(200).json({
                        message: 'Purchase successful',
                        order_id: orderId,
                        total_price: totalPrice,
                        new_wallet: userWallet - totalPrice
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
});

router.get('/check', async (req: Request | any, res: Response) => {
  try {
    const { id } = req.user;

    if (!id) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const cartQuery = `
      SELECT l.*,c.cid
      FROM carts c
      LEFT JOIN lottos l ON c.lid = l.id
      WHERE c.uid = ?
    `;

    // ใช้ condb.query แทน condb.execute
    condb.query(cartQuery, [id], (err: any, rows: any) => {
      if (err) {
        console.error('Error querying cart:', err);
        return res.status(500).json({ message: 'An error occurred while checking the cart' });
      }

      // แปลงผลลัพธ์เป็น array ของ object
      const cartItems = rows as Array<{id: number, uid: number, product_id: number, quantity: number, price: number}>;

      if (cartItems.length === 0) {
        return res.status(200).json({ message: 'Cart is empty', items: [] });
      }

      // คำนวณยอดรวม
      const total = cartItems.reduce((sum, item) => sum + item.price, 0);

      return res.status(200).json({
        message: 'Cart items retrieved successfully',
        items: cartItems,
        total: total
      });
    });

  } catch (error) {
    console.error('Error checking cart:', error);
    return res.status(500).json({ message: 'An error occurred while checking the cart' });
  }
});

router.post('/remove', async (req: Request | any, res: Response) => {
  try {
    const { id } = req.user;
    const { cid } = req.body;

    if (!id) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    if (!cid) {
      return res.status(400).json({ message: 'Cart item ID is required' });
    }

    // Step 1: Get the lid from the cart
    const getLidQuery = 'SELECT lid FROM carts WHERE cid = ? AND uid = ?';
    condb.query(getLidQuery, [cid, id], (err: any, result: any) => {
      if (err) {
        console.error('Error getting lid from cart:', err);
        return res.status(500).json({ message: 'An error occurred while getting lid from the cart' });
      }

      if (result.length === 0) {
        return res.status(404).json({ message: 'Cart item not found or not owned by this user' });
      }

      const lid = result[0].lid;

      // Step 2: Update lotto status to 1
      const updateLottoQuery = 'UPDATE lottos SET status = 1 WHERE id = ?';
      condb.query(updateLottoQuery, [lid], (updateErr: any) => {
        if (updateErr) {
          console.error('Error updating lotto status:', updateErr);
          return res.status(500).json({ message: 'An error occurred while updating lotto status' });
        }

        // Step 3: Remove item from cart
        const removeQuery = 'DELETE FROM carts WHERE cid = ? AND uid = ?';
        condb.query(removeQuery, [cid, id], (removeErr: any, removeResult: any) => {
          if (removeErr) {
            console.error('Error removing item from cart:', removeErr);
            return res.status(500).json({ message: 'An error occurred while removing the item from the cart' });
          }

          if (removeResult.affectedRows === 0) {
            return res.status(404).json({ message: 'Cart item not found or not owned by this user' });
          }

          return res.status(200).json({ message: 'Item successfully removed from cart and lotto status updated' });
        });
      });
    });

  } catch (error) {
    console.error('Error removing item from cart:', error);
    return res.status(500).json({ message: 'An error occurred while removing the item from the cart' });
  }
});

router.get('/order/item/:oid', (req: Request, res: Response) => {
    const { oid } = req.params;
  
    if (!oid) {
      return res.status(400).json({ message: 'Order ID is required' });
    }
  
    const orderQuery = `
      SELECT o.oid, o.uid, o.date, o.total, 
             oi.lid, l.number, oi.price,
             u.first_name, u.last_name
      FROM orders o
      JOIN order_items oi ON o.oid = oi.oid
      JOIN lottos l ON oi.lid = l.id
      JOIN users u ON o.uid = u.id
      WHERE o.oid = ?
    `;
  
    condb.query(orderQuery, [oid], (err: MysqlError | null, results: any[]) => {
      if (err) {
        console.error('Error querying order details:', err);
        return res.status(500).json({ message: 'Failed to fetch order details' });
      }
  
      if (results.length === 0) {
        return res.status(404).json({ message: 'Order not found' });
      }
  
      const orderDetails = {
        order_id: results[0].oid,
        user: {
          id: results[0].uid,
          name: `${results[0].first_name} ${results[0].last_name}`
        },
        date: results[0].date,
        total: results[0].total,
        total_amount: results.length,
        items: results.map(item => ({
          lotto_id: item.lid,
          number: item.number,
          price: item.price
        }))
      };
  
      res.status(200).json(orderDetails);
    });
});

router.get('/order/me', (req: Request | any, res: Response) => {
    const { id } = req.user;
  
    if (!id) {
      return res.status(400).json({ message: 'User ID is required' });
    }
  
    const orderQuery = `
      SELECT o.oid, o.date, o.total, 
             oi.lid, oi.price, l.number
      FROM orders o
      LEFT JOIN order_items oi ON o.oid = oi.oid
      LEFT JOIN lottos l ON oi.lid = l.id
      WHERE o.uid = ?
      ORDER BY o.date DESC
    `;
  
    condb.query(orderQuery, [id], (err: MysqlError | null, results: any[]) => {
      if (err) {
        console.error('Error querying user orders:', err);
        return res.status(500).json({ message: 'Failed to fetch user orders' });
      }
  
      if (results.length === 0) {
        return res.status(404).json({ message: 'No orders found for this user' });
      }
  
      // Group results by order ID
      const groupedOrders = results.reduce((acc, curr) => {
        const order = acc.find((o: any) => o.oid === curr.oid);
        if (order) {
          order.items.push({
            lid: curr.lid,
            number: curr.number,
            price: curr.price
          });
        } else {
          acc.push({
            oid: curr.oid,
            date: curr.date,
            total: curr.total,
            items: [{
              lid: curr.lid,
              number: curr.number,
              price: curr.price
            }]
          });
        }
        return acc;
      }, []);
  
      res.status(200).json(groupedOrders);
    });
});


export default router;