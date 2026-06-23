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
            const currentBetOrder : any[] = this.betOrder() ? this.betOrder().PredictOrder : [];

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


    onTouchStart(index: number): void {
        // Al tocar la pantalla, reutilizamos tu lógica existente de DragStart
        this.onDragStart(index); 
    }

    onTouchMove(event: TouchEvent, currentIndex: number): void {
        // Evitamos que el navegador haga scroll vertical
        if (event.cancelable) {
            event.preventDefault();
        }

        // Obtenemos las coordenadas exactas de dónde está el dedo actualmente
        const touch = event.touches[0];
        
        // Buscamos cuál es el elemento del DOM que está justo debajo del dedo
        const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
        if (!targetElement) return;

        // Encontramos la tarjeta contenedora que tiene el bucle de Angular más cercana
        const itemContainer = targetElement.closest('[draggable="true"]');
        if (!itemContainer) return;

        // Buscamos todas las tarjetas para saber el índice de la tarjeta sobre la que estamos pasando
        const allItems = Array.from(itemContainer.parentNode?.children || []);
        const targetIndex = allItems.indexOf(itemContainer);

        // Si el dedo se ha movido a una posición válida y distinta, reorganizamos la lista
        if (targetIndex !== -1 && targetIndex !== currentIndex) {
            const list = [...this.editableList()];
            const draggedIdx = this.draggedIndex; // Tu variable actual que guarda el index original

            if (draggedIdx !== null && draggedIdx !== undefined) {
            // Extraemos el jugador arrastrado y lo insertamos en el nuevo hueco
            const [removed] = list.splice(draggedIdx, 1);
            list.splice(targetIndex, 0, removed);
            
            // Actualizamos tu lista (Signal) y refrescamos el índice que se está moviendo
            this.editableList.set(list);
            this.draggedIndex = targetIndex; 
            }
        }
    }

    onTouchEnd(): void {
        // Al levantar el dedo del móvil, ejecutamos la misma limpieza de DragEnd
        this.onDragEnd();
    }

    // --- GUARDADO ---

    guardarPorra() {
        console.log('📌 Guardando orden de la porra final para la liga:', this.idLeague());

        // Emitimos la lista con el orden deseado al padre
        this.onPredictionSaved.emit(this.editableList());
        this.isOpen.set(false);
    }
}