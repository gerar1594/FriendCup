import {Request,Response} from 'express';

import pool from "../database";
import AuthService from '../services/AuthService';


class MessageController{

    // 1. Obtener el histórico de mensajes y propuestas de un partido
    public async getMatchMessages(req: Request, res: Response): Promise<void> {
        const { id } = req.params; // idMatch
        try {
            // 👈 Hacemos el JOIN para traernos el nombre real y actualizado del jugador
            const query = `
                SELECT m.*, lp.NamePlayerLeague AS userNameLeague, p.NamePlayer AS userName
                FROM match_messages m
                LEFT JOIN matches mat ON m.IDMatch = mat.IDMatch  -- 👈 1. Unimos con la tabla de partidos para saber la liga
                LEFT JOIN players p ON m.IDPlayer = p.IDPlayer
                LEFT JOIN leagueplayer lp ON m.IDPlayer = lp.IDPlayer AND mat.IDLeague = lp.IDLeague -- 👈 2. Filtramos por jugador Y por la misma liga
                WHERE m.IDMatch = ? 
                ORDER BY m.timestamp ASC
            `;
            const [messages] : any[] = await pool.query(query, [id]);
            
            // Buscamos los votos de las propuestas (Igual que antes)
            if(messages.length > 0){
                for (let msg of messages) {
                    if (msg.type === 'proposal') {
                        const [votes]: any[] = await pool.query('SELECT IDPlayer FROM message_votes WHERE IDMessage = ?', [msg.IDMessage]);
                        msg.votes = votes;
                    } else {
                        msg.votes = [];
                    }
                }
                
                res.json(messages);
            }
            else{
                res.json(null)
            }
        } catch (error) {
            console.log(error)
            res.status(500).json({ text: 'Error al obtener los mensajes' });
        }
    }

    public async saveMatchMessage(req: Request, res: Response): Promise<void> {
        const { id } = req.params; // idMatch
        const {  text, type, proposalDate } = req.body; 
        // 💡 Tip: Puedes recibir el 'userName' temporalmente en el body SOLO para construir la respuesta 
        // inmediata del JSON que va al socket, pero NO lo insertas en la base de datos.

        const currentUserId = req.headers['x-user-id'];

        console.log(req.body)
        try {
            const newMessage = {
                IDMatch: id,
                IDPlayer: currentUserId,
                text,
                type,
                proposalDate: type === 'proposal' ? proposalDate : null
            };
            
            // Insertamos en BD (Sin la columna userName)
            const result : any = await pool.query('INSERT INTO match_messages SET ?', [newMessage]);
            
            // Devolvemos el objeto a Angular incluyendo el 'userName' en caliente 
            // para que el Socket lo propague y se pinte al instante en las pantallas
            res.json({
                IDMessage: result.insertId,
                ...newMessage,
                votes: [],
                timestamp: new Date()
            });
        } catch (error) {
            console.log(error)
            res.status(500).json({ text: 'Error al guardar el mensaje' });
        }
    }

    // 3. Guardar o quitar un voto (Toggle)
    public async toggleMessageVote(req: Request, res: Response): Promise<void> {
        const { messageId } = req.params;
        const currentUserId = req.headers['x-user-id'];

        try {
            // Comprobamos si el voto ya existe
            const [existingVote]:any[] = await pool.query('SELECT * FROM message_votes WHERE idMessage = ? AND idPlayer = ?', [messageId, currentUserId]);
            if (existingVote.length > 0) {
                // Si existe, lo quitamos (Desmarcar disponible)
                await pool.query('DELETE FROM message_votes WHERE idMessage = ? AND idPlayer = ?', [messageId, currentUserId]);
            } else {
                // Si no existe, lo añadimos (Marcar disponible)
                await pool.query('INSERT INTO message_votes (idMessage, idPlayer) VALUES (?, ?)', [messageId, currentUserId]);
            }

            // Recuperamos la lista actualizada de votos de este mensaje para responderla
            const [updatedVotes] = await pool.query('SELECT IDPlayer FROM message_votes WHERE idMessage = ?', [messageId]);
            const votesArray = updatedVotes;

            res.json({ success: true, votes: votesArray });
        } catch (error) {
            res.status(500).json({ text: 'Error al procesar el voto' });
        }
    }
    
}

export const messageController = new MessageController();