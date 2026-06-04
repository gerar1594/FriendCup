import { Request, Response } from 'express';
import pool from '../database';
import { Parser } from 'expr-eval';

class MatchController {

    /**
     * 1. GENERACIÓN DE PARTIDOS SEMANALES CON PAREJAS BALANCEADAS (TOP + BOTTOM)
     * Diseñado para ligas de dobles (2 vs 2). Cruza los mejores con los peores del ranking.
     * Se puede invocar manualmente desde Angular o mediante el Cron Job automatizado.
     */
    public async generateBalancedPairsMatches1(req: Request, res: Response): Promise<any> {
        const { idLeague, dayTrip } = req.body;

        try {
            // 1. Obtener jugadores ordenados por: Menos partidos jugados -> Menos puntos -> Aleatorio
            const [jugadores]: any = await pool.query(
                `SELECT
                    p.IDPlayer, pl.NamePlayer,
                    (SELECT COUNT(*) FROM matchplayer mp
                    JOIN matches m ON mp.IDMatch = m.IDMatch
                    WHERE mp.IDPlayer = p.IDPlayer AND m.IDLeague = ?) as totalJugados,
                    (SELECT COALESCE(SUM(points), 0) FROM leagueplayer WHERE IDPlayer = p.IDPlayer AND IDLeague = ?) as puntosLiga
                FROM leagueplayer p, players pl
                WHERE pl.IDPlayer = p.IDPlayer
                AND p.IDLeague = ?
                ORDER BY totalJugados ASC, puntosLiga ASC, RAND()`,
                [idLeague, idLeague, idLeague]
            );


            // 2. Obtener historial reciente para evitar repeticiones (últimas 2 jornadas)
            const [historial]: any = await pool.query(
                `SELECT JugadoresLocal, JugadoresVisitante FROM matches
                WHERE IDLeague = ? ORDER BY DayTrip DESC LIMIT 20`,
                [idLeague]
            );

            const yaJugaron = (p1: number, p2: number) => {
                return historial.some((m: any) =>
                    (m.Local === p1 && m.Visitante === p2) ||
                    (m.Local === p2 && m.Visitante === p1)
                );
            };

            // 3. Gestionar descanso (impares)
            if (jugadores.length % 2 !== 0) {
                console.log(`Jugador ${jugadores.pop().Name} descansa esta jornada.`);
            }

            // 4. Emparejar con control de repetición
            const partidos = [];
            for (let i = 0; i < jugadores.length; i += 2) {
                let j1 = jugadores[i];
                let j2 = jugadores[i + 1];

                // Si ya jugaron hace poco, intentamos intercambiar con el siguiente
                if (yaJugaron(j1.IDPlayer, j2.IDPlayer) && i + 3 < jugadores.length) {
                    let temp = jugadores[i + 1];
                    jugadores[i + 1] = jugadores[i + 2];
                    jugadores[i + 2] = temp;
                    j2 = jugadores[i + 1];
                }

                partidos.push({ local: j1, visitante: j2 });
            }

            // 5. Guardar partidos en la BD
            const connection = await pool.getConnection();
            await connection.beginTransaction();

            try {
                for (const p of partidos) {
                    // Insertar partido
                    console.log("Partido",p);

                    console.log("INSERT INTO matches (IDLeague, DayTrip, Estado, JugadoresLocal, JugadoresVisitante) VALUES (?, ?, 'Pendiente', ?, ?)", [idLeague, dayTrip, p.local.NamePlayer, p.visitante.NamePlayer]);
                    const [resMatch]: any = await connection.query(
                        "INSERT INTO matches (IDLeague, DayTrip, Estado, JugadoresLocal, JugadoresVisitante) VALUES (?, ?, 'Pendiente', ?, ?)",
                        [idLeague, dayTrip, p.local.NamePlayer, p.visitante.NamePlayer]
                    );

                    const matchId = resMatch.insertId;

                    // Insertar relación con jugadores (matchplayer)
                    await connection.query(
                        "INSERT INTO matchplayer (IDMatch, IDPlayer, Bando) VALUES (?, ?, 'Local'), (?, ?, 'Visitante')",
                        [matchId, p.local.IDPlayer, matchId, p.visitante.IDPlayer]
                    );
                }
                await connection.commit();
                res.status(200).json({ message: `Jornada ${dayTrip} generada con éxito.` });
            } catch (err) {
                await connection.rollback();
                throw err;
            } finally {
                connection.release();
            }
        } catch (error: any) {
            res.status(500).json({ message: "Error crítico al generar la jornada: " + error.message });
        }
    }

    public async generateBalancedPairsMatches(req: Request, res: Response): Promise<any> {
        const { idLeague, dayTrip } = req.body;
        console.log(`🚀 Iniciando generación automática para Liga ${idLeague}, Jornada ${dayTrip}`);

        try {
            // 1. Obtener los datos de la liga y el deporte asociado
            const [liga]: any = await pool.query(
                `SELECT l.*, s.* FROM leagues l
                INNER JOIN sports s ON l.IDSport = s.IDSport
                WHERE l.IDLeague = ?`,
                [idLeague]
            );

            if (!liga || liga.length === 0) {
                return res.status(404).json({ message: "La liga especificada no existe." });
            }

            // 2. Obtener el historial completo de partidos de la liga para analizar repeticiones y descansos
            const [partidos]: any = await pool.query(
                `SELECT
                    m.IDMatch, m.IDLeague, m.DayTrip, m.Estado, m.Resultado, m.Winner,
                    (SELECT GROUP_CONCAT(mp.IDPlayer SEPARATOR ',')
                    FROM matchplayer mp
                    WHERE mp.IDMatch = m.IDMatch AND mp.Bando = 'Local') AS JugadoresLocalIDs,
                (SELECT GROUP_CONCAT(mp.IDPlayer SEPARATOR ',')
                    FROM matchplayer mp
                    WHERE mp.IDMatch = m.IDMatch AND mp.Bando = 'Visitante') AS JugadoresVisitanteIDs
                FROM matches m
                WHERE m.IDLeague = ?
                ORDER BY m.DayTrip DESC`,
                [idLeague]
            );

            // 3. Obtener todos los jugadores inscritos en la liga
            let [jugadores]: any = await pool.query(
                `SELECT lp.* FROM leagueplayer lp WHERE lp.IDLeague = ?`,
                [idLeague]
            );

            const PlayersTeam = liga[0].PlayersTeam;
            console.log(`Configuración del deporte: ${PlayersTeam} jugadores por equipo.`);

            // Validar que tengamos el mínimo absoluto para abrir pista (Ej: 2 para individuales, 4 para dobles)
            if (jugadores.length < PlayersTeam * 2) {
                console.log(`❌ Jugadores insuficientes en liga: ${jugadores.length}. Requeridos: ${PlayersTeam * 2}`);
                return res.status(400).json({ message: `No hay suficientes jugadores inscritos. Se requieren mínimo ${PlayersTeam * 2}.` });
            }

            // ==========================================================
            // 📊 1. CÁLCULO DE ASIGNACIONES TOTALES PARA ROTACIÓN DE DESCANSOS
            // ==========================================================
            const partidosAsignados: Record<number, number> = {};
            jugadores.forEach((j: any) => {
                partidosAsignados[j.IDPlayer] = 0; // Inicializamos contador a cero
            });

            // Mapeamos el historial (tanto partidos pendientes como finalizados)
            partidos.forEach((partido: any) => {
                const locales = partido.JugadoresLocalIDs ? partido.JugadoresLocalIDs.split(',').map(Number) : [];
                const visitantes = partido.JugadoresVisitanteIDs ? partido.JugadoresVisitanteIDs.split(',').map(Number) : [];

                const todosLosConvocados = [...locales, ...visitantes];
                todosLosConvocados.forEach((id: number) => {
                    if (partidosAsignados[id] !== undefined) {
                        partidosAsignados[id]++; // Sumamos presencia planificada
                    }
                });
            });

            // ==========================================================
            // 💤 2. SELECCIÓN ESTRICTA DE DESCANSOS POR CONVOCATORIA
            // ==========================================================
            const tamañoPartidoCompleto = PlayersTeam * 2;
            const numParaDescansar = jugadores.length % tamañoPartidoCompleto;

            if (numParaDescansar > 0) {
                // Ordenamos colocando arriba a los que MÁS han sido convocados en total.
                // Si empatan en convocatorias, descansa el que más puntos (Points) tenga para equilibrar niveles.
                const rankingDescanso = [...jugadores].sort((a, b) => {
                    const diffConvocatorias = partidosAsignados[b.IDPlayer] - partidosAsignados[a.IDPlayer];
                    if (diffConvocatorias !== 0) return diffConvocatorias;
                    return b.Points - a.Points;
                });

                const idsQueDescansan = rankingDescanso.slice(0, numParaDescansar).map(j => j.IDPlayer);
                console.log(`💤 [SISTEMA ROTATIVO] Descansan por exceso de asignaciones: ${idsQueDescansan.join(', ')}`);

                // Excluimos del corte de juego de esta jornada a los seleccionados para descansar
                jugadores = jugadores.filter((j: any) => !idsQueDescansan.includes(j.IDPlayer));
            }

            // ==========================================================
            // ⚔️ 3. ORDENACIÓN POR NIVEL PARA LOS EMPAREJAMIENTOS
            // ==========================================================
            // Los jugadores activos se ordenan por Points ASC para que los emparejamientos contiguos sean de nivel similar
            jugadores.sort((a: any, b: any) => a.Points - b.Points);

            // ==========================================================
            // 🧙‍♂️ 4. ALGORITMO COMPLETO ANTI-REPETICIONES (PAREJAS Y ENFRENTAMIENTOS)
            // ==========================================================

            // Verificación de enfrentamiento previo entre dos bloques de IDs
            const yaSeEnfrentaron = (idsLocales: number[], idsVisitantes: number[]) => {
                return partidos.some((partido: any) => {
                    if (!partido.JugadoresLocalIDs || !partido.JugadoresVisitanteIDs) return false;
                    const pLocalBD = partido.JugadoresLocalIDs.split(',').map(Number);
                    const pVisitanteBD = partido.JugadoresVisitanteIDs.split(',').map(Number);

                    const cumpleDirecto = idsLocales.every(id => pLocalBD.includes(id)) && idsVisitantes.every(id => pVisitanteBD.includes(id));
                    const cumpleInverso = idsLocales.every(id => pVisitanteBD.includes(id)) && idsVisitantes.every(id => pLocalBD.includes(id));

                    return cumpleDirecto || cumpleInverso;
                });
            };

            // Verificación de bando/compañeros previos
            const yaFueronCompañeros = (idsEquipo: number[]) => {
                if (idsEquipo.length <= 1) return false; // En deportes individuales (1vs1) no aplica
                return partidos.some((partido: any) => {
                    if (!partido.JugadoresLocalIDs || !partido.JugadoresVisitanteIDs) return false;
                    const pLocalBD = partido.JugadoresLocalIDs.split(',').map(Number);
                    const pVisitanteBD = partido.JugadoresVisitanteIDs.split(',').map(Number);

                    return idsEquipo.every(id => pLocalBD.includes(id)) || idsEquipo.every(id => pVisitanteBD.includes(id));
                });
            };

            const partidosAGenerar = [];

            while (jugadores.length >= tamañoPartidoCompleto) {
                let localTeam = jugadores.slice(0, PlayersTeam);
                let idsLocales = localTeam.map((j: any) => j.IDPlayer);

                // Romper Pareja Local si es repetida
                if (yaFueronCompañeros(idsLocales) && jugadores.length > PlayersTeam) {
                    console.log(`🔄 Pareja Local repetida detectada (${idsLocales}). Alterando composición...`);
                    let temp = jugadores[1];
                    jugadores[1] = jugadores[PlayersTeam];
                    jugadores[PlayersTeam] = temp;

                    localTeam = jugadores.slice(0, PlayersTeam);
                    idsLocales = localTeam.map((j: any) => j.IDPlayer);
                }

                // Extraemos definitivamente al equipo Local de la cola activa
                jugadores.splice(0, PlayersTeam);

                let visitanteTeam = jugadores.slice(0, PlayersTeam);
                let idsVisitantes = visitanteTeam.map((j: any) => j.IDPlayer);

                // Romper Pareja Visitante o Enfrentamiento repetido
                if ((yaFueronCompañeros(idsVisitantes) || yaSeEnfrentaron(idsLocales, idsVisitantes)) && jugadores.length > PlayersTeam) {
                    console.log(`🔄 Conflicto detectado en Visitantes (Repetición de bando o partido). Buscando bloque alternativo...`);
                    const bloqueAlternativo = jugadores.slice(PlayersTeam, PlayersTeam * 2);

                    if (bloqueAlternativo.length === PlayersTeam) {
                        visitanteTeam = bloqueAlternativo;
                        jugadores.splice(PlayersTeam, PlayersTeam); // Quitamos el bloque alternativo usado
                    } else {
                        jugadores.splice(0, PlayersTeam); // No hay alternativa completa, usamos el bloque por defecto
                    }
                } else {
                    jugadores.splice(0, PlayersTeam); // Sin conflictos, extraemos el primer bloque normal
                }

                partidosAGenerar.push({ local: localTeam, visitante: visitanteTeam });
            }

            // ==========================================================
            // 💾 5. GUARDADO TRANSACCIONAL EN LA BASE DE DATOS
            // ==========================================================
            const connection = await pool.getConnection();
            await connection.beginTransaction();

            try {
                console.log(liga[0].ResultadoFormat.periodosDefecto);
                for (const p of partidosAGenerar) {
                    const nombresLocales = p.local.map((j: any) => `Jugador ${j.IDPlayer}`).join(' / ');
                    const nombresVisitantes = p.visitante.map((j: any) => `Jugador ${j.IDPlayer}`).join(' / ');

                    const resultadoPorDefecto = JSON.stringify({totalLocal: 0, totalVisitante: 0, periodos: liga[0].ResultadoFormat.periodosDefecto});
                    // A) Insertar el registro maestro en 'matches'
                    const [resMatch]: any = await connection.query(
                        `INSERT INTO matches (IDLeague, DayTrip, Estado, JugadoresLocal, JugadoresVisitante, Resultado) 
                        VALUES (?, ?, 'Pendiente', ?, ?, ?)`,
                        [idLeague, dayTrip, nombresLocales, nombresVisitantes, resultadoPorDefecto]
                    );

                    const matchId = resMatch.insertId;

                    // B) Insertar desglose dinámico en 'matchplayer' para el bando Local
                    for (const jugador of p.local) {
                        await connection.query(
                            `INSERT INTO matchplayer (IDMatch, IDPlayer, Bando) VALUES (?, ?, 'Local')`,
                            [matchId, jugador.IDPlayer]
                        );
                    }

                    // C) Insertar desglose dinámico en 'matchplayer' para el bando Visitante
                    for (const jugador of p.visitante) {
                        await connection.query(
                            `INSERT INTO matchplayer (IDMatch, IDPlayer, Bando) VALUES (?, ?, 'Visitante')`,
                            [matchId, jugador.IDPlayer]
                        );
                    }
                }

                // Confirmamos los cambios de forma simultánea
                await connection.commit();
                console.log(`✅ ¡Jornada ${dayTrip} consolidada con éxito en la Base de Datos!`);

                return res.status(200).json({ message: `Jornada ${dayTrip} generada correctamente evitando duplicidades.` });

            } catch (transactionError) {
                // Si cualquier query interna falla, revertimos todo para evitar datos corruptos
                await connection.rollback();
                throw transactionError;
            } finally {
                connection.release(); // Liberamos la conexión de vuelta al pool siempre
            }

        } catch (error: any) {
            console.error("❌ Error crítico en el proceso de generación:", error.message);
            return res.status(500).json({ message: "Error crítico al generar la jornada: " + error.message });
        }

    }

    public async getMatchesByUser(req: Request, res: Response): Promise<any> {
        const { idPlayer } = req.params;

        try {

            const querySql =`SELECT DISTINCT 
                                            m.IDMatch, 
                                            m.DayTrip, 
                                            m.JugadoresLocal, 
                                            m.JugadoresVisitante,
                                            m.Estado, 
                                            m.Resultado, 
                                            l.NameLeague, 
                                            s.*, 
                                            mp.Bando AS bando,

                                            -- 🏠 LOCALES: Devuelve un array de objetos JSON
                                            (SELECT JSON_ARRAYAGG(
                                                        JSON_OBJECT(
                                                            'NamePlayer', pl_loc.NamePlayer,
                                                            'NamePlayerLeague', lp_loc.NamePlayerLeague
                                                        )
                                                    )
                                            FROM matchplayer mp_local
                                            JOIN players pl_loc ON mp_local.IDPlayer = pl_loc.IDPlayer
                                            LEFT JOIN leagueplayer lp_loc ON pl_loc.IDPlayer = lp_loc.IDPlayer AND lp_loc.IDLeague = m.IDLeague
                                            WHERE mp_local.IDMatch = m.IDMatch
                                            AND mp_local.Bando = 'Local') AS JugadoresLocalNames,

                                            -- 🏃‍♂️ VISITANTES: Devuelve un array de objetos JSON
                                            (SELECT JSON_ARRAYAGG(
                                                        JSON_OBJECT(
                                                            'NamePlayer', pl_vis.NamePlayer,
                                                            'NamePlayerLeague', lp_vis.NamePlayerLeague
                                                        )
                                                    )
                                            FROM matchplayer mp_visit
                                            JOIN players pl_vis ON mp_visit.IDPlayer = pl_vis.IDPlayer
                                            LEFT JOIN leagueplayer lp_vis ON pl_vis.IDPlayer = lp_vis.IDPlayer AND lp_vis.IDLeague = m.IDLeague
                                            WHERE mp_visit.IDMatch = m.IDMatch
                                            AND mp_visit.Bando = 'Visitante') AS JugadoresVisitanteNames

                                        FROM matches m
                                        INNER JOIN matchplayer mp ON m.IDMatch = mp.IDMatch
                                        INNER JOIN leagues l ON m.IDLeague = l.IDLeague
                                        INNER JOIN sports s ON l.IDSport = s.IDSport
                                        WHERE mp.IDPlayer = ?
                                        ORDER BY m.DayTrip ASC, m.Estado DESC;`

            /*console.log("================== QUERY EJECUTADA ==================");
            console.log(pool.format(querySql, [idPlayer]));
            console.log("=====================================================");*/

            const [userMatches]: any = await pool.query(querySql,[idPlayer]);
            
            // IMPORTANTE: MySQL devuelve las columnas de tipo JSON ya parseadas como objetos JS de forma nativa.

            const formattedMatches = userMatches.map((match: any) => ({
                ...match,
                JugadoresLocalNames: typeof match.JugadoresLocalNames === 'string' ? JSON.parse(match.JugadoresLocalNames) : match.JugadoresLocalNames,
                JugadoresVisitanteNames: typeof match.JugadoresVisitanteNames === 'string' ? JSON.parse(match.JugadoresVisitanteNames) : match.JugadoresVisitanteNames,
                NamesJugadoresPartido: typeof match.NamesJugadoresPartido === 'string' ? JSON.parse(match.NamesJugadoresPartido) : match.NamesJugadoresPartido
            }));
            res.json({
                userMatches: formattedMatches
            });
        } catch (error: any) {
            console.error("Error al obtener los partidos del usuario:", error.message);
            res.status(500).json({ message: "Error al obtener los partidos del usuario: " + error.message });
        }
    }

    public async getMatchesByLeague(req: Request, res: Response): Promise<any> {
        const { idleague } = req.params;
        const currentUserId = req.headers['x-user-id'];

        console.log(`Obteniendo partidos para Liga ${idleague} y Usuario ${currentUserId}`);

       // 1. Guardamos el string de la query en una constante
        const querySql = `SELECT DISTINCT 
                m.IDMatch, 
                m.DayTrip, 
                m.Estado, 
                m.Resultado, 
                l.NameLeague, 
                s.*,

                (SELECT JSON_ARRAYAGG(JSON_OBJECT(
                    'NamePlayer', pl_loc.NamePlayer,
                    'NamePlayerLeague', lp_loc.NamePlayerLeague
                ))
                FROM matchplayer mp_local
                JOIN players pl_loc ON mp_local.IDPlayer = pl_loc.IDPlayer
                -- Añadimos JOIN con leagueplayer para sacar el apodo de la liga
                LEFT JOIN leagueplayer lp_loc ON lp_loc.IDPlayer = pl_loc.IDPlayer AND lp_loc.IDLeague = m.IDLeague
                WHERE mp_local.IDMatch = m.IDMatch
                AND mp_local.Bando = 'Local') AS JugadoresLocalNames,

                -- 🏃‍♂️ Apodos/Nombres de los jugadores Visitantes de este partido
                (SELECT JSON_ARRAYAGG(JSON_OBJECT(
                    'NamePlayer', pl_vis.NamePlayer,
                    'NamePlayerLeague', lp_vis.NamePlayerLeague
                ))
                FROM matchplayer mp_visit
                JOIN players pl_vis ON mp_visit.IDPlayer = pl_vis.IDPlayer
                -- Añadimos JOIN con leagueplayer para sacar el apodo de la liga
                LEFT JOIN leagueplayer lp_vis ON lp_vis.IDPlayer = pl_vis.IDPlayer AND lp_vis.IDLeague = m.IDLeague
                WHERE mp_visit.IDMatch = m.IDMatch
                AND mp_visit.Bando = 'Visitante') AS JugadoresVisitanteNames,

                (SELECT bando FROM matchplayer mp2 WHERE mp2.IDMatch = m.IDMatch AND mp2.IDPlayer = ?) AS bando

            FROM matches m
            INNER JOIN matchplayer mp ON m.IDMatch = mp.IDMatch
            INNER JOIN leagues l ON m.IDLeague = l.IDLeague
            INNER JOIN sports s ON l.IDSport = s.IDSport
            WHERE m.IDLeague = ? AND m.DayTrip IS NOT NULL
            ORDER BY m.DayTrip ASC, m.Estado DESC;`;

        // 2. Usamos pool.format para renderizar el string final con sus parámetros mapeados
        /*console.log("================== QUERY EJECUTADA ==================");
        console.log(pool.format(querySql, [currentUserId,idleague]));
        console.log("=====================================================");*/

        // 3. Pasamos la constante formateada directamente a la base de datos
        const [matches]: any = await pool.query(querySql, [currentUserId, idleague]);
        
        const formattedMatches = matches.map((match: any) => ({
            ...match,
            JugadoresLocalNames: typeof match.JugadoresLocalNames === 'string' ? JSON.parse(match.JugadoresLocalNames) : match.JugadoresLocalNames,
            JugadoresVisitanteNames: typeof match.JugadoresVisitanteNames === 'string' ? JSON.parse(match.JugadoresVisitanteNames) : match.JugadoresVisitanteNames,
            NamesJugadoresPartido: typeof match.NamesJugadoresPartido === 'string' ? JSON.parse(match.NamesJugadoresPartido) : match.NamesJugadoresPartido
        }));

        res.json({
            matches: formattedMatches
        });

    }
    
    public async getMatchesExtraByLeague(req: Request, res: Response): Promise<any> {
        const { idleague } = req.params;
        const currentUserId = req.headers['x-user-id'];

        console.log(`Obteniendo partidos para Liga ${idleague} y Usuario ${currentUserId}`);

       // 1. Guardamos el string de la query en una constante
        const querySql = `SELECT DISTINCT
                m.IDMatch,
                m.DayTrip,
                m.Estado,
                m.Resultado,
                l.NameLeague,
                s.*,

                (SELECT JSON_ARRAYAGG(JSON_OBJECT(
                    'NamePlayer', pl_loc.NamePlayer,
                    'NamePlayerLeague', lp_loc.NamePlayerLeague
                ))
                FROM matchplayer mp_local
                JOIN players pl_loc ON mp_local.IDPlayer = pl_loc.IDPlayer
                -- Añadimos JOIN con leagueplayer para sacar el apodo de la liga
                LEFT JOIN leagueplayer lp_loc ON lp_loc.IDPlayer = pl_loc.IDPlayer AND lp_loc.IDLeague = m.IDLeague
                WHERE mp_local.IDMatch = m.IDMatch
                AND mp_local.Bando = 'Local') AS JugadoresLocalNames,

                -- 🏃‍♂️ Apodos/Nombres de los jugadores Visitantes de este partido
                (SELECT JSON_ARRAYAGG(JSON_OBJECT(
                    'NamePlayer', pl_vis.NamePlayer,
                    'NamePlayerLeague', lp_vis.NamePlayerLeague
                ))
                FROM matchplayer mp_visit
                JOIN players pl_vis ON mp_visit.IDPlayer = pl_vis.IDPlayer
                -- Añadimos JOIN con leagueplayer para sacar el apodo de la liga
                LEFT JOIN leagueplayer lp_vis ON lp_vis.IDPlayer = pl_vis.IDPlayer AND lp_vis.IDLeague = m.IDLeague
                WHERE mp_visit.IDMatch = m.IDMatch
                AND mp_visit.Bando = 'Visitante') AS JugadoresVisitanteNames,

                (SELECT bando FROM matchplayer mp2 WHERE mp2.IDMatch = m.IDMatch AND mp2.IDPlayer = ?) AS bando

            FROM matches m
            INNER JOIN matchplayer mp ON m.IDMatch = mp.IDMatch
            INNER JOIN leagues l ON m.IDLeague = l.IDLeague
            INNER JOIN sports s ON l.IDSport = s.IDSport
            WHERE m.IDLeague = ? AND m.DayTrip IS NULL
            ORDER BY m.DayTrip ASC, m.Estado DESC;`;

        // 2. Usamos pool.format para renderizar el string final con sus parámetros mapeados
        /*console.log("================== QUERY EJECUTADA ==================");
        console.log(pool.format(querySql, [currentUserId,idleague]));
        console.log("=====================================================");*/

        // 3. Pasamos la constante formateada directamente a la base de datos
        const [matches]: any = await pool.query(querySql, [currentUserId, idleague]);
        
        const formattedMatches = matches.map((match: any) => ({
            ...match,
            JugadoresLocalNames: typeof match.JugadoresLocalNames === 'string' ? JSON.parse(match.JugadoresLocalNames) : match.JugadoresLocalNames,
            JugadoresVisitanteNames: typeof match.JugadoresVisitanteNames === 'string' ? JSON.parse(match.JugadoresVisitanteNames) : match.JugadoresVisitanteNames,
            NamesJugadoresPartido: typeof match.NamesJugadoresPartido === 'string' ? JSON.parse(match.NamesJugadoresPartido) : match.NamesJugadoresPartido
        }));

        res.json({
            matches: formattedMatches
        });

    }
    

    /**
     * 3. ACTUALIZAR EL MARCADOR DINÁMICO EN FORMATO JSON
     * Guarda los totales y los sets/cuartos en una única columna agnóstica al tipo de deporte.
     */
    public async updateMatchResult(req: Request, res: Response): Promise<any> {
        const { idMatch } = req.params;
        const { periodos } = req.body; // Array enviado: [{label: 'C1', local: 20, visitante: 15}, ...]
        const currentUserId = req.headers['x-user-id'];

        // 🧩 PARSEADOR INTELIGENTE
        let datosPeriodos: any[] = [];
        if (req.body.periodos) {
            if (typeof req.body.periodos === 'string') {
                // Si viene como texto "[{"label":"S1",...}]", lo transformamos en Array real
                datosPeriodos = JSON.parse(req.body.periodos);
            } else if (Array.isArray(req.body.periodos)) {
                // Si ya venía como un Array de verdad, lo asignamos directamente
                datosPeriodos = req.body.periodos;
            }
        }

        try {
            const connection = await pool.getConnection();
            await connection.beginTransaction();
            const [playerBando]: any = await connection.query(
                `SELECT Bando FROM matchplayer WHERE IDMatch = ? AND IDPlayer = ?`,
                [idMatch, currentUserId]
            );

            if (playerBando.length === 0) {
                await connection.rollback();
                return res.status(403).json({ message: "No tienes permiso para editar este partido porque no participas en él." });
            }

            const bandoEditor = playerBando[0].Bando; // Devuelve 'Local' o 'Visitante'

            try {
                // 1. Obtener las fórmulas de texto desde la base de datos
                const [matchConfig]: any = await connection.query(
                    `SELECT s.ResultadoFormat
                    FROM matches m
                    JOIN leagues l ON m.IDLeague = l.IDLeague
                    JOIN sports s ON l.IDSport = s.IDSport
                    WHERE m.IDMatch = ?`, [idMatch]
                );

                if (matchConfig.length === 0) {
                    await connection.rollback();
                    return res.status(404).json({ message: "Configuración deportiva no encontrada." });
                }

                const formato = matchConfig[0].ResultadoFormat;
                const fLocalText = formato.formulaLocal;       // Ej: "p1_l + p2_l + p3_l + p4_l"
                const fVisitanteText = formato.formulaVisitante; // Ej: "p1_v + p2_v + p3_v + p4_v"

                // 2. 🧩 PREPARAR LAS VARIABLES PARA EL EXCEL
                // Vamos a crear un objeto plano con las variables dinámicas
                // Al final lucirá así: { p1_l: 20, p1_v: 15, p2_l: 10... }
                const variablesEntrada: any = {};

                datosPeriodos.forEach((p: any, index: number) => {
                    const numeroPeriodo = index + 1;

                    variablesEntrada[`p${numeroPeriodo}_l`] = Number(p.local || 0);
                    variablesEntrada[`p${numeroPeriodo}_v`] = Number(p.visitante || 0);
                });


                // 3. 🧮 EJECUTAR LAS FÓRMULAS TEXTUALES
                // Inicializamos el parseador seguro de expr-eval
                const parser = new Parser();

                // Compilamos las fórmulas que extrajimos de phpMyAdmin
                const exprLocal = parser.parse(fLocalText);
                const exprVisitante = parser.parse(fVisitanteText);

                // Evaluamos las fórmulas pasándole el objeto con los números reales
                const totalLocal = exprLocal.evaluate(variablesEntrada);
                const totalVisitante = exprVisitante.evaluate(variablesEntrada);

                // 4. ESTRUCTURAR EL MARCADOR FINAL Y GUARDAR
                const marcadorJSON = {
                    totalLocal: Math.round(totalLocal), // Evitamos decimales extraños
                    totalVisitante: Math.round(totalVisitante),
                    periodos: datosPeriodos
                };
                let winner = 0;
                if(Math.round(totalLocal) > Math.round(totalVisitante)) {
                    winner = 1; // Gana Local
                }else if (Math.round(totalVisitante) > Math.round(totalLocal)) {
                    winner = 2; // Gana Visitante
                } else if (Math.round(totalVisitante) == Math.round(totalLocal)){
                    winner = 3; // Empate
                }else{
                    throw new Error("Error en los resultados finales");
                }
                let nuevoEstado = "Confirmado Visitante";
                if (bandoEditor === 'Local') {
                    nuevoEstado = "Confirmado Local";
                }

                console.log(JSON.stringify(marcadorJSON), nuevoEstado, winner);
                await connection.query(
                    "UPDATE matches SET Resultado = '" + JSON.stringify(marcadorJSON) +"', Estado = '" + nuevoEstado + "', Winner = " + winner + " WHERE IDMatch = ?",
                    [idMatch]
                );

                await connection.commit();
                res.json({ 
                    message: `Fórmula procesada con éxito. Resultado calculado: ${marcadorJSON.totalLocal} - ${marcadorJSON.totalVisitante}` 
                });

            } catch (err) {
                await connection.rollback();
                throw err;
            } finally {
                connection.release();
            }
        } catch (error: any) {
            res.status(500).json({ message: "Error crítico en el motor avanzado: " + error.message });
        }
    }


    public async validateMatchResult(req: Request, res: Response): Promise<any> {
        const { idMatch } = req.params;
        const currentUserId = req.headers['x-user-id'];

        try {
            const connection = await pool.getConnection();
            await connection.beginTransaction();

            try {
                // ==========================================================
                // 1. OBTENER INFORMACIÓN DEL PARTIDO Y REGLAS DEL DEPORTE
                // ==========================================================
                const [matchData]: any = await connection.query(
                    `SELECT m.IDLeague, m.Winner, m.Estado, m.DayTrip,
                        (SELECT Bando FROM matchplayer WHERE IDMatch = m.IDMatch AND IDPlayer = ?) AS BandoEditor,
                        (SELECT GROUP_CONCAT(IDPlayer) FROM matchplayer WHERE IDMatch = m.IDMatch AND Bando = 'Local') AS LocalesIDs,
                        (SELECT GROUP_CONCAT(IDPlayer) FROM matchplayer WHERE IDMatch = m.IDMatch AND Bando = 'Visitante') AS VisitantesIDs
                        l.Configuration
                    FROM matches m
                    JOIN leagues l ON m.IDLeague = l.IDLeague
                    JOIN sports s ON l.IDSport = s.IDSport
                    WHERE m.IDMatch = ?`,
                    [currentUserId, idMatch]
                );
                if (matchData.length === 0 ) {
                    await connection.rollback();
                    return res.status(404).json({ message: "Partido no encontrado." });
                }

                const partido = matchData[0];

                // Validación de seguridad: el usuario debe participar en el partido
                if (!partido.BandoEditor || partido.IDAdmin != currentUserId) {
                    await connection.rollback();
                    return res.status(403).json({ message: "No tienes permiso para confirmar este partido porque no participas en él." });
                }

                // Evitar doble sumatorio si le dan dos veces al botón rápido
                if (partido.Estado === 'Jugado' || partido.Estado === 'Finalizado') {
                    await connection.rollback();
                    return res.status(400).json({ message: "Este partido ya ha sido cerrado previamente." });
                }

                // ==========================================================
                // 2. MÁQUINA DE ESTADOS (Doble Firma)
                // ==========================================================
                let nuevoEstado = partido.Estado;
                let debeCerrarYAsignar = false;
                if(partido.IDAdmin == currentUserId) {
                    nuevoEstado = 'Jugado';
                    debeCerrarYAsignar = true;
                } else if (partido.BandoEditor === 'Local' && partido.Estado === 'Confirmado Visitante') {
                    nuevoEstado = 'Jugado'; // Seteamos 'Jugado' que es el enum de tu base de datos
                    debeCerrarYAsignar = true;
                } else if (partido.BandoEditor === 'Visitante' && partido.Estado === 'Confirmado Local') {
                    nuevoEstado = 'Jugado';
                    debeCerrarYAsignar = true;
                } else {
                    await connection.rollback();
                    return res.status(400).json({ message: "Falta la confirmación del bando contrario antes de consolidar el partido." });
                }

                 const [league]: any = await pool.query(
                    `SELECT IDAdmin,Configuration FROM leagues l
                    JOIN matches m ON l.IDLeague = m.IDLeague
                    WHERE m.IDMatch = ? AND l.IDAdmin = ?`,
                    [idMatch, currentUserId]
                );

                // DENTRO DE TU CIERRE EN 'validateMatchResult':
                const configuration = JSON.parse(league[0].Configuration)

                if (debeCerrarYAsignar && (matchData.DayTrip == null && configuration.sumarJornadasExtra)) {
                    // 🔥 Reutilizamos la función común de asignación de puntos
                    await asignarPuntosLiga(connection, partido);
                }

                // ==========================================================
                // 4. CAMBIO DE ESTADO DEL PARTIDO EN 'matches'
                // ==========================================================
                await connection.query(
                    "UPDATE matches SET Estado = ? WHERE IDMatch = ?",
                    [nuevoEstado, idMatch]
                );
                await connection.commit();

                return res.status(200).json({
                    message: debeCerrarYAsignar
                        ? "Partido finalizado. Puntos, partidos, victorias y derrotas asignados."
                        : "Confirmación registrada. Esperando la firma del rival.",
                    estado: nuevoEstado
                });

            } catch (err) {
                await connection.rollback();
                throw err;
            } finally {
                connection.release();
            }
        } catch (error: any) {
            return res.status(500).json({ message: "Error al actualizar las estadísticas de la liga: " + error.message });
        }
    }

    public async adminForceUpdateAndValidate(req: Request, res: Response): Promise<any> {
        const { idMatch } = req.params;
        const currentUserId = req.headers['x-user-id'];

        let datosPeriodos: any[] = [];
        if (req.body.periodos) {
            datosPeriodos = typeof req.body.periodos === 'string' ? JSON.parse(req.body.periodos) : req.body.periodos;
        }
        const [isAdmin]: any = await pool.query(
            `SELECT IDAdmin,Configuration FROM leagues l
            JOIN matches m ON l.IDLeague = m.IDLeague
            WHERE m.IDMatch = ? AND l.IDAdmin = ?`,
            [idMatch, currentUserId]
        );
        if (isAdmin.length === 0) {
            return res.status(403).json({ message: "Acceso denegado. Solo el administrador de la liga puede realizar esta acción." });
        }


        try {
            const connection = await pool.getConnection();
            await connection.beginTransaction();

            try {
                // ==========================================================
                // 1. VERIFICACIÓN ESTRICTA DE PERMISOS DE ADMINISTRADOR
                // ==========================================================
                const [matchConfig]: any = await connection.query(
                    `SELECT s.ResultadoFormat, m.IDLeague, m.Estado, l.IDAdmin,
                        (SELECT GROUP_CONCAT(IDPlayer) FROM matchplayer WHERE IDMatch = m.IDMatch AND Bando = 'Local') AS LocalesIDs,
                        (SELECT GROUP_CONCAT(IDPlayer) FROM matchplayer WHERE IDMatch = m.IDMatch AND Bando = 'Visitante') AS VisitantesIDs
                    FROM matches m
                    JOIN leagues l ON m.IDLeague = l.IDLeague
                    JOIN sports s ON l.IDSport = s.IDSport
                    WHERE m.IDMatch = ?`, [idMatch]
                );

                if (matchConfig.length === 0) {
                    await connection.rollback();
                    return res.status(404).json({ message: "Partido o configuración no encontrada." });
                }

                const partido = matchConfig[0];

                // 🛑 Seguridad letal: Si el que ejecuta no coincide con el IDAdmin de la liga, rebotamos
                if (partido.IDAdmin != currentUserId) {
                    await connection.rollback();
                    return res.status(403).json({ message: "Acceso denegado. No eres el administrador de esta liga." });
                }

                if (partido.Estado === 'Jugado' || partido.Estado === 'Finalizado') {
                    await connection.rollback();
                    return res.status(400).json({ message: "Este partido ya se encuentra cerrado y puntuado." });
                }

                // ==========================================================
                // 2. PARSEO Y EVALUACIÓN MATEMÁTICA DEL MARCADOR
                // ==========================================================
                const formato = partido.ResultadoFormat;
                const parser = new Parser();
                const exprLocal = parser.parse(formato.formulaLocal);
                const exprVisitante = parser.parse(formato.formulaVisitante);

                const variablesEntrada: any = {};
                datosPeriodos.forEach((p: any, index: number) => {
                    const numeroPeriodo = index + 1;
                    variablesEntrada[`p${numeroPeriodo}_l`] = Number(p.local || 0);
                    variablesEntrada[`p${numeroPeriodo}_v`] = Number(p.visitante || 0);
                });
                const totalLocal = Math.round(exprLocal.evaluate(variablesEntrada));
                const totalVisitante = Math.round(exprVisitante.evaluate(variablesEntrada));

                // Estructuramos el JSON final
                const marcadorJSON = {
                    totalLocal,
                    totalVisitante,
                    periodos: datosPeriodos
                };

                // Determinamos ganador
                let winner = 3; // Empate por defecto
                if (totalLocal > totalVisitante) winner = 1;
                else if (totalVisitante > totalLocal) winner = 2;

                // Inyectamos dinámicamente los campos calculados al vuelo en el objeto 'partido' 
                // para que nuestro motor auxiliar sepa qué hacer sin ir de nuevo a la base de datos
                partido.Winner = winner;
                // ==========================================================
                // 3. APLICAR CAMBIOS DE MARCADOR Y REPARTIR PUNTOS DE GOLPE
                // ==========================================================
                // Actualizamos el marcador directamente
                await connection.query(
                    `UPDATE matches 
                    SET Resultado = ?, Estado = 'Jugado', Winner = ? 
                    WHERE IDMatch = ?`,
                    [JSON.stringify(marcadorJSON), winner, idMatch]
                );

                // Reutilizamos el motor interno pasando la conexión transaccional
                const configuration = JSON.parse(isAdmin[0].Configuration)

                if(partido.DayTrip != null || (partido.DayTrip == null && configuration.sumarJornadasExtra))
                    await asignarPuntosLiga(connection, partido);

                await connection.commit();
                return res.status(200).json({
                    message: "Acción de administrador completada. Partido editado, cerrado y puntuado.",
                    estado: "Jugado"
                });

            } catch (err) {
                await connection.rollback();
                throw err;
            } finally {
                connection.release();
            }
        } catch (error: any) {
            console.log("❌ Error crítico en la gestión de administración:", error.message);
            return res.status(500).json({ message: "Error crítico en la gestión de administración: " + error.message });
        }
    }

    public async deleteMatch (req: Request, res: Response) {
        const { idMatch } = req.body;
        const currentUserId = req.headers['x-user-id'];

        if (!idMatch) {
            return res.status(400).json({ message: "El ID del partido es obligatorio." });
        }

        const [league]: any = await pool.query(
            `SELECT IDAdmin,Configuration FROM leagues l
            JOIN matches m ON l.IDLeague = m.IDLeague
            WHERE m.IDMatch = ? AND l.IDAdmin = ?`,
            [idMatch, currentUserId]
        );
        if (league.length === 0) {
            return res.status(403).json({ message: "Acceso denegado. Solo el administrador de la liga puede realizar esta acción." });
        }

        try {
            const connection = await pool.getConnection();
            await connection.beginTransaction();

            try {
                // 1. Obtener los datos del partido, su estado y la liga
                const [matchRows]: any = await connection.query(
                    "SELECT IDMatch, DayTrip, IDLeague, Estado, Resultado FROM matches WHERE IDMatch = ?",
                    [idMatch]
                );

                if (matchRows.length === 0) {
                    await connection.rollback();
                    return res.status(404).json({ message: "El partido no existe." });
                }

                const { DayTrip: jornadaActual, IDLeague: idLiga, Estado: estadoPartido, Resultado: resultado } = matchRows[0];

                // 2. OBTENER JUGADORES Y REVERTIR PUNTOS (Solo si el partido ya estaba Finalizado)

                if (estadoPartido === 'Jugado' && resultado && (jornadaActual !== null || (jornadaActual === null && league[0].Configuration.sumarJornadasExtra))) {
                    // Sacamos los jugadores de este partido y su bando
                    const [playersRows]: any = await connection.query(
                        "SELECT IDPlayer, Bando FROM matchplayer WHERE IDMatch = ?",
                        [idMatch]
                    );

                    // Parseamos el resultado (Ejemplo esperado: "2-1" o "6-4 6-2")
                    // Adapta esta lógica exacta a cómo almacenes tú el string del resultado
                    console.log("Resultado bruto a parsear:", resultado);
                    const setsLocal = resultado.totalLocal || 0;
                    const setsVisitante = resultado.totalVisitante || 0;

                    const localGana = setsLocal > setsVisitante;

                    // Iteramos sobre los jugadores que jugaron el partido para restarles las estadísticas
                    for (const player of playersRows) {
                        const esLocal = player.Bando === 'Local';
                        const haGanado = (esLocal && localGana) || (!esLocal && !localGana);

                        // Calculamos los valores en negativo para "restarlos" en el UPDATE
                        let puntosARestar = 0; // Ajusta tus puntos por victoria (3) / derrota (1)
                        const partidosJugados = 1;
                        let partidosGanados = 0;
                        let partidosPerdidos = 0;
                        let partidosEmpatados = 0; // Si manejas empates, ajusta esta lógica
                        const setsFavor = esLocal ? setsLocal : setsVisitante;
                        const setsContra = esLocal ? setsVisitante : setsLocal;

                        if(setsFavor === setsContra) {
                            puntosARestar = 1; // En caso de empate, restamos 1 punto a ambos
                            partidosEmpatados = 1;
                        } else if (setsFavor > setsContra) {
                            puntosARestar = 3; // En caso de victoria, restamos 3 puntos
                            partidosGanados = 1;
                        } else {
                            puntosARestar = 0; // En caso de derrota, no restamos puntos (o ajusta según tu sistema)
                            partidosPerdidos = 1;
                        }

                        // Actualizamos la clasificación de la liga restando los datos de este partido
                        await connection.query(
                            `UPDATE leagueplayer
                            SET Points = Points - ?,
                                Matches = Matches - ?,
                                Victories = Victories - ?,
                                Defeats = Defeats - ?,
                                Draws = Draws - ?
                            WHERE IDLeague = ? AND IDPlayer = ?`,
                            [puntosARestar, partidosJugados, partidosGanados, partidosPerdidos, partidosEmpatados, idLiga, player.IDPlayer]
                        );
                    }
                }

                // 3. BORRAR ASOCIACIONES EN MATCHPLAYER Y EL PARTIDO EN SÍ
                await connection.query("DELETE FROM matchplayer WHERE IDMatch = ?", [idMatch]);
                await connection.query("DELETE FROM matches WHERE IDMatch = ?", [idMatch]);

                // 4. COMPROBACIÓN JORNADAS: ¿Era el último partido de esta jornada?
                let mensajeAdicional = "";

                if(jornadaActual !== null) {
                    const [remainingMatches]: any = await connection.query(
                        "SELECT 1 FROM matches WHERE IDLeague = ? AND DayTrip = ? LIMIT 1",
                        [idLiga, jornadaActual]
                    );


                    if (remainingMatches.length === 0) {
                        // Restamos 1 a las jornadas posteriores para que no queden huecos
                        await connection.query(
                            `UPDATE matches SET DayTrip = DayTrip - 1 WHERE IDLeague = ? AND DayTrip > ?`,
                            [idLiga, jornadaActual]
                        );
                        mensajeAdicional = " y el calendario de jornadas se ha reestructurado.";
                    }
                }

                // Consolidamos todos los cambios en la base de datos
                await connection.commit();

                res.json({
                    message: `Partido eliminado con éxito. Se han recalculado los puntos de la clasificación${mensajeAdicional} 🔄🗑️`
                });

            } catch (err) {
                await connection.rollback();
                throw err;
            } finally {
                connection.release();
            }
        } catch (error: any) {
            console.error("❌ Error crítico al eliminar el partido y recalcular:", error, error.sql);
            res.status(500).json({ message: "Error al procesar el borrado completo: " + error.message });
        }
    };

    public async createMatch(req: Request, res: Response): Promise<any> {
        const { idLeague, locales, visitantes } = req.body;
        const currentUserId = req.headers['x-user-id'];
        console.log(req.body)
        if ( !idLeague ) {
            return res.status(400).json({ message: "Datos incompletos. Se requiere al menos IDLeague y DayTrip." });
        }

        try {
            // Verificar que el usuario es el administrador de la liga
            const [league]: any = await pool.query(
                `SELECT 1 FROM leagues WHERE IDLeague = ? AND IDAdmin = ?
                UNION
                SELECT 1 FROM leagueplayer WHERE IDLeague = ? AND IDPlayer = ?
                LIMIT 1;`,
                [idLeague, currentUserId, idLeague, currentUserId]
            );
            
            console.log("Resultado de la verificación de administrador:", league);
            if (league.length === 0) {
                return res.status(403).json({
                    message: "Acceso denegated: No eres administrador ni jugador de esta liga."
                });
            }
            const [anonimo] : any = await pool.query("SELECT J.* FROM players J WHERE J.NamePlayer = 'Anonimo'");
            // 2. Filtrar IDs reales de jugadores para verificar su membresía de forma segura (Evita Inyección SQL)
            const realPlayerIds = [...locales, ...visitantes].filter(id => id !== 'bot');

            if (realPlayerIds.length > 0) {
                // Generamos tantos signos de interrogación como jugadores reales haya: (?, ?, ?)
                const placeholders = realPlayerIds.map(() => '?').join(',');
                const [rows]: any = await pool.query(
                    `SELECT DISTINCT IDPlayer FROM leagueplayer WHERE IDLeague = ? AND IDPlayer IN (${placeholders})`,
                    [idLeague, ...realPlayerIds]
                );

                // Usamos un Set para comparar elementos únicos por si acaso se repitiese un ID por error
                const uniqueRealPlayersCount = new Set(realPlayerIds).size;
                if (rows.length !== uniqueRealPlayersCount) {
                    return res.status(400).json({ message: "Error: Uno o más jugadores reales seleccionados no pertenecen a esta liga." });
                }
            }

            const connection = await pool.getConnection();
            await connection.beginTransaction();
            try {
                // A. Insertar el partido base (Por defecto 'Pendiente')
                const [matchResult]: any = await connection.query(
                    "INSERT INTO matches (IDLeague, DayTrip, Estado) VALUES (?, NULL, 'Pendiente')",
                    [idLeague]
                );
                const idMatch = matchResult.insertId;
                console.log(idMatch);
                let nIdAnonimo = 0;

                // Función auxiliar interna para procesar cada bando
                const processBando = async (playersArray: any[], bandoName: 'Local' | 'Visitante') => {

                    for (const playerVal of playersArray) {
                        let finalPlayerId: number;

                        if (playerVal === 'bot') {
                            finalPlayerId = anonimo[nIdAnonimo].IDPlayer;
                            nIdAnonimo++;
                        } else {
                            finalPlayerId = Number(playerVal);
                        }

                        // Insertar la relación en matchplayer

                        console.log(pool.format(`INSERT IGNORE INTO matchplayer (IDMatch, IDPlayer, Bando) VALUES (?, ?, ?)`, [idMatch, finalPlayerId, bandoName]))
                        await connection.query(
                            "INSERT IGNORE INTO matchplayer (IDMatch, IDPlayer, Bando) VALUES (?, ?, ?)",
                            [idMatch, finalPlayerId, bandoName]
                        );
                    }
                };

                // Ejecutamos el procesado para ambos bandos
                await processBando(locales, 'Local');
                await processBando(visitantes, 'Visitante');

                // Si todo ha ido bien, confirmamos los cambios de la transacción
                await connection.commit();
                return res.status(201).json({ 
                    message: "Partido creado con éxito y asignado a su correspondiente jornada. 🗓️✨",
                    idMatch 
                });

            } catch (transactionError: any) {
                await connection.rollback();
                throw transactionError; // Lo capturará el catch exterior
            } finally {
                connection.release();
            }

        } catch (error: any) {
            console.error("Error al verificar permisos de administrador:", error.message);
            return res.status(500).json({ message: "Error al verificar permisos de administrador: " + error.message });
        }
    }
}

async function asignarPuntosLiga(connection: any, partido: any): Promise<void> {
    const idLeague = partido.IDLeague;
    const winner = Number(partido.Winner); // 1 = Local, 2 = Visitante, 3 = Empate

    // Mantenemos tus puntos fijos por ahora, o mapeados desde partido si los añades a la query
    const pGanar = 3;
    const pEmpatar = 1;
    const pPerder = 0;

    const idsLocales: number[] = partido.LocalesIDs ? partido.LocalesIDs.split(',').map(Number) : [];
    const idsVisitantes: number[] = partido.VisitantesIDs ? partido.VisitantesIDs.split(',').map(Number) : [];

    let ptsL = pPerder, vicL = 0, derL = 0, empL = 0;
    let ptsV = pPerder, vicV = 0, derV = 0, empV = 0;

    if (winner === 1) {
        ptsL = pGanar; vicL = 1;
        ptsV = pPerder; derV = 1;
    } else if (winner === 2) {
        ptsL = pPerder; derL = 1;
        ptsV = pGanar; vicV = 1;
    } else if (winner === 3) {
        ptsL = pEmpatar; empL = 1;
        ptsV = pEmpatar; empV = 1;
    }

    // A) Actualizar jugadores LOCALES
    if (idsLocales.length > 0) {
        await connection.query(
            `UPDATE leagueplayer
            SET Points = Points + ?, Matches = Matches + 1, Victories = Victories + ?, Defeats = Defeats + ?, Draws = Draws + ?
            WHERE IDLeague = ? AND IDPlayer IN (?)`,
            [ptsL, vicL, derL, empL, idLeague, idsLocales]
        );
    }

    // B) Actualizar jugadores VISITANTES
    if (idsVisitantes.length > 0) {
        await connection.query(
            `UPDATE leagueplayer
            SET Points = Points + ?, Matches = Matches + 1, Victories = Victories + ?, Defeats = Defeats + ?, Draws = Draws + ?
            WHERE IDLeague = ? AND IDPlayer IN (?)`,
            [ptsV, vicV, derV, empV, idLeague, idsVisitantes]
        );
    }
}

export const matchController = new MatchController();