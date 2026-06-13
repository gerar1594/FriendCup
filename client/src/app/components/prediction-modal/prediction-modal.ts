import { Component, model, input, output, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-prediction-modal',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './prediction-modal.html'
})
export class PredictionModalComponent {
    // Sincroniza la apertura del modal con el padre
    isOpen = model<boolean>(false);
    
    // Recibe los datos de los jugadores ordenados actualmente
    classification = input<any[]>([]);
    betOrder = input<any>(null)

    idLeague = input<number>(0);
    
    // Emite el array final ordenado hacia el padre tras guardar
    onPredictionSaved = output<any[]>();

    // Lista interna mutable sobre la que se hace el Drag & Drop
    editableList = signal<any[]>([]);
    
    // Rastrea qué índice se está arrastrando actualmente
    draggedIndex: number | null = null;

    constructor() {
        // Sincroniza la lista editable interna cada vez que la clasificación del padre cambie o se cargue
        effect(() => {

            const currentClassification = this.classification();
            const currentBetOrder : any[] = this.betOrder().PredictOrder;

            if (currentClassification.length > 0) {
                // 🔮 Si el usuario ya tiene una apuesta guardada en la base de datos
                if (currentBetOrder.length > 0) {

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
                    this.editableList.set([...orderedPlayers, ...missingPlayers]);

                } else {
                    // 🆕 Si es la primera vez (no hay apuesta previa), usamos el orden actual de la clasificación
                    this.editableList.set([...currentClassification]);
                }
            }
        });
    }

    // --- MÉTODOS NATIVOS DRAG AND DROP ---

    onDragStart(index: number) {
        this.draggedIndex = index;
    }

    onDragOver(event: DragEvent, index: number) {
        event.preventDefault(); // Permite soltar el elemento
        
        if (this.draggedIndex === null || this.draggedIndex === index) return;

        // Reordenación al vuelo de la señal interna para dar feedback visual fluido
        const list = [...this.editableList()];
        const draggedItem = list.splice(this.draggedIndex, 1)[0];
        list.splice(index, 0, draggedItem);
        
        this.draggedIndex = index; // Actualiza el índice del elemento arrastrado
        this.editableList.set(list);
    }

    onDragEnd() {
        this.draggedIndex = null;
    }

    // --- GUARDADO ---

    guardarPorra() {
        console.log('📌 Guardando orden de la porra final para la liga:', this.idLeague());

        // Emitimos la lista con el orden deseado al padre
        this.onPredictionSaved.emit(this.editableList());
        this.isOpen.set(false);
    }
}