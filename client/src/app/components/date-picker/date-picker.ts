import { Component, computed, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-date-picker',
    standalone: true,
    imports: [FormsModule],
    templateUrl: './date-picker.html'
})
export class DatePicker {
    isOpen = model<boolean>(false);
    onDateConfirmed = output<string>();

    // Fecha de navegación del calendario (Año y Mes actual)
    currentDate = signal<Date>(new Date());
    
      // Día y hora seleccionados por el usuario
    selectedDay = signal<number | null>(null);
    selectedTime = signal<string>('19:30'); // Hora por defecto para partidos

    diasSemana = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    meses = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    ngOnInit() {
        // Si ya se abre hoy, preseleccionar el número del día actual
        this.selectedDay.set(new Date().getDate());
    }

    // Nombre del mes y año actual en base a la navegación
    mesAnioTexto = computed(() => {
        const date = this.currentDate();
        return `${this.meses[date.getMonth()]} ${date.getFullYear()}`;
    });

    // Genera la matriz de días para renderizar en la cuadrícula
    get diasMes(): (number | null)[] {
        const date = this.currentDate();
        const year = date.getFullYear();
        const month = date.getMonth();

        // Primer día del mes
        const primerDiaIndex = new Date(year, month, 1).getDay();
        // Ajustar index para que la semana empiece en Lunes (0=L, 1=M... 6=D)
        const dephasedIndex = primerDiaIndex === 0 ? 6 : primerDiaIndex - 1;

        // Total de días del mes actual
        const totalDias = new Date(year, month + 1, 0).getDate();

        const matriz: (number | null)[] = [];

        // Rellenar días vacíos del inicio de la semana
        for (let i = 0; i < dephasedIndex; i++) {
        matriz.push(null);
        }

        // Rellenar los días reales del mes
        for (let dia = 1; dia <= totalDias; dia++) {
        matriz.push(dia);
        }

        return matriz;
    }

    cambiarMes(direccion: number) {
        // 🛡️ Si por algún motivo currentDate() pudiera ser null, usamos 'new Date()' como salvavidas
        const fechaBase = this.currentDate() ?? new Date(); 
        const nuevaFecha = new Date(fechaBase);
        
        nuevaFecha.setMonth(nuevaFecha.getMonth() + direccion);
        this.currentDate.set(nuevaFecha);
        
        this.selectedDay.set(null); // Esto está bien porque selectedDay acepta num/null
    }

    seleccionarDia(dia: number | null) {
        if (dia) this.selectedDay.set(dia);
    }

    confirmar() {
        const dia = this.selectedDay();
        if (!dia) return;

        const año = this.currentDate().getFullYear();
        // Los meses en JS van de 0 a 11, sumamos 1 y rellenamos con ceros a la izquierda
        const mes = String(this.currentDate().getMonth() + 1).padStart(2, '0');
        const diaStr = String(dia).padStart(2, '0');
        
        // Combinamos la fecha del calendario con el input de la hora
        const fechaHoraFinal = `${año}-${mes}-${diaStr}T${this.selectedTime()}`;
        
        this.onDateConfirmed.emit(fechaHoraFinal);
        this.isOpen.set(false);
    }
}

