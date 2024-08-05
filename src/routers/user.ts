import express, { Router, Request, Response } from 'express';

const router: Router = express.Router();

// GET all users
router.get('/', (req: Request, res: Response) => {
  res.json({ message: 'GET all users' });
});

// GET a specific user
router.get('/:id', (req: Request, res: Response) => {
  const userId = req.params.id;
  res.json({ message: `GET user with id ${userId}` });
});

// PUT update a user
router.put('/:id', (req: Request, res: Response) => {
  const userId = req.params.id;
  const userData = req.body;
  res.json({ message: `UPDATE user with id ${userId}`, data: userData });
});

// DELETE a user
router.delete('/:id', (req: Request, res: Response) => {
  const userId = req.params.id;
  res.json({ message: `DELETE user with id ${userId}` });
});

export default router;