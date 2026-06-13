export default{
    /*database: {
        // En producción (Railway) usará las variables de entorno seguras que configuramos en su panel.
        // Si no existen (en tu ordenador local), usará los datos por defecto.
        host: process.env.DB_HOST || "localhost",
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_NAME || "friendcup",
        port: Number(process.env.DB_PORT) || 3306
    },*/
    database: {
        // En producción (Railway) usará las variables de entorno seguras que configuramos en su panel.
        // Si no existen (en tu ordenador local), usará los datos por defecto.
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: Number(process.env.DB_PORT) || 3306
    },
    configuracionLeagueDefault : {
        "jornada": {
            "tipo": "",
            "value": 0
        },
        'sumarJornadasExtra': false,
        "bets" : true
    },

    newMatchesCron: '0 0 * * 1', // Lunes a las 00:00
    //newMatchesCron: '*/1 * * * *', // Cada minuto (para pruebas rápidas)
    nJornadasDefault: 3
}