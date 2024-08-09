const mysql = require('mysql');
const condb = mysql.createConnection({
    host: 'db',
    user: 'bid_lotto',
    password: 'bid_lotto',
    database: 'bid_lotto'
});


export default condb;