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

        const leagues = await pool.query(
            `SELECT L.*, S.*
            FROM leagues L
                JOIN leaguePlayer LP ON L.IDLeague = LP.IDLeague
                JOIN sports S ON  L.IDSport = S.IDSport
                WHERE LP.IDPlayer = ?`,
            [idplayer]
        );

        if (leagues.length > 0) {

            res.json(leagues[0]);
        }
        else {
            res.status(404).json({ message: "No se encontraron ligas para este jugador" });
        }
    }

    public async getLeaguesByUserOrAdmin(req: Request, res: Response): Promise<void> {
        const { idplayer } = req.params;

        const leagues = await pool.query(
            `SELECT L.*, S.*
            FROM leagues L
                JOIN leaguePlayer LP ON L.IDLeague = LP.IDLeague
                JOIN sports S ON  L.IDSport = S.IDSport
                WHERE LP.IDPlayer = ? OR L.IDAdmin = ?
                GROUP BY L.IDLeague`,
            [idplayer, idplayer]
        );

        if (leagues.length > 0) {

            res.json(leagues[0]);
        }
        else {
            res.status(404).json({ message: "No se encontraron ligas para este jugador" });
        }
    }

    public async get(req: Request, res: Response): Promise<any>{


        const { idleague } = req.params;
        //let idPlayer: string = req.headers["id"] as string;

        const [league] = await pool.query(`SELECT L.*, S.*  FROM leagues L, sports S WHERE L.IDSport = S.IDSport AND L.IDLeague = ?`,[idleague]);
        const [classification] = await pool.query(
            `SELECT P.NamePlayer, LP.Points, LP.Matches, LP.Victories, LP.Defeats, LP.Draws
            FROM leaguePlayer LP
                JOIN players P ON LP.IDPlayer = P.IDPlayer
                WHERE LP.IDLeague = ?
            ORDER BY LP.Points DESC, LP.Matches ASC`,
            [idleague]
        );


        res.json({
            league: league,
            classification: classification,
        });
    }

    public async create(req : Request, res : Response): Promise<void> {
        const { NameLeague, IDSport, IDPlayer } = req.body; 
        console.log(IDSport);
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
                    `INSERT INTO leagues (NameLeague, InvitationCode, IDSport, IDAdmin, Estado) 
                        VALUES (?, ?, ?, ?, 'Abierta')`,
                    [NameLeague, invitationCode, IDSport, IDPlayer ]
                );
                const newLeagueId = leagueResult.insertId;
                console.log("Llega", newLeagueId);
                // Inscribir al jugador creador en tu tabla intermedia 'leaguePlayer'
                await connection.query(
                    "INSERT INTO leaguePlayer (IDLeague, IDPlayer) VALUES (?, ?)",
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
                "SELECT * FROM leaguePlayer WHERE IDLeague = ? AND IDPlayer = ?",
                [liga.IDLeague, IDPlayer]
            );

            if (inscrito.length > 0) {
                return res.status(400).json({ message: "Ya estás inscrito en esta liga." });
            }

            // Insertar la nueva inscripción individual
            await pool.query(
                "INSERT INTO leaguePlayer (IDLeague, IDPlayer) VALUES (?, ?)",
                [liga.IDLeague, IDPlayer]
            );

            res.json({ message: "¡Te has unido con éxito!", idLeague: liga.IDLeague });

        } catch (error: any) {
            res.status(500).json({ message: "Error al unirse: " + error.message });
        }
    }

    public async leave(req: Request, res: Response): Promise<any> {
        const { idLeague, idPlayer } = req.body;

        try {
            const connection = await pool.getConnection();
            await connection.beginTransaction();

            try {
                // 1. Buscar un Bot Comodín global que esté libre en ESTA liga específica
                const [availableBots]: any = await connection.query(
                    `SELECT IDPlayer FROM players 
                    WHERE NamePlayer LIKE 'Bot Comodín %' 
                    AND IDPlayer NOT IN (
                        SELECT IDPlayer FROM leaguePlayer WHERE IDLeague = ?
                    ) 
                    ORDER BY CAST(SUBSTRING(NamePlayer, 13) AS UNSIGNED) ASC 
                    LIMIT 1`,
                    [idLeague]
                );

                // Si por alguna razón extrema se llenaran los 50 bots en una sola liga
                if (availableBots.length === 0) {
                    await connection.rollback();
                    return res.status(400).json({ 
                        message: "No quedan plazas de Bots disponibles en esta liga. Contacta al administrador." 
                    });
                }

                const idBotLibre = availableBots[0].IDPlayer;
                
                // 2. ¡EL CAMBIAZO EN CASCADA! 
                // Transferimos el puesto al Bot Comodín encontrado.
                // Gracias al ON UPDATE CASCADE que configuramos antes, el bot asume de forma 
                // independiente los puntos, estadísticas y todos los partidos (jugados y pendientes).

                await connection.query(
                    "UPDATE leaguePlayer SET IDPlayer = ? WHERE IDLeague = ? AND IDPlayer = ?",
                    [idBotLibre, idLeague, idPlayer]
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
}


export const leaguesController = new LeaguesController();
