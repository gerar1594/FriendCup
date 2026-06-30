import { Component, Input, OnInit, OnDestroy, signal, inject, computed, HostListener } from '@angular/core';
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
    proposalDate = signal<any[]>([]);
    textInput = '';
    public dateInput = signal<string>('');
    showDatePicker = signal<boolean>(false);

    // Almacena el IDMessage del tooltip que está abierto en este momento
    public activeConflictTooltip = signal<string | null>(null);

    private authService = inject(AuthService);
    private matchesService = inject(MatchesService);
    private notificationService = inject(NotificationService);
    
    currentUserId = this.authService.currentUser().idPlayer; 
    currentUserName: string = "";

    myScheduledMatches = signal<any[]>([]);
    private subs: Subscription = new Subscription();
    showProposalsPanel = false;
    public loadingMessages = signal<boolean>(true);

    allProposals = computed(() => {
        return this.proposalDate();
    });

    // Evalúa si el input actual es una fecha repetida o conflictiva
    protected isProposalDisabled = computed(() => {
        const currentInput = this.dateInput();
        if (!currentInput) return true;
        return this.isDateAlreadyProposed(currentInput) || this.checkDateConflict(currentInput) === 'danger';
    });

    constructor(private chatService: MatchChatService) {
        this.loadUserSchedule();
    }

    ngOnInit() {
        this.chatService.joinRoom(this.match.IDMatch);

        this.chatService.getChatHistory(this.match.IDMatch).subscribe({
            next: (history) => {
                this.messages.set(history);
                let auxProposalDate = [];
                if(history){
                    for(let message of this.messages()){
                        if(message.IDPlayer == this.currentUserId){
                            this.currentUserName = message.userName;
                        }
                        if(message.type == 'proposal'){
                            auxProposalDate.push(message);
                        }
                    }
                }
                this.proposalDate.set(auxProposalDate);
                this.scrollToBottom();

                this.loadingMessages.set(false);
            },
            error: (err) => {
                console.error('Error al cargar histórico:', err);
                // 🚀 NUEVO: Apagamos el spinner también en caso de error para no congelar la UI
                this.loadingMessages.set(false);
            }
        });

        this.chatService.getMessages().subscribe((msg) => {
            console.log('📥 ¡Acaba de entrar un mensaje por el Socket en tiempo real!', msg);
            this.messages.update(list => [...list, msg]);

            if (msg && msg.type === 'proposal') {
                this.proposalDate.update(proposals => [...proposals, msg]);
            }

            this.scrollToBottom();
        });

        this.subs.add(
            this.chatService.getVoteUpdates().subscribe((voteData) => {
                if (!voteData || !voteData.IDMessage) return;
                this.messages.update(list => list.map(msg => {
                    if (msg.IDMessage === voteData.IDMessage) {
                        return { ...msg, votes: [...voteData.votes] };
                    }
                    return msg;
                }));
            })
        );
    }

    loadUserSchedule() {
        this.matchesService.getMatchesByUser(this.currentUserId).subscribe({
            next: (matches) => {
                const scheduled = matches.userMatches.filter((m: { Fecha: any; }) => m.Fecha);
                this.myScheduledMatches.set(scheduled);
            }
        });
    }

    public toggleConflictTooltip(messageId: string, event: Event): void {
        event.stopPropagation();
        if (this.activeConflictTooltip() === messageId) {
            this.activeConflictTooltip.set(null);
        } else {
            this.activeConflictTooltip.set(messageId);
        }
    }

    // EXTRAE LOS CARACTERES EXACTOS IGNORANDO EL MOTOR Y ZONA HORARIA DEL DISPOSITIVO
    private getLocalDateKey(dateInput: any): string {
        if (!dateInput) return '';

        if (typeof dateInput === 'string') {
            let cleanStr = dateInput.replace('T', ' ').split('Z')[0].split('+')[0].trim();
            
            const spaceParts = cleanStr.split(' ');
            const datePart = spaceParts[0]; 
            const timePart = spaceParts[1] || '00:00'; 

            const dateComponents = datePart.split(/[-/]/); 
            const timeComponents = timePart.split(':');    

            if (dateComponents.length >= 3 && timeComponents.length >= 2) {
                const year = dateComponents[0];
                const month = dateComponents[1].padStart(2, '0');
                const day = dateComponents[2].padStart(2, '0');
                const hour = timeComponents[0].padStart(2, '0');
                const minute = timeComponents[1].padStart(2, '0');

                return `${year}-${month}-${day} ${hour}:${minute}`;
            }
            return cleanStr;
        } else if (dateInput instanceof Date) {
            const pad = (n: number) => String(n).padStart(2, '0');
            return `${dateInput.getFullYear()}-${pad(dateInput.getMonth() + 1)}-${pad(dateInput.getDate())} ${pad(dateInput.getHours())}:${pad(dateInput.getMinutes())}`;
        }
        return '';
    }

    private isDateAlreadyProposed(newDateStr: string): boolean {
        if (!newDateStr || this.proposalDate().length === 0) return false;

        const targetKey = this.getLocalDateKey(newDateStr);
        if (!targetKey) return false;

        return this.proposalDate().some(proposal => {
            const existingKey = this.getLocalDateKey(proposal.proposalDate);
            return targetKey === existingKey;
        });
    }

    checkDateConflict(proposalDateStr: string): 'none' | 'warning' | 'danger' {
        if (!proposalDateStr || this.myScheduledMatches().length === 0) return 'none';

        const targetKey = this.getLocalDateKey(proposalDateStr);
        if (!targetKey) return 'none';

        const [targetDay, targetTime] = targetKey.split(' '); 
        const otherMatches = this.myScheduledMatches().filter(m => m.IDMatch !== this.match.IDMatch);

        let conflict: 'none' | 'warning' | 'danger' = 'none';

        for (const bookedMatch of otherMatches) {
            const bookedKey = this.getLocalDateKey(bookedMatch.Fecha);
            if (!bookedKey) continue;

            const [bookedDay, bookedTime] = bookedKey.split(' ');

            if (targetKey === bookedKey) {
                return 'danger'; 
            }

            if (targetDay === bookedDay) {
                conflict = 'warning';
            }
        }

        return conflict;
    }

    @HostListener('document:click')
    public closeTooltipOutside(): void {
        if (this.activeConflictTooltip()) {
            this.activeConflictTooltip.set(null);
        }
    }

    // MÉTODO REPARADO: Busca coincidencias utilizando claves planas sin usar comparativas horarias nativas erróneas
    public getConflictingMatchDetails(proposalDateStr: string): any {
        if (!proposalDateStr || this.myScheduledMatches().length === 0) return null;
        
        const targetKey = this.getLocalDateKey(proposalDateStr);
        const [targetDay] = targetKey.split(' ');
        const otherMatches = this.myScheduledMatches().filter(m => m.IDMatch !== this.match.IDMatch);

        // Intentar buscar coincidencia exacta primero (Hora crítica)
        let matched = otherMatches.find(m => this.getLocalDateKey(m.Fecha) === targetKey);
        
        // Si no, buscar coincidencia en el mismo día (Advertencia)
        if (!matched) {
            matched = otherMatches.find(m => {
                const bookedKey = this.getLocalDateKey(m.Fecha);
                return bookedKey.split(' ')[0] === targetDay;
            });
        }

        return matched ? {
            DayTrip: matched.DayTrip,
            NameLeague: matched.NameLeague || matched.Competicion || 'Partido de Liga',
            fecha: matched.Fecha // Mantenemos el string plano original guardado
        } : null;
    }

    sendText() {
        if (!this.textInput.trim()) return;
        this.chatService.sendTextMessage(this.match.IDMatch, this.textInput, this.currentUserName);
        this.textInput = '';
    }

    proposeDate() {
        const currentInput = this.dateInput(); // Recibe "2026-06-24T21:30" de tu DatePicker
        if (!currentInput) return;

        if (this.isDateAlreadyProposed(currentInput)) {
            this.notificationService.show(`La fecha ya ha sido propuesta previamente en el chat.`, 'error');
            return;
        }

        const conflictStatus = this.checkDateConflict(currentInput);
        if (conflictStatus === 'danger') {
            const conflictingMatch = this.getConflictingMatchDetails(currentInput);
            const leagueName = conflictingMatch?.NameLeague || 'otra competición';
            this.notificationService.show(`Conflicto en tu agenda con un partido de ${leagueName}.`, 'error');
            return;
        }

        // 1. Limpiamos el formato que viene del DatePicker
        let cleanStr = currentInput.replace('T', ' ').split('Z')[0].split('+')[0].trim();
        const spaceParts = cleanStr.split(' ');
        const datePart = spaceParts[0];
        const timePart = spaceParts[1] || '00:00';

        const dateComponents = datePart.split(/[-/]/);
        const timeComponents = timePart.split(':');

        if (dateComponents.length >= 3 && timeComponents.length >= 2) {
            const year = dateComponents[0];
            const month = dateComponents[1].padStart(2, '0');
            const day = dateComponents[2].padStart(2, '0');
            const hour = timeComponents[0].padStart(2, '0');
            const minute = timeComponents[1].padStart(2, '0');

            // 🚀 EL TRUCO: Guardamos la fecha en formato ISO plano terminando en 'Z' (UTC absoluto)
            // Esto le dice a cualquier dispositivo del mundo (PC, iPhone, Android): "No toques las horas"
            const finalIsoString = `${year}-${month}-${day}T${hour}:${minute}:00.000Z`;
            
            console.log('✈️ Enviando al servidor con zona horaria blindada:', finalIsoString);
            this.chatService.sendDateProposal(this.match.IDMatch, finalIsoString as any);
        }
        
        this.dateInput.set('');
    }

    toggleVote(messageId: string) {
        this.chatService.voteDate(this.match.IDMatch, messageId);
    }

    onSetDate(date: Date) {
        this.matchesService.setFecha(this.match.IDMatch, { fecha: date.toString() }).subscribe({
            next: (res) => {
                this.notificationService.show(res.message, 'success');
                this.match.Fecha = date;
            },
            error: (err) => this.notificationService.show(err.message, 'error')
        });
    }

    hasVoted(votes: any[]): boolean {
        if (!votes || !Array.isArray(votes)) return false;
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
        this.dateInput.set(fechaHora); 
    }

    ngOnDestroy() {
        console.log('🗑️ Destruyendo componente Chat. Limpiando sockets...');
        this.chatService.cleanMessageTurnOff();
    }
}