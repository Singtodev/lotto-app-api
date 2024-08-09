import express, { Router, Request, Response } from 'express';
import { csrfProtection } from '../middlewares/csrfMiddleware';

const router: Router = express.Router();


router.post('/reset_system', (req: Request, res: Response) => {
  res.json({ message: 'Reset System by admin' });
});

router.use(csrfProtection);

export default router;