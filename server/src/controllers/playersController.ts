import {Request,Response} from 'express';

import pool from "../database";
import AuthService from '../services/AuthService';


class PlayersController{


    public async list(req : Request, res : Response): Promise<void>{
        //let token: string = req.headers["token"] as string;
        const { idplayer } = req.params;
        //let idPlayer: string = req.headers["id"] as string;

        const players = await pool.query("SELECT J.* FROM players J, leagueplayer lp , leagues L WHERE J.IDPlayer = lp.IDPlayer AND lp.IDLeague = L.IDLeague AND J.IDPlayer = ?",[idplayer]);
        if(players.length > 0){
            res.json(players[0]);
        } else {
            res.status(404).json({message: "El jugador no existe"});
        }
    }

    public async get(req: Request, res: Response): Promise<any>{


        const { idplayer } = req.params;

        const players = await pool.query("SELECT J.*, L.* FROM players J, leagueplayer lp , leagues L WHERE J.IDPlayer = lp.IDPlayer AND lp.IDLeague = L.IDLeague AND J.IDPlayer = ?",[idplayer]);
        if(players.length > 0){
            res.json(players[0]);
        } else {
            res.status(404).json({message: "El jugador no existe"});
        }

    }

    public async create(req : Request, res : Response): Promise<void> {
        await pool.query("INSERT INTO players set ?", [req.body]);
        res.json({message: "Create a player"});
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

    public async getAnonimo(req: Request, res: Response): Promise<any>{
        const [player] = await pool.query("SELECT J.* FROM players J WHERE J.NamePlayer = 'Anonimo'");
        if(player){
            res.json(player);
        } else {
            res.status(404).json({message: "El jugador no existe"});
        }

    }

    public async getHomeData(req: Request, res: Response): Promise<any> {
        const currentUserId = req.headers['x-user-id'];

        if (!currentUserId) {
            return res.status(400).json({ message: "ID de usuario no proporcionado" });
        }

        try {
            // 1. Promesa para cargar las Ligas y la clasificación del usuario
            const leaguesQuery = pool.query(`
                SELECT
                    l.IDLeague,
                    l.NameLeague,
                    l.Estado,
                    lp.Points AS MisPuntos,
                    -- Calculamos la posición solo si realmente es un jugador de la liga
                    IF(lp.IDLeaguePlayer IS NOT NULL,
                        (SELECT COUNT(*) + 1
                        FROM leagueplayer c2
                        WHERE c2.IDLeague = l.IDLeague
                        AND (c2.Points > lp.Points OR (c2.Points = lp.Points AND c2.Diff > lp.Diff))),
                        NULL
                    ) AS MiPosicion,
                    (SELECT COUNT(*) FROM leagueplayer c3 WHERE c3.IDLeague = l.IDLeague) AS TotalJugadores,

                    -- Banderas booleanas (1 o 0)
                    IF(l.IDAdmin = ?, 1, 0) AS isAdmin,
                    IF(lp.IDPlayer IS NOT NULL, 1, 0) AS isPlayer,
                    IF(llp.IDPlayer IS NOT NULL, 1, 0) AS isFavorite


                FROM leagues l
                -- Hacemos LEFT JOIN buscando específicamente a este jugador
                LEFT JOIN leagueplayer lp ON l.IDLeague = lp.IDLeague AND lp.IDPlayer = ?
                LEFT JOIN likeleagueplayer llp ON l.IDLeague = llp.IDLeague AND llp.IDPlayer = ?

                -- Filtramos para que solo salgan las ligas donde es admin O es jugador
                WHERE l.IDAdmin = ? OR lp.IDPlayer IS NOT NULL OR llp.IDPlayer IS NOT NULL;
            `, [currentUserId, currentUserId, currentUserId, currentUserId]);

            // 2. Promesa para cargar los Próximos Partidos (Fusionado con tu lógica JSON_ARRAYAGG)
            /*const matchesQuery = pool.query(`
                SELECT
                    m.IDMatch,
                    m.IDLeague,
                    l.NameLeague,
                    s.NameSport,
                    m.DayTrip,
                    IF(m.Fecha IS NULL OR YEAR(m.Fecha) < 2000, NULL, m.Fecha) AS Fecha,
                    m.Resultado,
                    m.Estado,
                    m.Winner,
                    mp.Bando AS bando,
                    -- 🏠 LOCALES: Devuelve un array de objetos JSON
                    (
                SELECT JSON_ARRAYAGG(JSON_OBJECT(
                    'IDLeaguePlayer', lp_loc.IDLeaguePlayer,
                    'NamePlayerLeague', COALESCE(lp_loc.NamePlayerLeague, pl_loc.NamePlayer, 'Invitado'),
                    'IDPlayer', lp_loc.IDPlayer
                ))
                FROM matchplayer mp_local
                LEFT JOIN leagueplayer lp_loc ON mp_local.IDPlayer = lp_loc.IDLeaguePlayer

                LEFT JOIN players pl_loc ON lp_loc.IDPlayer = pl_loc.IDPlayer

                WHERE mp_local.IDMatch = m.IDMatch AND mp_local.Bando = 'Local'
                ) AS JugadoresLocalNames,

                -- ✈️ Jugadores Visitantes
                (
                SELECT JSON_ARRAYAGG(JSON_OBJECT(
                    'IDLeaguePlayer', lp_vis.IDLeaguePlayer,
                    'NamePlayerLeague', COALESCE(lp_vis.NamePlayerLeague, pl_vis.NamePlayer, 'Invitado'),
                    'IDPlayer', lp_vis.IDPlayer
                ))
                FROM matchplayer mp_visit
                LEFT JOIN leagueplayer lp_vis ON mp_visit.IDPlayer = lp_vis.IDLeaguePlayer

                LEFT JOIN players pl_vis ON lp_vis.IDPlayer = pl_vis.IDPlayer

                WHERE mp_visit.IDMatch = m.IDMatch AND mp_visit.Bando = 'Visitante'
                ) AS JugadoresVisitanteNames,

                    mb.PredictedBando AS MiApuesta,
                    mb.PredictedScore AS MiResultadoApostado

                FROM matches m
                INNER JOIN leagues l ON m.IDLeague = l.IDLeague
                INNER JOIN leagueplayer lp ON lp.IDPlayer = ?
                INNER JOIN sports s ON l.IDSport = s.IDSport
                INNER JOIN matchplayer mp ON m.IDMatch = mp.IDMatch AND mp.IDPlayer = lp.IDLeaguePlayer
                LEFT JOIN match_bet mb ON m.IDMatch = mb.IDMatch AND mb.IDPlayer = ?
                WHERE m.Estado = 'Pendiente' AND m.Fecha >= NOW()
                ORDER BY
                    ISNULL(Fecha) ASC,
                    Fecha ASC,
                    m.DayTrip ASC
                LIMIT 5
            `, [currentUserId, currentUserId]); // El ID se pasa dos veces (para matchplayer y match_bet)*/

            const query = `
            SELECT
                m.IDMatch,
                m.IDLeague,
                l.NameLeague,
                s.NameSport,
                m.DayTrip,
                IF(m.Fecha IS NULL OR YEAR(m.Fecha) < 2000, NULL, m.Fecha) AS Fecha,
                m.Resultado,
                m.Estado,
                m.Winner,
                mp.Bando AS bando,
                (
                    SELECT JSON_ARRAYAGG(JSON_OBJECT(
                        'IDLeaguePlayer', lp_local.IDLeaguePlayer,
                        'NamePlayerLeague', COALESCE(lp_local.NamePlayerLeague, pl_local.NamePlayer, 'Invitado'),
                        'IDPlayer', lp_local.IDPlayer
                    ))
                    FROM matchplayer mp_local
                    INNER JOIN leagueplayer lp_local ON lp_local.IDLeaguePlayer = mp_local.IDPlayer
                    LEFT JOIN players pl_local ON lp_local.IDLeaguePlayer = pl_local.IDPlayer
                    WHERE mp_local.IDMatch = m.IDMatch AND mp_local.Bando = 'Local'
                ) AS JugadoresLocalNames,
                (
                    SELECT JSON_ARRAYAGG(JSON_OBJECT(
                        'IDLeaguePlayer', lp_vis.IDLeaguePlayer,
                        'NamePlayerLeague', COALESCE(lp_vis.NamePlayerLeague, pl_vis.NamePlayer, 'Invitado'),
                        'IDPlayer', lp_vis.IDPlayer
                    ))
                    FROM matchplayer mp_visit
                    INNER JOIN leagueplayer lp_vis ON lp_vis.IDLeaguePlayer = mp_visit.IDPlayer
                    LEFT JOIN players pl_vis ON lp_vis.IDLeaguePlayer = pl_vis.IDPlayer
                    WHERE mp_visit.IDMatch = m.IDMatch AND mp_visit.Bando = 'Visitante'
                ) AS JugadoresVisitanteNames,
                mb.PredictedBando AS MiApuesta,
                mb.PredictedScore AS MiResultadoApostado
            FROM matches m
            INNER JOIN matchplayer mp ON mp.IDMatch = m.IDMatch
            INNER JOIN leagueplayer lp ON lp.IDLeaguePlayer = mp.IDPlayer
            INNER JOIN leagues l ON m.IDLeague = l.IDLeague
            INNER JOIN sports s ON l.IDSport = s.IDSport
            LEFT JOIN match_bet mb ON m.IDMatch = mb.IDMatch AND mb.IDPlayer = ?
            WHERE lp.IDPlayer = ?
            ORDER BY
                ISNULL(Fecha) ASC,
                Fecha DESC,
                m.DayTrip ASC
            LIMIT 5;
            `

            const matchesQuery = pool.query(query, [currentUserId, currentUserId]);

            // Ejecutamos ambas consultas en paralelo
            const [[leagues], [matches]] = await Promise.all([leaguesQuery, matchesQuery]);
            console.log(leagues)
            // 3. Procesamos los datos antes de enviarlos a Angular
            const processedMatches = (matches as any[]).map(match => {

                return {
                    ...match,
                    JugadoresLocalNames: typeof match.JugadoresLocalNames === 'string' ? JSON.parse(match.JugadoresLocalNames) : match.JugadoresLocalNames,
                    JugadoresVisitanteNames: typeof match.JugadoresVisitanteNames === 'string' ? JSON.parse(match.JugadoresVisitanteNames) : match.JugadoresVisitanteNames,
                    NamesJugadoresPartido: typeof match.NamesJugadoresPartido === 'string' ? JSON.parse(match.NamesJugadoresPartido) : match.NamesJugadoresPartido
                };
            });

            // 4. Respondemos con todo listo
            res.json({
                misLigas: leagues,
                proximosPartidos: processedMatches
            });

        } catch (error) {
            console.error("Error en getHomeData:", error);
            res.status(500).json({ message: "Error interno del servidor obteniendo los datos" });
        }
    }
}


export const playersController = new PlayersController();
