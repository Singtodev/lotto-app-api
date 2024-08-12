import express, { Router, Request, Response } from 'express';


const router: Router = express.Router();


router.get('/reset_system', (req: Request, res: Response) => {
  res.json({ message: 'Reset System by admin' });
});


export default router;