import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { adminRouter, authRouter, lottoRouter, userRouter, walletRouter } from './routers/_index';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import bodyParser = require('body-parser');
const session = require('express-session')
dotenv.config();
const app = express();
const port = process.env.PORT || 8000;
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 นาที
  max: 1000 // จำกัด 1000 คำขอต่อ IP ใน 10 นาที
});
app.use(session({
  name: "bid-lotto",
  secret: "bid-lotto",
  cookie: { maxAge: 3 * 60 * 60 * 1000 },
  resave: false,
  saveUninitialized: false
}))
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(limiter);
app.use(cookieParser());
app.get('/', (req: Request, res: Response) => {
  res.send('Hello World : [ Bid Lotto API ]');
});
app.use('/api/users', userRouter);
app.use('/api/wallet', walletRouter);
app.use('/api/lotto', lottoRouter);
app.use('/api/admin', adminRouter);
app.use('/api/auth',authRouter);

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});