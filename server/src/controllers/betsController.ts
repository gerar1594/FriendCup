import { Request, Response } from 'express';
import pool from "../database";
import AuthService from '../services/AuthService';

class BetsController {

    /**
     * POST /api/bets
     * Guarda, actualiza o elimina la apuesta de un usuario para un partido específico.
     */
    public async saveBet(req: Request, res: Response): Promise<any> {
        const currentUserId = req.headers['x-user-id'];
        const payload = req.body;
        console.log(payload)
        try {
            // 1. Extraer el ID del usuario desde el token usando tu AuthService

            if (!currentUserId) {
                return res.status(401).json({ message: 'Usuario no autenticado.' });
            }

            const { idMatch, predictedBando } = req.body; // 'Local' | 'Visitante' | 'Empate' | null

            if (!idMatch) {
                return res.status(400).json({ message: 'El ID del partido es obligatorio.' });
            }

            // 2. 🛡️ SEGURIDAD: Validar el estado del partido antes de permitir cambios
            const [match]: any = await pool.query(
                "SELECT Estado FROM matches WHERE IDMatch = ?", 
                [idMatch]
            );

            if (match.length === 0) {
                return res.status(404).json({ message: 'El partido no existe.' });
            }

            // Si ya se ha disputado, se bloquea la porra por completo
            if (match[0].Estado === 'Jugado') {
                return res.status(403).json({ message: 'La porra está cerrada. El partido ya ha sido jugado.' });
            }

            // Si tienes campo de hora/fecha programada, bloqueamos si ya ha pasado el pitido inicial
            if (match[0].DateMatch && new Date() >= new Date(match[0].DateMatch)) {
                return res.status(403).json({ message: 'La porra está cerrada. El partido ya ha comenzado.' });
            }

            // 3. Operación atómica en la BBDD
            if (predictedBando === null) {
                // Si el usuario vuelve a clicar la opción activa, eliminamos la apuesta (desmarcar)
                await pool.query(
                    "DELETE FROM match_bets WHERE IDMatch = ? AND IDPlayer = ?",
                    [idMatch, currentUserId]
                );
                return res.status(200).json({
                    message: 'Apuesta retirada correctamente.',
                    miApuesta: null
                });
            } else {
                // Si pulsa una opción nueva o cambia la anterior (1 -> X), se ejecuta el UPSERT
                console.log(predictedBando)
                await pool.query(
                    `INSERT INTO match_bet (IDMatch, IDPlayer, PredictedBando)
                    VALUES (?, ?, ?)
                    ON DUPLICATE KEY UPDATE PredictedBando = ?`,
                    [idMatch, currentUserId, predictedBando, predictedBando]
                );
                return res.status(200).json({
                    message: 'Apuesta procesada correctamente.',
                    miApuesta: predictedBando
                });
            }

        } catch (error: any) {
            console.error('Error en saveBet del servidor:', error.message);
            return res.status(500).json({
                message: 'Error interno del servidor al procesar la porra: ' + error.message
            });
        }
    }

    /**
     * POST /api/bets/league
     * Guarda o actualiza la apuesta del usuario al ganador final de una liga.
     */
    public async saveLeagueBet(req: Request, res: Response): Promise<any> {
        try {
            // 1. Extraer el ID del usuario autenticado
            const currentUserId = req.headers['x-user-id'];
            if (!currentUserId) {
                return res.status(401).json({ message: 'Usuario no autenticado.' });
            }

            const { idLeague, predictedWinnerId } = req.body; // predictedWinnerId: IDPlayer del candidato a ganar
            console.log(idLeague, predictedWinnerId, req.body)

            if (!idLeague || !predictedWinnerId) {
                return res.status(400).json({ message: 'El ID de la liga y el jugador votado son obligatorios.' });
            }

            // 2. 🛡️ SEGURIDAD: Validar que la liga no esté ya finalizada
            const [league]: any = await pool.query(
                "SELECT Estado FROM leagues WHERE IDLeague = ?", 
                [idLeague]
            );
            
            if (league.length === 0) {
                return res.status(404).json({ message: 'La liga no existe.' });
            }

            // Si tienes un estado para ligas cerradas/finalizadas, lo bloqueamos aquí
            if (league[0].Estado === 'Finalizada' || league[0].Estado === 'Cerrada') {
                return res.status(403).json({ message: 'La porra está cerrada. La liga ya ha finalizado.' });
            }

            // 3. 🛡️ SEGURIDAD: Validar que el candidato realmente pertenezca a esa liga
            const [isParticipant]: any = await pool.query(
                "SELECT 1 FROM leagueplayer WHERE IDLeague = ? AND IDLeaguePlayer = ?",
                [idLeague, predictedWinnerId]
            );

            if (isParticipant.length === 0) {
                return res.status(400).json({ message: 'El jugador elegido no participa en esta liga.' });
            }
            // 4. Guardar o actualizar la apuesta (Gracias al UNIQUE KEY de la tabla)
            await pool.query(
                `INSERT INTO league_bet (IDLeague, IDPlayer, PredictedWinnerID) 
                VALUES (?, ?, ?) 
                ON DUPLICATE KEY UPDATE PredictedWinnerID = ?`,
                [idLeague, currentUserId, predictedWinnerId, predictedWinnerId]
            );

            return res.status(200).json({ 
                message: 'Tu apuesta al ganador final ha sido registrada con éxito.' 
            });

        } catch (error: any) {
            console.error('Error en saveLeagueBet:', error.message);
            return res.status(500).json({ message: 'Error al guardar la apuesta de la liga: ' + error.message });
        }
    }


    public async saveOrderLeagueBet(req: Request, res: Response): Promise<any> {
        // 'prediction' es el array ordenado de objetos o IDs que viene del Drag & Drop
        const { idLeague, prediction } = req.body; 
        const currentUserId = req.headers['x-user-id'];
        if (!currentUserId) {
            return res.status(401).json({ message: 'Usuario no autenticado.' });
        }
        console.log(prediction)

        // 🛡️ Validación básica
        if (!idLeague || !currentUserId || !Array.isArray(prediction) || prediction.length === 0) {
            return res.status(400).json({ 
                message: "Faltan datos obligatorios o el formato de la porra es inválido."
            });
        }

        // Convertimos el array de la predicción en un String separado por comas para 'PredictOrder'
        // Ej: [1, 62, 14] -> "1,62,14"
        const predictOrderString = prediction.map((p: any) => p.IDLeaguePlayer );
        console.log(predictOrderString)
        // El ganador definitivo (🥇) es el primer elemento del array reordenado
        const predictedWinnerId = typeof prediction[0] === 'object' ? prediction[0].IDLeaguePlayer : prediction[0];

        try {
            const connection = await pool.getConnection();
            await connection.beginTransaction();

            try {
                // 1. Comprobamos si la liga sigue "Abierta". No se deberían permitir porras si ya está "En Curso" o "Finalizada"
                const [leagueRows]: any = await connection.query(
                    "SELECT Estado FROM leagues WHERE IDLeague = ?",
                    [idLeague]
                );

                if (leagueRows.length === 0) {
                    await connection.rollback();
                    return res.status(404).json({ message: "La liga especificada no existe." });
                }

                if (leagueRows[0].Estado !== 'Abierta') {
                    await connection.rollback();
                    return res.status(400).json({ 
                        message: "La competición ya ha comenzado o finalizado. El plazo de la porra está cerrado." 
                    });
                }

                // 2. Verificamos si este usuario ya tiene un registro de apuesta previo en esta liga
                const [existingBet]: any = await connection.query(
                    "SELECT IDLeagueBet FROM league_bet WHERE IDLeague = ? AND IDPlayer = ?",
                    [idLeague, currentUserId]
                );

                if (existingBet.length > 0) {
                    // 🔄 Si ya existe, ACTUALIZAMOS su predicción actual
                    await connection.query(
                        `UPDATE league_bet
                        SET  PredictOrder = ?, CreatedAt = NOW() 
                        WHERE IDLeague = ? AND IDPlayer = ?`,
                        [JSON.stringify(predictOrderString), idLeague, currentUserId]
                    );
                } else {
                    // ➕ Si es la primera vez que vota, INSERTAMOS la nueva fila
                    await connection.query(
                        `INSERT INTO league_bet (IDLeague, IDPlayer, PredictOrder, CreatedAt) 
                        VALUES (?, ?, ?, NOW())`,
                        [idLeague, currentUserId, JSON.stringify(predictOrderString)]
                    );
                }

                await connection.commit();

                return res.status(200).json({ 
                    message: "¡Porra guardada con éxito! Suerte con el pronóstico.",
                    orderSaved: predictOrderString
                });

            } catch (err) {
                await connection.rollback();
                throw err;
            } finally {
                connection.release();
            }

        } catch (error: any) {
            console.error("Error al procesar la porra de la liga:", error);
            return res.status(500).json({ 
                message: "Error interno del servidor al registrar tu predicción." 
            });
        }
    }

    public async getOrderLeagueBet(req: Request, res: Response): Promise<any> {
        const { idLeague } = req.params;
        const currentUserId = req.headers['x-user-id'];

        if (!currentUserId) {
            return res.status(401).json({ message: 'Usuario no autenticado.' });
        }

        const [bet] : any = await pool.query(
            `SELECT *
            FROM league_bet
            WHERE IDLeague = ? AND IDPlayer = ?`,
            [idLeague, currentUserId]
        );
        if (bet && bet.length > 0) {
            let betFormated = bet[0];

            // 🛡️ Salvavidas para el JSON.parse: Solo parseamos si viene como TEXTO (string)
            if (betFormated.PredictOrder && typeof betFormated.PredictOrder === 'string') {
                try {
                    betFormated.PredictOrder = JSON.parse(betFormated.PredictOrder);
                } catch (e) {
                    console.error("Error al parsear PredictOrder String:", e);
                    betFormated.PredictOrder = []; // Fallback seguro
                }
            }

            return res.json(betFormated);
        } else {
            // 🕊️ RESPUESTA LIMPIA: No tiene apuesta aún, devolvemos un 200 con la estructura base vacía.
            // Esto evita que Angular salte al bloque 'error' y rompa la reactividad del front.
            return res.status(200).json({
                IDLeague: Number(idLeague),
                IDPlayer: Number(currentUserId),
                PredictedWinnerID: null,
                PredictOrder: [] // Enviamos el array vacío para que el modal sepa que no hay orden previo
            });
        }
    }
}

export const betsController = new BetsController();