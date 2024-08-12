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
  const lottoId = req.params.id;
  const lottoData = req.body;
  try {
    condb.query('SELECT * FROM lottos WHERE id = ?', [lottoId], (err: MysqlError | null, results: any) => {
      if (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal Server Error' });
      } else if (results.length === 0) {
        res.status(404).json({ message: `Lotto with ID ${lottoId} not found` });
      } else {
        const updatedLottoData = { ...results[0], ...lottoData };
        condb.query('UPDATE lottos SET ? WHERE id = ?', [updatedLottoData, lottoId], (updateErr: MysqlError | null, updateResults: any) => {
          if (updateErr) {
            console.error(updateErr);
            res.status(500).json({ message: 'Internal Server Error' });
          } else {
            res.json({ 
              message: `Updated lotto with id ${lottoId}`, 
              data: updatedLottoData 
            });
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
  const id = req.params.id;
  try {
    condb.query('DELETE FROM lottos WHERE id = ?', [id], (err: MysqlError | null, result: any) => {
      if (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal Server Error' });
      } else if (result.affectedRows === 0) {
        res.status(404).json({ message: 'Lotto not found' });
      } else {
        res.json({ message: `Lotto with ID ${id} deleted` });
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


export default router;