import { CommonModule } from '@angular/common';
import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatchesService } from '../../../services/matches/matches-service.service';
import { SportsService } from '../../../services/sports/sports-service.service';
import { Parser } from 'expr-eval';
import { AuthService } from '../../../services/auth/auth.service';
import { NotificationService } from '../../../services/notification/notification.service';

@Component({
    selector: 'app-modify-match-dialog',
    imports: [CommonModule, FormsModule],  templateUrl: './modify-match-dialog.html',
    styleUrl: './modify-match-dialog.scss',
})
export class ModifyMatchDialog implements OnInit {

    private matchesService = inject(MatchesService);
    private notificationService = inject(NotificationService);
    

    // Recibimos el partido desde el componente padre
    match = input.required<any>();
    private authService = inject(AuthService);
    adminMode = input<boolean>(false);
    

    // Eventos para avisar al padre que cerramos o guardamos
    onClose = output<void>();
    onSaved = output<void>();

    // Clonamos los periodos en una Signal local para el formulario
    formPeriodos = signal<any[]>([]);

    private parser = new Parser();

    // Al inicializar, preparamos los datos
    constructor() {
        // Usamos un timeout pequeño para asegurar que el input() esté disponible

        setTimeout(() => {

            const marcador = this.match().Resultado;

            if (marcador && marcador.periodos) {
                // Deep clone para editar sin afectar la lista de fondo
                this.formPeriodos.set(JSON.parse(JSON.stringify(marcador.periodos)));
            }
        }, 0);
    }
    ngOnInit(): void {
    }

    private variablesEntrada = computed(() => {
        const vars: any = {};
            this.formPeriodos().forEach((p: any, index: number) => {
            const num = index + 1;
            vars[`p${num}_l`] = Number(p.local || 0);
            vars[`p${num}_v`] = Number(p.visitante || 0);
        });
        return vars;
    });
    // 🚀 Añade este método dentro de tu clase ModifyMatchDialog:
    protected notificarCambio() {
        this.formPeriodos.update(periodos => [...periodos]);
    }

    // 🏆 2. Calcular el total Local dinámicamente usando la fórmula de tu JSON
    protected totalLocalCalculado = computed(() => {
        try {
            const formulaText = this.match().ResultadoFormat.formulaLocal; // Lee tu JSON
            const expr = this.parser.parse(formulaText);
            return Math.round(expr.evaluate(this.variablesEntrada()));
        } catch (e) {
        return 0;
        }
    });

    // 🏆 3. Calcular el total Visitante dinámicamente usando la fórmula de tu JSON
    protected totalVisitanteCalculado = computed(() => {
        try {
            const formulaText = this.match().ResultadoFormat.formulaVisitante; // Lee tu JSON
            const expr = this.parser.parse(formulaText);
            return Math.round(expr.evaluate(this.variablesEntrada()));
        } catch (e) {
            return 0;
        }
    });

    save() {
        const idMatch = this.match().IDMatch;
        if(this.authService.currentUser()) {
            const payload = { periodos: this.formPeriodos(), idPlayer: this.authService.currentUser().idPlayer }; // Enviamos solo los periodos, el backend recalculará los totales

            if(this.adminMode()) {
                this.matchesService.validateMatchAdmin(idMatch, payload).subscribe({
                    next: (res) => {
                        this.notificationService.show(res.message, 'success');
                        this.onSaved.emit();
                        this.onClose.emit();
                    },
                    error: (err) => this.notificationService.show(err.message, 'error')
                });
            }else{
                this.matchesService.updateResult(idMatch, payload).subscribe({
                    next: (res) => {
                        this.notificationService.show(res.message, 'success');
                        this.onSaved.emit();
                        this.close();
                    },
                    error: (err) => this.notificationService.show(err.message, 'error')
                });
            }
        }
    }

    close() {
        this.onClose.emit();
    }



}
