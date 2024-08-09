import express, { Router, Request, Response } from 'express';


const router: Router = express.Router();

router.post('/register', (req: Request, res: Response) => {
  const userData = req.body;
  res.json({ message: 'Register successfully', data: userData });
});


router.post('/login', (req: Request, res: Response) => {
    const userData = req.body;
    res.json({ message: 'Logged in successfully', data: userData });
});



export default router;