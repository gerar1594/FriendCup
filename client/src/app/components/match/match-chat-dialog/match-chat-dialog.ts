import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { MatchChat } from "../match-chat/match-chat";

@Component({
    selector: 'app-match-chat-dialog',
    templateUrl: './match-chat-dialog.html',
    imports: [MatchChat]
})
export class MatchChatDialog implements OnInit {
    @Input() match!: any;
    @Input() currentUserName!: string;

    @Output() onClose = new EventEmitter<void>();

    ngOnInit() {
        // Aquí inicializas tu conexión al socket.io-client usando tu servicio
        // ej: this.chatService.joinRoom(this.matchId);
    }

    close() {
        this.onClose.emit();
    }
}