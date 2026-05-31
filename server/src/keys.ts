export default{

    database: {
        host: "localhost",
        user: "root",
        password: "",
        database: "friendcup",
        port: 3306
    },

    newMatchesCron: '0 0 * * 1', // Lunes a las 00:00
    //newMatchesCron: '*/1 * * * *', // Cada minuto (para pruebas rápidas)
    nJornadasDefault: 3
}