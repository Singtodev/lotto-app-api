import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { adminRouter, authRouter, cartRouter, lottoRouter, userRouter, walletRouter } from './routers/_index';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import bodyParser = require('body-parser');
import { adminGuard, authMiddleware } from './middleware/authMiddleware';
const session = require('express-session')
var morgan = require('morgan')
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
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(limiter);
app.use(cookieParser());
app.get('/', (req: Request, res: Response) => {
  res.send('Hello World : [ Bid Lotto API ]');
});
app.use('/api/users', authMiddleware , userRouter);
app.use('/api/wallet', authMiddleware, walletRouter);
app.use('/api/lotto', authMiddleware, lottoRouter);
app.use('/api/cart', authMiddleware, cartRouter);
app.use('/api/admin',authMiddleware,adminGuard ,adminRouter);
app.use('/api/auth',authRouter);

app.listen(port, () => {
  console.log(process.env.NODE_ENV);
  console.log(`[server]: Server is running at http://localhost:${port}`);
});