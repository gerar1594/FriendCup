import mysql from 'mysql2/promise';
import keys from './keys';

const pool = mysql.createPool({...keys.database,
    // 🔥 PARCHE GLOBAL: Convierte los LONGTEXT de Hostinger de vuelta a objetos JSON
    typeCast: function (field: any, next: () => void) {
        // Comprobamos si es alguno de tus campos JSON mapeados como texto por Hostinger
        if (field.name === 'Resultado' || field.name === 'ResultadoFormat') {
            const value = field.string();
            // Si tiene contenido, lo parseamos a objeto de JavaScript, si no, devolvemos null
            return value ? JSON.parse(value) : null;
        }
        return next();
    }});


// Solución usando promise-mysql + Bluebird

export default pool;