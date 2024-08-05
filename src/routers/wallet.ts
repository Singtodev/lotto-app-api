import express, { Router, Request, Response } from 'express';

const router: Router = express.Router();

// GET all users
router.get('/get_me_wallet', (req: Request, res: Response) => {
  res.json({ message: 'GET me wallet' });
});

// post increase wallet
router.post("/increase",(req: Request, res: Response) => {
    res.json({ message: 'Increase Wallet' });
})

// post decrease wallet
router.post("/decrease",(req: Request, res: Response) => {
    res.json({ message: 'Decrease Wallet' });
})



export default router;