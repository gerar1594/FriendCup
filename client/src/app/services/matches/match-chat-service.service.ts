import { Injectable, inject } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class MatchChatService {
    private socket: Socket;
    // Tu ruta base para el chat (ej: http://localhost:3000/api/message)
    private API_URL = environment.apiUri + '/message'; 

    // Inyectamos el HttpClient de Angular de forma moderna
    private http = inject(HttpClient);

    constructor() {
        // Inicializamos el cliente de socket apuntando a la raíz del servidor
        let socketUrl = environment.apiUri; // Esta sí existe
        try {
            // 'http://localhost:3000/api' se convierte automáticamente en 'http://localhost:3000'
            socketUrl = new URL(environment.apiUri).origin; 
        } catch (e) {
            console.error('No se pudo parsear apiUri, usando valor por defecto.');
        }
        this.socket = io(socketUrl, {
            transports: ['websocket'] // Evita problemas de CORS/Polling intermitentes
        });
        this.socket.on('connect', () => {
            console.log('🟢 CONEXIÓN ESTABLECIDA: Sockets conectados con ID:', this.socket.id);
        });

        this.socket.on('connect_error', (error) => {
            console.error('🔴 ERROR DE CONEXIÓN EN SOCKETS:', error);
        });
    }

    /**
     * Unirse a la sala privada del partido en WebSockets
     */
    joinRoom(matchId: string): void {
        this.socket.emit('join_match_room', matchId);
    }

    /**
     * Obtener el histórico de mensajes guardados en la BBDD vía HTTP GET
     */
    getChatHistory(matchId: string): Observable<any[]> {
        return this.http.get<any[]>(`${this.API_URL}/${matchId}`);
    }

    getProposalDates(matchId: string): Observable<any[]> {
        return this.http.get<any[]>(`${this.API_URL}/dates/${matchId}`);
    }

    /**
     * Enviar mensaje común de texto:
     * Guarda por HTTP POST y luego emite por WebSockets
     */
    sendTextMessage(matchId: string, text: string, userName : string): void {
        const payload = { text, type: 'text' };
        console.log('🚀 1. Intentando guardar mensaje vía HTTP POST...', payload);
        this.http.post(`${this.API_URL}/${matchId}`, payload).subscribe({
            next: (savedMsg: any) => {
                console.log('✅ 2. BBDD respondió OK. Enviando por Socket:', savedMsg);
                // Al grabarse en BBDD, propagamos el objeto completo (con su ID e info) a la sala
                let savedMsgFormated = {
                    ...savedMsg,
                    userName
                }
                this.socket.emit('send_message', savedMsgFormated);
            },
            error: (err) => console.error('Error al guardar mensaje de texto:', err)
        });
    }

    /**
     * Enviar una propuesta de fecha:
     * Guarda por HTTP POST y luego emite por WebSockets
     */
    sendDateProposal(matchId: string, date: Date): void {
        const payload = { 
            text: 'Ha propuesto una fecha para el partido', 
            type: 'proposal',
            proposalDate: date
        };

        this.http.post(`${this.API_URL}/${matchId}`, payload).subscribe({
            next: (savedProposal: any) => {
                // Propagamos la propuesta con su ID definitivo generado por la BBDD
                this.socket.emit('send_message', savedProposal);
            },
            error: (err) => console.error('Error al guardar propuesta de fecha:', err)
        });
    }

    /**
     * Emitir un voto / Disponibilidad:
     * Hace el toggle por HTTP POST y actualiza los votos en vivo por WebSockets
     */
    voteDate(matchId: string, messageId: string): void {
        const payload = { };

        this.http.post(`${this.API_URL}/vote/${messageId}`, payload).subscribe({
            next: (res: any) => {
                // 'res.votes' es el array actualizado de IDs que devuelve el backend ['id1', 'id2']
                
                this.socket.emit('vote_date', { 
                    IDMatch: matchId, 
                    IDMessage: messageId, 
                    votes: res.votes 
                });
            },
            error: (err) => console.error('Error al procesar el voto:', err)
        });
    }

    // --- ESCUCHADORES EN TIEMPO REAL (SOCKET) ---

    /**
     * Escuchar todo lo que entra en vivo al chat (Mensajes o propuestas)
     */
    getMessages(): Observable<any> {
        return new Observable(observer => {
            this.socket.on('receive_message', (msg) => observer.next(msg));
        });
    }

    /**
     * Escuchar cuando la lista de votos de una propuesta cambia en vivo
     */
    getVoteUpdates(): Observable<any> {
        return new Observable(observer => {
            this.socket.on('date_voted', (voteData) => observer.next(voteData));
        });
    }
    cleanMessageTurnOff(): void {
        this.socket.off('receive_message');
        this.socket.off('date_voted');
        console.log('🛑 Escuchadores de Socket.io apagados con éxito.');
    }
}