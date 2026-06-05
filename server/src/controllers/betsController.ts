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
                "SELECT 1 FROM leagueplayer WHERE IDLeague = ? AND IDPlayer = ?",
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

}

export const betsController = new BetsController();