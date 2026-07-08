import { CommonModule } from '@angular/common';
import { Component, effect, input, model, signal } from '@angular/core';

@Component({
  selector: 'app-prediction-modal-view',
  imports: [CommonModule],
  templateUrl: './prediction-modal-view.html',
  styleUrl: './prediction-modal-view.scss',
})
export class PredictionModalView {

    isOpen = model<boolean>(false);


    classification = input<any[]>([]);
    betOrder = input<any>(null);

    betList = signal<any[]>([]);


    constructor() {
        // Sincroniza la lista editable interna cada vez que la clasificación del padre cambie o se cargue
        effect(() => {
            const currentClassification = this.classification();
            const currentBetOrder : any[] = this.betOrder() ? this.betOrder().PredictOrder : [];
            
            if (currentClassification && currentClassification.length > 0) {
                // 🔮 Si el usuario ya tiene una apuesta guardada en la base de datos
                if (currentBetOrder && currentBetOrder.length > 0) {

                    // Mapeamos los IDs de la apuesta transformándolos en los objetos completos del jugador
                    const orderedPlayers = currentBetOrder
                        .map(id => currentClassification.find(player => player.IDPlayer === Number(id)))
                        .filter(player => player !== undefined); // Evita problemas si un jugador fue borrado de la liga

                    // 🛡️ Salvavidas: Si se unieron nuevos jugadores a la liga DESPUÉS de hacer la porra,
                    // los buscamos y los metemos al final para que la porra no quede incompleta.
                    const missingPlayers = currentClassification.filter(
                        player => !currentBetOrder.includes(player.IDPlayer)
                    );
                    // Seteamos la lista final combinando ordenados + nuevos si los hubiera
                    this.betList.set([...orderedPlayers, ...missingPlayers]);

                } else {
                    // 🆕 Si es la primera vez (no hay apuesta previa), usamos el orden actual de la clasificación
                    this.betList.set([...currentClassification]);
                }
            }
        });
    }
}
