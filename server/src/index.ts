import 'dotenv/config';
import express,{ Application} from 'express';
import morgan from 'morgan';
import cors from 'cors';
import playersRoutes from './routes/playersRoutes';
import leaguesRoutes from './routes/leaguesRoutes';
import authRoutes from './routes/authRoutes';

import './tasks/cronTasks';
import matchRoutes from './routes/matchRoutes';
import sportRoutes from './routes/sportRoutes';
import betsRoutes from './routes/betsRoutes';

import * as http from 'http'; // 👈 Importamos todo el módulo http
import { Server as SocketServer } from 'socket.io'; // 👈 Le damos el alias 'SocketServer'
import messageRoutes from './routes/messageRoutes';

interface ChatMessage {
    id?: string;
    IDMatch: string;
    userId: string;
    text: string;               // Si es texto: el mensaje. Si es propuesta: un texto descriptivo
    type: 'text' | 'proposal'; // Diferencia el tipo de mensaje
    proposalDate?: Date;       // Solo si type === 'proposal'
    votes?: string[];          // Array de userIds que han votado "Sí"
    timestamp?: Date;
}

class Server{

    public app: Application;
    public server: http.Server;   // 👈 Servidor HTTP de Node
    public io: SocketServer;  
        // 👈 Usamos el alias aquí para evitar confusiones
    constructor(){
        this.app = express();
        this.config();
        this.routes();

        this.server = http.createServer(this.app);

        this.io = new SocketServer(this.server, {
            cors: {
                origin: '*', 
                methods: ['GET', 'POST']
            }
        });

        this.listenSockets();
    }


    config(): void{
        this.app.set("port", process.env.PORT || 3000);
        this.app.use(morgan('dev'));
        this.app.use(cors({
            origin: '*', // Permitir cualquier origen (ideal para asegurarte de que móvil/tablet entran)
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // 👈 Añade OPTIONS aquí
            allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id']
        }));
        this.app.use(express.json());
        this.app.use(express.urlencoded({extended:false}));
    }

    routes(): void{
        this.app.use('/api/match', matchRoutes);
        this.app.use('/api/auth', authRoutes);
        this.app.use('/api/player', playersRoutes);
        this.app.use('/api/league', leaguesRoutes);
        this.app.use('/api/sport', sportRoutes);
        this.app.use('/api/bets', betsRoutes);
        this.app.use('/api/message', messageRoutes);


    }

    start(): void{
        /*this.app.listen(this.app.get('port'), () => {
            console.log("Server on port ", this.app.get('port'));
        });*/

        this.server.listen(this.app.get('port'), () => {
            console.log("Server on port ", this.app.get('port'));
        });
    }

    // Dentro de tu archivo server.ts -> método listenSockets()

    private listenSockets(): void {
        this.io.on('connection', (socket) => {
            
            // 1. Unirse a la sala del partido
            socket.on('join_match_room', (matchId: string) => {
                console.log(`🏠 Jugador unido a la sala del partido: match_${matchId}`);
                socket.join(`match_${matchId}`);
            });

            // 2. Enviar un mensaje (Sea Texto o Propuesta de Fecha)
            socket.on('send_message', async (messageData: ChatMessage) => {
                const newMessage: ChatMessage = {
                    ...messageData,
                    votes: messageData.type === 'proposal' ? [] : undefined, // Inicializa votos vacíos si es propuesta
                    timestamp: new Date()
                };

                // [Opcional] Aquí guardarías 'newMessage' en tu Base de Datos (MySQL, Postgres, etc.)
                // const savedMessage = await this.matchService.saveMessage(newMessage);

                // Emitir el mensaje a todos los del partido
                console.log("Retransmitiendo mensaje a la sala:", `match_${newMessage.IDMatch}`);
                    
                // Emitimos una ÚNICA VEZ a la sala privada
                this.io.to(`match_${newMessage.IDMatch}`).emit('receive_message', newMessage);            });

            // 3. Votar en una fecha propuesta existente
            socket.on('vote_date', async (data: { IDMatch: string, messageId: string, userId: string }) => {
                
                // Lógica simulada de actualización (Deberías buscar el mensaje en BD y hacer el toggle del userId en el array 'votes')
                // const updatedMessage = await this.matchService.toggleVote(data.messageId, data.userId);

                /*console.log("Retransmitiendo voto a la sala:", `match_${data.IDMatch}`);

                this.io.to(`match_${data.IDMatch}`).emit('date_voted', {
                    IDMessage: data.messageId,
                    userId: data.userId
                    // votes: updatedMessage.votes // Pasarías los votos reales de la BD
                });*/

                const matchRoomId = data.IDMatch;
    
                console.log('🗳️ Datos recibidos en Node:', data); 
                // Comprueba en tu terminal negra de Node si aquí se imprime con datos o vacío

                // Retransmitimos exactamente lo que nos llegó
                this.io.to(`match_${matchRoomId}`).emit('date_voted', data);
            });

        });
    }

}

const server = new Server();
server.start();