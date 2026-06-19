import { Component, Input, OnInit, OnDestroy, signal, inject, computed } from '@angular/core';
import { Subscription } from 'rxjs';
import { MatchChatService } from '../../../services/matches/match-chat-service.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth/auth.service';
import { MatchesService } from '../../../services/matches/matches-service.service';
import { NotificationService } from '../../../services/notification/notification.service';

@Component({
    selector: 'app-match-chat',
    imports: [CommonModule, FormsModule],
    templateUrl: './match-chat.html'
})
export class MatchChat implements OnInit, OnDestroy {
    @Input() match!: any;
    messages = signal<any[]>([]);
    textInput = '';
    dateInput = ''; // Enlazado al input datetime-local

    private authService = inject(AuthService);
    private matchesService = inject(MatchesService);
    private notificationService = inject(NotificationService);
    

    currentUserId = this.authService.currentUser().idPlayer; 
    currentUserName: string = "";
    isVoted = computed(() => {
        
    })

    private subs: Subscription = new Subscription();

    constructor(private chatService: MatchChatService) {}

    ngOnInit() {
        this.chatService.joinRoom(this.match.IDMatch);

        // 1. Cargar el histórico de la base de datos
        this.chatService.getChatHistory(this.match.IDMatch).subscribe({
            next: (history) => {
                this.messages.set(history);
                console.log(this.messages())
                for(let message of this.messages()){
                    if(message.IDPlayer == this.currentUserId){
                        this.currentUserName = message.userName;
                    }
                    if(message.type == 'proposal'){
                        for(let vote of message.votes){
                            if(vote.IDPlayer == this.currentUserId){
                                break;
                            }
                        }
                    }
                }
                this.scrollToBottom();
            },
            error: (err) => console.error('Error al cargar histórico:', err)
        });

        // 3. Escuchamos el socket de forma directa
        this.chatService.getMessages().subscribe((msg) => {
            console.log('📥 ¡Acaba de entrar un mensaje por el Socket en tiempo real!', msg);
            this.messages.update(list => [...list, msg]);
            this.scrollToBottom();
        });

        

        // Escuchar votos en tiempo real de otros usuarios
        this.subs.add(
            this.chatService.getVoteUpdates().subscribe((voteData) => {
                console.log('📥 Voto en tiempo real recibido:', voteData);
        
                if (!voteData || !voteData.IDMessage) return;

                this.messages.update(list => list.map(msg => {
                    // Evaluamos la propiedad correspondiente de tu base de datos
                    if (msg.IDMessage === voteData.IDMessage) {
                        // 🚀 FORZAMOS RE-RENDER TOTAL: Creamos una copia nueva del mensaje
                        // Pasando el nuevo array de votos íntegro sin alterar el original
                        return { 
                            ...msg, 
                            votes: [...voteData.votes] 
                        };
                    }
                    return msg;
                }));
            })
        );
    }

    sendText() {
        if (!this.textInput.trim()) return;
        // El servicio se encarga de hacer el POST y mandar el Socket solo si la BBDD responde OK
        this.chatService.sendTextMessage(this.match.IDMatch, this.textInput, this.currentUserName);
        this.textInput = '';
    }

    proposeDate() {
        if (!this.dateInput) return;
        const selectedDate = new Date(this.dateInput);
        this.chatService.sendDateProposal(this.match.IDMatch, selectedDate);
        this.dateInput = ''; // Limpiar campo fecha
    }

    toggleVote(messageId: string) {
        this.chatService.voteDate(this.match.IDMatch, messageId);
    }

    onSetDate(date:Date){
        this.matchesService.setFecha(this.match.IDMatch, {fecha : date.toString()}).subscribe({
            next: (res) => {
                this.notificationService.show(res.message, 'success');
                this.match.Fecha = date;
            },
            error: (err) => this.notificationService.show(err.message, 'error')
        });
    }

    // Sabiendo que msg.votes es un array de objetos: [{ IDPlayer: 1 }, { IDPlayer: 2 }]
    hasVoted(votes: any[]): boolean {
        if (!votes || !Array.isArray(votes)) return false;
        // Comparamos con doble igual para mitigar problemas de tipado string/number
        return votes.some(voto => voto.IDPlayer == this.currentUserId);
    }

    scrollToBottom() {
        setTimeout(() => {
        const box = document.getElementById('chat-box');
        if(box) box.scrollTop = box.scrollHeight;
        }, 50);
    }

    ngOnDestroy() {
        console.log('🗑️ Destruyendo componente Chat. Limpiando sockets...');
        // 👈 LA CLAVE: Forzamos al servicio a que apague por completo el evento 'receive_message'
        this.chatService.cleanMessageTurnOff();
    }
}