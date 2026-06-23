import {Request,Response} from 'express';

import pool from "../database";
import AuthService from '../services/AuthService';
import { generarBloqueDeJornadas } from '../tasks/cronTasks';
import keys from '../keys';


class LeaguesController{


    public async listPlayers(req : Request, res : Response): Promise<void>{
        //let token: string = req.headers["token"] as string;
        const { idleague } = req.params;
        //let idPlayer: string = req.headers["id"] as string;

        const playersLeague = await pool.query("SELECT J.* FROM players J, leagues L WHERE J.IDLeague = L.IDLeague AND J.IDLeague = ?",[idleague]);
        if(playersLeague.length > 0){
            res.json(playersLeague[0]);
        } else {
            res.status(404).json({message: "Los jugadores de la liga no existen"});
        }
    }
    public async getLeaguesByUser(req: Request, res: Response): Promise<void> {
        const { idplayer } = req.params;

        const [leagues] = await pool.query(
            `SELECT L.*, S.*
            FROM leagues L
                JOIN leagueplayer LP ON L.IDLeague = LP.IDLeague
                JOIN sports S ON  L.IDSport = S.IDSport
                WHERE LP.IDPlayer = ?`,
            [idplayer]
        );

        if (leagues) {
            res.json(leagues);
        }
        else {
            res.status(404).json({ message: "No se encontraron ligas para este jugador" });
        }
    }

    public async getLeaguesByUserOrAdmin(req: Request, res: Response): Promise<void> {
        const { idplayer } = req.params;

        const [leagues] = await pool.query(
            `SELECT 
                L.*, 
                S.*,
                EXISTS(
                    SELECT 1 
                    FROM likeleagueplayer LLP 
                    WHERE LLP.IDLeague = L.IDLeague AND LLP.IDPlayer = ?
                ) AS isFavorite
            FROM leagues L
            JOIN sports S ON L.IDSport = S.IDSport
            WHERE 
                L.IDAdmin = ?                               -- 1. Eres el creador/admin
                OR EXISTS (
                    SELECT 1 
                    FROM leagueplayer LP 
                    WHERE LP.IDLeague = L.IDLeague AND LP.IDPlayer = ?
                )                                           -- 2. Eres jugador inscrito
                OR EXISTS (
                    SELECT 1 
                    FROM likeleagueplayer LLP 
                    WHERE LLP.IDLeague = L.IDLeague AND LLP.IDPlayer = ?
                )                                           -- 3. 🌟 NUEVO: La tienes en favoritos
            GROUP BY L.IDLeague
            ORDER BY L.NameLeague ASC;`,
            [idplayer, idplayer, idplayer, idplayer]
        );


        if (leagues) {
            res.json(leagues);
        }
        else {
            res.status(404).json({ message: "No se encontraron ligas para este jugador" });
        }
    }

    public async getLeaguesByLikeUser(req: Request, res: Response): Promise<void> {
    
    }
    public async get(req: Request, res: Response): Promise<any>{


        const { idleague } = req.params;
        //let idPlayer: string = req.headers["id"] as string;
        const currentUserId = req.headers['x-user-id'];


        const [league] : any = await pool.query(`SELECT
                L.*,
                S.*,
                EXISTS(
                    SELECT 1
                    FROM leagueplayer LP
                    WHERE LP.IDLeague = L.IDLeague AND LP.IDPlayer = ?
                ) AS IsCurrentUser,
                -- 🎯 Comprobamos si el usuario actual (tú) tiene esta liga en favoritos
                EXISTS(
                    SELECT 1
                    FROM likeleagueplayer LLP
                    WHERE LLP.IDLeague = L.IDLeague AND LLP.IDPlayer = ?
                ) AS IsFavorite
            FROM leagues L
            INNER JOIN sports S ON L.IDSport = S.IDSport
            WHERE L.IDLeague = ?;`,[currentUserId, currentUserId, idleague]);
        const [classification] = await pool.query(
            `SELECT P.IDPlayer, P.NamePlayer, LP.NamePlayerLeague, LP.Points, LP.Matches, LP.Victories, LP.Defeats, LP.Draws, LP.Diff,
            IF(LB.PredictedWinnerID = P.IDPlayer, 1, 0) AS MiVotoCampeon
            FROM leagueplayer LP
            JOIN players P ON LP.IDPlayer = P.IDPlayer
            LEFT JOIN league_bet LB ON LB.IDLeague = LP.IDLeague AND LB.IDPlayer = ? -- ID del usuario logueado
            WHERE LP.IDLeague = ?
            ORDER BY LP.Points DESC, LP.Diff DESC, LP.Matches ASC`,
            [ currentUserId, idleague]
        );
        // 2. Controlamos si 'Configuration' viene como String y lo parseamos de forma segura
        let leagueData = {...league[0]};
        if (typeof leagueData.Configuration === 'string') {
            try {
                leagueData.Configuration = JSON.parse(leagueData.Configuration);
            } catch (e) {
                leagueData.Configuration = leagueData.Configuration; // Fallback en caso de JSON corrupto
            }
        }

        res.json({
            league: leagueData,
            classification: classification,
        });
    }
    
    public async searchLeagues(req: Request, res: Response): Promise<any> {
        const searchQuery = req.query.search as string;
        const currentUserId = req.headers['x-user-id']; // ID del usuario para calcular sus favoritos

        // Si no se envía texto, podemos devolver un array vacío o las últimas ligas creadas

        if (!searchQuery || searchQuery.trim() === '') {
            return res.status(200).json([]);
        }

        try {
            // Limpiamos espacios eibarreses y preparamos el comodín para el LIKE (%termino%)
            const cleanTerm = `%${searchQuery.trim()}%`;

            const query = `
                SELECT
                    L.*,
                    S.NameSport,
                    -- 🎯 Comprobamos si el usuario actual tiene esta liga en favoritos
                    EXISTS(
                        SELECT 1
                        FROM likeleagueplayer LLP
                        WHERE LLP.IDLeague = L.IDLeague AND LLP.IDPlayer = ?
                    ) AS IsFavorite
                FROM leagues L
                INNER JOIN sports S ON L.IDSport = S.IDSport
                WHERE L.NameLeague LIKE ?
                ORDER BY L.IDLeague DESC
                LIMIT 20; -- Limitamos a 20 para no saturar la red si la búsqueda es muy genérica
            `;

            // Ejecutamos pasándole el ID del usuario (para el favorito) y el término (para el LIKE)
            const [leagues]: any = await pool.query(query, [currentUserId || null, cleanTerm]);

            // Retornamos el array de resultados coincidentes
            return res.status(200).json(leagues);

        } catch (error: any) {
            console.error("Error al buscar ligas:", error.message);
            return res.status(500).json({
                message: "Error interno del servidor al procesar la búsqueda: " + error.message 
            });
        }
    }

    public async create(req : Request, res : Response): Promise<void> {
        const { NameLeague, IDSport, IDPlayer } = req.body; 
        try {
            // Generamos el código de invitación alfanumérico único
            const invitationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            // IDSport simulado temporalmente (puedes por ahora meter un número por defecto, ej: 1)

            const connection = await pool.getConnection();
            await connection.beginTransaction();

            try {
                // Insertar la liga usando tus columnas exactas
                console.log(`INSERT INTO leagues (NameLeague, InvitationCode, IDSport, IDAdmin, Estado) 
                        VALUES ('${NameLeague}', '${invitationCode}', ${IDSport}, ${IDPlayer}, 'Abierta')`)

                
                const [leagueResult]: any = await connection.query(
                    `INSERT INTO leagues (NameLeague, InvitationCode, IDSport, IDAdmin, Estado, Configuration) 
                        VALUES (?, ?, ?, ?, 'Abierta',?)`,
                    [NameLeague, invitationCode, IDSport, IDPlayer, JSON.stringify(keys.configuracionLeagueDefault) ]
                );
                const newLeagueId = leagueResult.insertId;
                console.log("Llega", newLeagueId);
                // Inscribir al jugador creador en tu tabla intermedia 'leaguePlayer'
                await connection.query(
                    "INSERT INTO leagueplayer (IDLeague, IDPlayer) VALUES (?, ?)",
                    [newLeagueId, IDPlayer]
                );

                await connection.commit();
                res.status(201).json({
                    message: "Liga creada con éxito",
                    code: invitationCode,
                    idLeague: newLeagueId
                });
            } catch (err) {
                console.log(err);
                await connection.rollback();
                throw err;
            } finally {
                connection.release();
            }
        } catch (error: any) {
            res.status(500).json({ message: "Error al crear la liga: " + error.message });
        }
    }

    public async join(req: Request, res: Response): Promise<any> {
        const { InvitationCode, IDPlayer } = req.body;

        try {
            // Buscar la liga por tu columna 'InvitationCode'
            const [leagues]: any = await pool.query(
                "SELECT IDLeague, Estado FROM leagues WHERE InvitationCode = ?", 
                [InvitationCode.toUpperCase().trim()]
            );

            if (leagues.length === 0) {
                return res.status(404).json({ message: "El código no pertenece a ninguna liga." });
            }

            const liga = leagues[0];

            if (liga.Estado !== 'Abierta') {
                return res.status(400).json({ message: "La liga ya no acepta nuevos jugadores." });
            }

            // Comprobar si ya está en 'leaguePlayer'
            const [inscrito]: any = await pool.query(
                "SELECT * FROM leagueplayer WHERE IDLeague = ? AND IDPlayer = ?",
                [liga.IDLeague, IDPlayer]
            );

            if (inscrito.length > 0) {
                return res.status(400).json({ message: "Ya estás inscrito en esta liga." });
            }

            // Insertar la nueva inscripción individual
            await pool.query(
                "INSERT INTO leagueplayer (IDLeague, IDPlayer) VALUES (?, ?)",
                [liga.IDLeague, IDPlayer]
            );

            res.json({ message: "¡Te has unido con éxito!", idLeague: liga.IDLeague });

        } catch (error: any) {
            res.status(500).json({ message: "Error al unirse: " + error.message });
        }
    }

    public async leave(req: Request, res: Response): Promise<any> {
        const { idLeague } = req.body;
        const currentUserId = req.headers['x-user-id'];

        try {
            const connection = await pool.getConnection();
            await connection.beginTransaction();

            try {
                // 1. Consultar el estado de la liga
                const [leagueRows]: any = await connection.query(
                    "SELECT Estado FROM leagues WHERE IDLeague = ?",
                    [idLeague]
                );

                if (leagueRows.length === 0) {
                    await connection.rollback();
                    return res.status(404).json({ message: "La liga especificada no existe." });
                }

                const estadoLiga = leagueRows[0].Estado;

                // 2. Si la liga está abierta, comprobamos si tiene partidos generados en esta liga
                if (estadoLiga === 'Abierta') {
                    const [matchRows]: any = await connection.query(
                        `SELECT 1 FROM matchplayer mp
                        INNER JOIN matches m ON mp.IDMatch = m.IDMatch
                        WHERE m.IDLeague = ? AND mp.IDPlayer = ? LIMIT 1`,
                        [idLeague, currentUserId]
                    );

                    // Si NO tiene ningún partido asignado en la liga, hacemos BORRADO LIMPIO (DELETE)
                    if (matchRows.length === 0) {
                        await connection.query(
                            "DELETE FROM leagueplayer WHERE IDLeague = ? AND IDPlayer = ?",
                            [idLeague, currentUserId]
                        );

                        await connection.commit();
                        return res.json({ 
                            message: "Te has desapuntado de la liga correctamente de forma limpia. El torneo sigue abierto. 📑" 
                        });
                    }
                }

                // =========================================================================
                // 3. FLUJO DE BOT COMODÍN (Si la liga está "En Curso"/"Finalizada" O tiene partidos)
                // =========================================================================
                
                // Buscar un Bot Comodín global que esté libre en ESTA liga específica
                const [availableBots]: any = await connection.query(
                    `SELECT IDPlayer FROM players 
                    WHERE NamePlayer LIKE 'Bot Comodín %' 
                    AND IDPlayer NOT IN (
                        SELECT IDPlayer FROM leagueplayer WHERE IDLeague = ?
                    ) 
                    ORDER BY CAST(SUBSTRING(NamePlayer, 13) AS UNSIGNED) ASC
                    LIMIT 1`,
                    [idLeague]
                );

                // Si por alguna razón extrema se llenaran los bots en una sola liga
                if (availableBots.length === 0) {
                    await connection.rollback();
                    return res.status(400).json({
                        message: "No quedan plazas de Bots disponibles en esta liga para congelar tus datos. Contacta al administrador."
                    });
                }

                const idBotLibre = availableBots[0].IDPlayer;

                // ¡EL CAMBIAZO EN CASCADA!
                // El bot asume de forma independiente los puntos, estadísticas y partidos gracias al CASCADE.
                await connection.query(
                    "UPDATE leagueplayer SET IDPlayer = ? WHERE IDLeague = ? AND IDPlayer = ?",
                    [idBotLibre, idLeague, currentUserId]
                );

                await connection.commit();
                res.json({ 
                    message: "Te has desvinculado de la liga correctamente. Una plaza automatizada mantendrá tus puntos y tus rotaciones."
                });

            } catch (err) {
                await connection.rollback();
                throw err;
            } finally {
                connection.release();
            }
        } catch (error: any) {
            console.error("❌ Error crítico al procesar la baja:", error);
            res.status(500).json({ message: "Error crítico al procesar la baja: " + error.message });
        }
    }

    public async delete(req: Request, res: Response): Promise<void>{
        const { id } = req.params;
        await pool.query("DELETE FROM players WHERE ID = ?", [id]);
        res.json({message:"El jugador fue eliminado"});
    }

    public async update (req: Request, res: Response): Promise<void>{
        const { id } = req.params;
        await pool.query("UPDATE players set ? WHERE id = ?",[req.body, id]);
        res.json({message:" El jugador fue actualizado"});


    }

    public async addLike (req: Request, res: Response): Promise<void>{
        const { idleague } = req.params;
        const currentUserId = req.headers['x-user-id'];
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        console.log(idleague, currentUserId)
        try{
            const [matchResult]: any = await connection.query(
                    `INSERT INTO likeleagueplayer (IDLeague, IDPlayer) VALUES (?, ?)`,
                    [idleague, currentUserId]
                );
            connection.commit();
            res.json({message:" La liga ha sido añadido a tus favoritos"});

        } catch (transactionError: any) {
            await connection.rollback();
            throw transactionError;
        } finally {
            connection.release();
        }
    }

    public async deleteLike (req: Request, res: Response): Promise<void>{
        const { idleague } = req.params;
        const currentUserId = req.headers['x-user-id'];

        await pool.query("DELETE FROM likeleagueplayer WHERE IDLeague = ? AND IDPlayer = ?", 
            [idleague, currentUserId]);
        res.json({message:"La liga ha sido eliminada de tus favoritos"});
    }

    public async checkLeagueAccess (req: Request, res: Response) {
        const { idLeague } = req.params;
        const { idPlayer } = req.params; // O de req.user mediante tu JWT/Auth middleware
        try {
            // Hacemos un conteo rápido: si da 1, el usuario está inscrito
            const [rows]: any = await pool.query(
                `SELECT count(*) as esMiembro 
                FROM leagueplayer 
                WHERE IDLeague = ? AND IDPlayer = ?`,
                [idLeague, idPlayer]
            );
            console.log("Resultado de la consulta de acceso:", rows);
            const pertenece = rows[0].esMiembro > 0;

            if (!pertenece) {
                return res.status(200).json({ 
                    isPlayer: false, 
                    message: "No estás inscrito en esta liga." 
                });
            }

            // Si pertenece, ya puedes traer de forma segura los datos privados de la liga
            const [ligaData] = await pool.query(`SELECT * FROM leagues WHERE IDLeague = ?`, [idLeague]) ;

            return res.status(200).json({
                isPlayer: true
            });

        } catch (error: any) {
            return res.status(500).json({ message: "Error al verificar acceso: " + error.message });
        }
    };

    public async updateState(req: Request, res: Response){
        const { idleague } = req.params;
        const { estado, idadmin } = req.body; // 'Creada', 'En Curso', 'Finalizada'

        try {
            const connection = await pool.getConnection();
            await connection.beginTransaction();
            try {
                // 1. Actualizamos el estado de la liga en MySQL
                await connection.query(
                    "UPDATE leagues SET Estado = ? WHERE IDLeague = ? && IDAdmin = ?",
                    [estado, idleague,idadmin]
                );

                await connection.commit();

                // 2. ⚡ SI EL NUEVO ESTADO ES "EN CURSO", DISPARAMOS LAS JORNADAS INSTANTÁNEAMENTE
                if (estado === 'En Curso') {
                    console.log(`🚀 Liga [ID: ${idleague}] activada por el administrador. Disparando bloque de jornadas iniciales...`);
                    
                    // Lo ejecutamos en segundo plano para no demorar la respuesta HTTP del cliente
                    const [jornadas]: any[] = await pool.query(`SELECT * FROM matches WHERE IDLeague = ?`, [idleague]);

                    if(jornadas && jornadas.length == 0){

                        generarBloqueDeJornadas(idleague.toString(), keys.nJornadasDefault)
                            .then(() => console.log(`✅ Bloque inicial de jornadas para liga ${idleague} generado con éxito.`))
                            .catch((err) => console.error(`❌ Falló la generación inicial post-cambio de estado para liga ${idleague}:`, err.message));
                    }
                }

                // Respondemos de inmediato al frontend de Angular
                return res.status(200).json({ 
                    message: "Estado de la liga actualizado con éxito.",
                    estado
                });

            } catch (err) {
                await connection.rollback();
                throw err;
            } finally {
                connection.release();
            }
        } catch (error: any) {
            return res.status(500).json({ message: "Error al actualizar el estado: " + error.message });
        }
    }

    public async updateConfiguration(req: Request, res: Response) {
        const { idleague } = req.params;
        const { configuration, resetearJornadas } = req.body; // Esperamos un objeto JSON con la nueva configuración
        const currentUserId = req.headers['x-user-id'];
        try{
            const connection = await pool.getConnection();
            await connection.beginTransaction();
            try {
                // 1. Validamos que el usuario que hace la petición es el admin de la liga
                const [liga]: any = await connection.query(
                    "SELECT IDAdmin FROM leagues WHERE IDLeague = ?",
                    [idleague]
                );
                if (liga.length === 0) {
                    await connection.rollback();
                    return res.status(404).json({ message: "La liga no existe." });
                }
                if (liga[0].IDAdmin !== Number(currentUserId)) {
                    await connection.rollback();
                    return res.status(403).json({ message: "No tienes permisos para modificar esta liga." });
                }

                // 🔄 LÓGICA DE GENERACIÓN DE JORNADAS EXTRA EN MODO ESTÁTICO
                if (configuration?.jornada?.tipo === 'estatico') {
                    const targetJornadas = Number(configuration.jornada.value);

                    // A. Consultamos cuál es la jornada máxima actual que tiene partidos registrados
                    const [maxJornadaResult]: any = await connection.query(
                        "SELECT COALESCE(MAX(DayTrip), 0) AS currentMax FROM matches WHERE IDLeague = ?",
                        [idleague]
                    );

                    const currentMaxJornada = maxJornadaResult[0].currentMax;

                    // B. Si el usuario pide un número mayor de jornadas que las actuales, generamos las que faltan
                    if (targetJornadas > currentMaxJornada) {
                        console.log(`Generando jornadas desde la ${currentMaxJornada + 1} hasta la ${targetJornadas}`);

                        // Iteramos para crear las jornadas que faltan en el sistema
                        await generarBloqueDeJornadas(idleague.toString(), targetJornadas - currentMaxJornada, connection) // Generamos las jornadas que faltan
                                .then(() => console.log(`✅ Jornadas generadas con éxito para liga ${idleague}.`))
                                .catch((err) => console.error(err.message));
                    } else {
                        console.log(`No se generan jornadas. Solicitadas: ${targetJornadas}, Ya existentes: ${currentMaxJornada}`);
                    }
                }else if(configuration?.jornada?.tipo === 'manual'){
                    if(resetearJornadas){
                        await connection.query(
                            "DELETE FROM matches WHERE IDLeague = ? AND DayTrip IS NOT NULL",
                            [idleague]
                        );
                        console.log(`🧹 Partidos limpiados. Jornadas listas para inserción manual.`);
                    }
                }

                if(configuration?.sumarJornadasExtra) {
                }


                // 2. Actualizamos la configuración (la guardamos como string JSON en la base de datos)
                await connection.query(
                    "UPDATE leagues SET Configuration = ? WHERE IDLeague = ?",
                    [JSON.stringify(configuration), idleague]
                );
                await connection.commit();
                return res.status(200).json({ message: "Configuración actualizada con éxito." });
            } catch (err) {
                await connection.rollback();
                throw err;
            } finally {
                connection.release();
            }
        } catch (error: any) {
            return res.status(500).json({ message: "Error al actualizar la configuración: " + error.message });
        }
    }

    public async resetLeague(req: Request, res: Response): Promise<void> {
        const { idleague } = req.params;
        const currentUserId = req.headers['x-user-id'];
        const connection = await pool.getConnection();
        try {
            
            await connection.beginTransaction();

            try {
                // 1. Validamos que el usuario que hace la petición es el admin de la liga
                const [liga]: any = await connection.query(
                    "SELECT IDAdmin FROM leagues WHERE IDLeague = ?",
                    [idleague]
                );
                if (liga.length === 0) {
                    await connection.rollback();
                    res.status(404).json({ message: "La liga no existe." });
                }
                if (liga[0].IDAdmin !== Number(currentUserId)) {
                    await connection.rollback();
                    res.status(403).json({ message: "No tienes permisos para modificar esta liga." });
                    throw new Error("Permisos insuficientes para reiniciar la liga."); // Lanzamos un error para salir del flujo
                }
            } catch (err) {
                throw err;
            }

            // 1. Opcional: Validar si el usuario actual es el ADMIN de la liga (Seguridad extra)
            // const idUser = req.user.id; // Si usas middleware de autenticación

            // 2. Borramos todos los partidos asociados a la liga
            // Nota: Si tu tabla 'matches_sets' o similar tiene ON DELETE CASCADE, se borrarán solos.
            // Si no, borra primero los sets/detalles y luego los partidos.
            console.log(`🔄 Reiniciando liga ID: ${idleague} - Eliminando partidos existentes...`);
            await connection.query(
                "DELETE FROM matches WHERE IDLeague = ?",
                [idleague]
            );

            // 3. Opcional: Si tienes una tabla intermedia de inscripciones donde guardas los puntos 
            // acumulados de cada jugador de forma estática (ej: points, victories, defeats...), los reiniciamos a 0.
            await connection.query(
                `UPDATE leagueplayer
                SET Points = 0, Matches = 0, Victories = 0, Defeats = 0, Draws = 0, DIff = 0
                WHERE IDLeague = ?`,
                [idleague]
            );

            // 4. Cambiamos el estado de la liga de nuevo a 'Abierta' o lo mantenemos en base a tu flujo
            await connection.query(
                "UPDATE leagues SET Estado = 'Abierta' WHERE IDLeague = ?",
                [idleague]
            );

            // Confirmamos todos los cambios en la base de datos
            await connection.commit();

            res.status(200).json({
                message: 'La liga se ha reiniciado con éxito. Se han eliminado todos los partidos y las clasificaciones vuelven a estar a cero.'
            });

        } catch (error: any) {
            // Si algo falla, cancelamos todo el borrado para no dejar datos huérfanos
            await connection.rollback();
            console.error('❌ Error al reiniciar la liga:', error);
            res.status(500).json({
                message: 'Error interno del servidor al intentar reiniciar la liga.'
            });
        } finally {
            connection.release(); // Devolvemos la conexión al pool
        }
    };

    public async resetLeagueMatches(req: Request, res: Response): Promise<void> {
        const { idleague } = req.params;
        const currentUserId = req.headers['x-user-id'];
        const connection = await pool.getConnection();
        try {
            
            await connection.beginTransaction();

            try {
                // 1. Validamos que el usuario que hace la petición es el admin de la liga
                const [liga]: any = await connection.query(
                    "SELECT IDAdmin FROM leagues WHERE IDLeague = ?",
                    [idleague]
                );
                if (liga.length === 0) {
                    await connection.rollback();
                    res.status(404).json({ message: "La liga no existe." });
                }
                if (liga[0].IDAdmin !== Number(currentUserId)) {
                    await connection.rollback();
                    res.status(403).json({ message: "No tienes permisos para modificar esta liga." });
                    throw new Error("Permisos insuficientes para reiniciar la liga."); // Lanzamos un error para salir del flujo
                }
            } catch (err) {
                throw err;
            }

            // 1. Opcional: Validar si el usuario actual es el ADMIN de la liga (Seguridad extra)
            // const idUser = req.user.id; // Si usas middleware de autenticación

            // 2. Borramos todos los partidos asociados a la liga
            // Nota: Si tu tabla 'matches_sets' o similar tiene ON DELETE CASCADE, se borrarán solos.
            // Si no, borra primero los sets/detalles y luego los partidos.
            console.log(`🔄 Reiniciando partidos de la liga ID: ${idleague} - Reseteando partidos existentes...`);
            await connection.query(
                "UPDATE matches SET Resultado = DEFAULT, Estado = 'Pendiente', Winner = NULL, sumado = 0, Fecha = '0000-00-00 00:00:00' WHERE IDLeague = ?",
                [idleague]
            );

            // 3. Opcional: Si tienes una tabla intermedia de inscripciones donde guardas los puntos 
            // acumulados de cada jugador de forma estática (ej: points, victories, defeats...), los reiniciamos a 0.
            await connection.query(
                `UPDATE leagueplayer
                SET Points = 0, Matches = 0, Victories = 0, Defeats = 0, Draws = 0, DIff = 0
                WHERE IDLeague = ?`,
                [idleague]
            );

            // 4. Cambiamos el estado de la liga de nuevo a 'Abierta' o lo mantenemos en base a tu flujo
            await connection.query(
                "UPDATE leagues SET Estado = 'Abierta' WHERE IDLeague = ?",
                [idleague]
            );

            // Confirmamos todos los cambios en la base de datos
            await connection.commit();

            res.status(200).json({
                message: 'La liga se ha reiniciado con éxito. Se han eliminado todos los partidos y las clasificaciones vuelven a estar a cero.'
            });

        } catch (error: any) {
            // Si algo falla, cancelamos todo el borrado para no dejar datos huérfanos
            await connection.rollback();
            console.error('❌ Error al reiniciar la liga:', error);
            res.status(500).json({
                message: 'Error interno del servidor al intentar reiniciar la liga.'
            });
        } finally {
            connection.release(); // Devolvemos la conexión al pool
        }
    };

    public async updateNamePlayerLeague(req: Request, res: Response): Promise<void> {
        const { idLeague, newName } = req.body;
        const currentUserId = req.headers['x-user-id'];

        // Validaciones básicas
        if (!newName || newName.trim() === '') {
            res.status(400).json({ message: 'El nombre no puede estar vacío.' });
        }

        if (newName.length > 20) {
            res.status(400).json({ message: 'El nombre es demasiado largo (máximo 20 caracteres).' });
        }

        try {
            // Ejecutamos la actualización en MariaDB
            const [result]: any = await pool.query(
                `UPDATE leagueplayer
                SET NamePlayerLeague = ?
                WHERE IDLeague = ? AND IDPlayer = ?`,
                [newName.trim(), idLeague, currentUserId]
            );

            // Si rowsAffected (o affectedRows) es 0, significa que el jugador no está inscrito en esa liga
            if (result.affectedRows === 0) {
                res.status(404).json({
                    message: 'No se encontró tu inscripción en esta liga para poder modificar el nombre.'
                });
            }

            res.status(200).json({
                message: 'Tu nombre en la liga ha sido actualizado correctamente. 📝'
            });

        } catch (error) {
            console.error('❌ Error al actualizar el nombre del jugador en la liga:', error);
            res.status(500).json({ message: 'Error interno del servidor.' });
        }
    };
}


export const leaguesController = new LeaguesController();
