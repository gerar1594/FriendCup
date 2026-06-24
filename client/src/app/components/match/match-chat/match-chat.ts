import { Component, Input, OnInit, OnDestroy, signal, inject, computed } from '@angular/core';
import { Subscription } from 'rxjs';
import { MatchChatService } from '../../../services/matches/match-chat-service.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth/auth.service';
import { MatchesService } from '../../../services/matches/matches-service.service';
import { NotificationService } from '../../../services/notification/notification.service';
import { DatePicker } from "../../date-picker/date-picker";

@Component({
    selector: 'app-match-chat',
    imports: [CommonModule, FormsModule, DatePicker],
    templateUrl: './match-chat.html'
})
export class MatchChat implements OnInit, OnDestroy {
    @Input() match!: any;
    messages = signal<any[]>([]);
    proposalDate = signal<any[]>([])
    textInput = '';
    dateInput = ''; // Enlazado al input datetime-local
    showDatePicker = signal<boolean>(false);


    private authService = inject(AuthService);
    private matchesService = inject(MatchesService);
    private notificationService = inject(NotificationService);
    

    currentUserId = this.authService.currentUser().idPlayer; 
    currentUserName: string = "";


    myScheduledMatches = signal<any[]>([]);

    private subs: Subscription = new Subscription();

    showProposalsPanel = false;

    // 2. Un computed eficiente para tener siempre la lista de propuestas actualizada
    allProposals = computed(() => {
        return this.proposalDate();
    });

    constructor(private chatService: MatchChatService) {
        this.loadUserSchedule();
    }

    ngOnInit() {
        this.chatService.joinRoom(this.match.IDMatch);

        // 1. Cargar el histórico de la base de datos
        this.chatService.getChatHistory(this.match.IDMatch).subscribe({
            next: (history) => {
                this.messages.set(history);
                console.log(this.messages())
                let auxProposalDate = [];
                let find = false;
                for(let message of this.messages()){
                    if(message.IDPlayer == this.currentUserId){
                        this.currentUserName = message.userName;
                    }
                    if(message.type == 'proposal'){
                        auxProposalDate.push(message);
                        /*for(let vote of message.votes){
                            if(vote.IDPlayer == this.currentUserId){
                                break;
                            }
                        }*/
                    }
                }
                this.proposalDate.set(auxProposalDate)
                this.scrollToBottom();
            },
            error: (err) => console.error('Error al cargar histórico:', err)
        });

        /*this.chatService.getProposalDates(this.match.IDMatch).subscribe({
            next: (history) => {
                // 1. Guardamos el historial en el signal primero
                this.proposalDate.set(history || []);
                
                // 2. ERROR CORREGIDO: Iteramos sobre 'history', NO sobre el signal 'this.proposalDate()'
                if (history && Array.isArray(history)) {
                    for(let message of history){
                        if(message.IDPlayer == this.currentUserId){
                            this.currentUserName = message.userName;
                        }
                        // Si 'votes' viene null de base de datos, lo inicializamos como array vacío para evitar romper el bucle inferior
                        if(!message.votes) message.votes = [];
                        
                        for(let vote of message.votes){
                            if(vote.IDPlayer == this.currentUserId){
                                break;
                            }
                        }
                    }
                }
            },
            error: (err) => console.error('Error al cargar histórico:', err)
        });*/

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

    loadUserSchedule() {
        // Aquí llamas al endpoint o servicio que te traiga todos los partidos organizados de este jugador
        this.matchesService.getMatchesByUser(this.currentUserId).subscribe({
            next: (matches) => {
                // Filtramos para quedarnos solo con los partidos que ya tienen una fecha asignada/confirmada

                const scheduled = matches.userMatches.filter((m: { Fecha: any; }) => m.Fecha);
                this.myScheduledMatches.set(scheduled);
            }
        });
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
        this.chatService.sendDateProposal(this.match.IDMatch, selectedDate)
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
    toggleProposalsPanel() {
        this.showProposalsPanel = !this.showProposalsPanel;
    }

    handleFechaSeleccionada(fechaHora: string) {
        console.log('Fecha recibida del componente hijo:', fechaHora);
        this.dateInput = fechaHora;
        /*this.match.Fecha = fechaHora;

        this.matchesService.setFecha(this.match.IDMatch, {fecha : fechaHora}).subscribe({
            next: (res) => {
                this.notificationService.show(res.message, 'success');
            },
            error: (err) => this.notificationService.show(err.message, 'error')
        });*/
        // Aquí ejecutas tu servicio HTTP para guardar la fecha en tu base de datos Node/MySQL
    }

    checkDateConflict(proposalDateStr: string): 'none' | 'warning' | 'danger' {
        if (!proposalDateStr || this.myScheduledMatches().length === 0) return 'none';

        const proposalDate = new Date(proposalDateStr);
        
        // Ignoramos el propio partido actual para que no se autodetecte conflicto consigo mismo
        const otherMatches = this.myScheduledMatches().filter(m => m.IDMatch !== this.match.IDMatch);

        let conflict: 'none' | 'warning' | 'danger' = 'none';
        for (const bookedMatch of otherMatches) {
            const bookedDate = new Date(bookedMatch.Fecha);

            // 1. Comprobación de hora exacta (mismo año, mes, día, hora y minutos)
            if (proposalDate.getTime() === bookedDate.getTime()) {
                return 'danger'; // Conflicto crítico (misma hora) -> Prioridad máxima, rompe el bucle
            }

            // 2. Comprobación de mismo día (año, mes, día coinciden)
            const sameDay = proposalDate.getFullYear() === bookedDate.getFullYear() &&
                            proposalDate.getMonth() === bookedDate.getMonth() &&
                            proposalDate.getDate() === bookedDate.getDate();

            if (sameDay) {
                conflict = 'warning'; // Mismo día, pero diferente hora -> Sigue buscando por si hay uno a la misma hora
            }
        }

        return conflict;
    }

    ngOnDestroy() {
        console.log('🗑️ Destruyendo componente Chat. Limpiando sockets...');
        // 👈 LA CLAVE: Forzamos al servicio a que apague por completo el evento 'receive_message'
        this.chatService.cleanMessageTurnOff();
    }
}