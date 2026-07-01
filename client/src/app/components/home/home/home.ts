import { Component, signal, inject, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { MatchCard } from "../../match/match-card/match-card";
import { JsonPipe, NgClass } from '@angular/common';
import { PlayerService } from '../../../services/players/player-service.service';
// Importa tus servicios y componentes (AppMatchCard, etc.)

@Component({
    selector: 'app-home',
    templateUrl: './home.html',
    styleUrls: ['./home.scss'],
    standalone: true,
    imports: [MatchCard, NgClass, JsonPipe] // Asegúrate de importar JsonPipe si lo usas en el template
})
export class Home implements OnInit {
    private router = inject(Router);
    // Aquí inyectarías tu servicio de Ligas/Partidos
    private playerService = inject(PlayerService); // Asegúrate de tener un servicio para manejar la lógica de jugadores
    isLoading = signal<boolean>(true);
    
    // Datos tipados según tu backend
    myLeagues = signal<any[]>([]); 
    upcomingMatches = signal<any[]>([]);

    @ViewChild('slider') slider!: ElementRef<HTMLDivElement>;

    // Variables para controlar el estado del arrastre
    private isDragging = false;
    private startX = 0;
    private scrollLeft = 0;

    ngOnInit() {
        this.loadHomeData();
    }

    loadHomeData() {
        this.isLoading.set(true);
        
        // Aquí harías las llamadas a tu API/Servicio
        // 1. Obtener ligas donde el usuario participa (añadiendo su posición y puntos al objeto)
        // 2. Obtener partidos pendientes del usuario (asegurándote de que el objeto devuelva 'LeagueName' y 'Jornada')

        this.playerService.getHomeData().subscribe({
            next: (data) => {
                // Manejar la respuesta de la API para obtener ligas y partidos
                // Por ejemplo:
                /*this.myLeagues.set(data.leagues || []);
                this.upcomingMatches.set(data.matches || []);*/
                console.log(data)
                this.myLeagues.set(data.misLigas || []);
                this.upcomingMatches.set(data.proximosPartidos || []);
            },
            error: (err) => {
                console.error('Error al cargar datos del home:', err);
            },
            complete: () => {
                this.isLoading.set(false);
            }
        });
        // Simulación de carga:
        setTimeout(() => {
        this.isLoading.set(false);
        }, 500);
    }

    goToLeague(idLeague: string | number) {
        this.router.navigate(['/league', idLeague]);
    }


    onMouseDown(event: MouseEvent) {
        this.isDragging = true;
        // Guardamos la posición inicial del ratón
        this.startX = event.pageX - this.slider.nativeElement.offsetLeft;
        // Guardamos la posición actual del scroll
        this.scrollLeft = this.slider.nativeElement.scrollLeft;
        
        // Opcional: Quitar el snap mientras se arrastra para que sea más fluido
        this.slider.nativeElement.style.scrollSnapType = 'none';
    }

    onMouseLeave() {
        this.stopDragging();
    }

    onMouseUp() {
        this.stopDragging();
    }

    onMouseMove(event: MouseEvent) {
        if (!this.isDragging) return;
        event.preventDefault(); // Previene comportamientos por defecto del navegador

        // Calculamos cuánto se ha movido el ratón
        const x = event.pageX - this.slider.nativeElement.offsetLeft;
        const walk = (x - this.startX) * 1.5; // El * 1.5 es la velocidad (multiplicador)

        // Movemos el scroll
        this.slider.nativeElement.scrollLeft = this.scrollLeft - walk;
    }

    private stopDragging() {
        if (!this.isDragging) return;
        this.isDragging = false;
        
        // Volvemos a activar el snap para que la tarjeta se alinee sola al soltar
        this.slider.nativeElement.style.scrollSnapType = 'x mandatory';
    }
    
}