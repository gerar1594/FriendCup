import mysql from 'mysql2/promise';
import keys from './keys';

const pool = mysql.createPool(keys.database);


// Solución usando promise-mysql + Bluebird

export default pool;