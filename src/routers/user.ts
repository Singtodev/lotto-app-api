import express, { Router, Request, Response } from 'express';
import condb from '../utils/connectDB';
import { MysqlError } from 'mysql';

const router: Router = express.Router();

// GET all users
router.get('/', (req: Request, res: Response) => {
  try {
    condb.query('SELECT * FROM users', (err: MysqlError | null, results: any) => {
      if (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal Server Error' });
      } else {
        res.json({ message: 'GET all users', data: results });
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// GET a specific user
router.get('/:id', (req: Request, res: Response) => {
  const userId = req.params.id;
  try {
    condb.query('SELECT * FROM users WHERE id = ?', [userId], (err: MysqlError | null, results: any) => {
      if (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal Server Error' });
      } else if (results.length === 0) {
        res.status(404).json({ message: `User with ID ${userId} not found` });
      } else {
        res.json({ message: `GET user with id ${userId}`, data: results[0] });
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// PUT update a user
router.put('/:id', (req: Request, res: Response) => {
  const userId = req.params.id;
  const userData = req.body;

  try {
    condb.query('SELECT * FROM users WHERE id = ?', [userId], (err: MysqlError | null, results: any) => {
      if (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal Server Error' });
      } else if (results.length === 0) {
        res.status(404).json({ message: `User with ID ${userId} not found` });
      } else {
        // Merge the existing user data with the new data
        const updatedUserData = { ...results[0], ...userData };

        condb.query('UPDATE users SET ? WHERE id = ?', [updatedUserData, userId], (err: MysqlError | null, results: any) => {
          if (err) {
            console.error(err);
            res.status(500).json({ message: 'Internal Server Error' });
          } else {
            res.json({ message: `UPDATE user with id ${userId}`, data: updatedUserData });
          }
        });
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// DELETE a user
router.delete('/:id', (req: Request, res: Response) => {
  const userId = req.params.id;
  try {
    condb.query('DELETE FROM users WHERE id = ?', [userId], (err: MysqlError | null, results: any) => {
      if (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal Server Error' });
      } else if (results.affectedRows === 0) {
        res.status(404).json({ message: `User with ID ${userId} not found` });
      } else {
        res.json({ message: `DELETE user with id ${userId}` });
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;