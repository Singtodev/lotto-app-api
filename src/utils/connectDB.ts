const mysql = require('mysql');
import dotenv from 'dotenv';
dotenv.config();
const host = process.env.NODE_ENV?.trim() === 'development' ? 'localhost' : 'db';
const condb = mysql.createConnection({
    host: host,
    user: 'bid_lotto',
    password: 'bid_lotto',
    database: 'bid_lotto'
});


export default condb;