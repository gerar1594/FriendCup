import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { NotificationService } from '../../services/notification/notification.service';

@Component({
    selector: 'app-toast',
    imports: [CommonModule],
    templateUrl: './toast.html',
    styleUrl: './toast.scss',
})
export class Toast {
    public notifService = inject(NotificationService);
}
