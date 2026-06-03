import cron from 'node-cron';
import pool from '../database';
import { matchController } from '../controllers/matchController';
import keys from '../keys';

cron.schedule(keys.newMatchesCron, async () => {
    console.log('⏰ [CRON] Iniciando verificación y generación de bloques de jornadas...');
    
    try {
        // 1. Buscamos todas las ligas que estén 'En Curso'
        const [activeLeagues]: any = await pool.query(
            "SELECT IDLeague,Configuration FROM leagues WHERE Estado = 'En Curso' "
        );

        for (const league of activeLeagues) {

            let config = league.Configuration;
            console.log(`\n🔍 Procesando Liga ID: ${league.IDLeague} - Configuración actual:`, config);
            if (typeof config === 'string') {
                try {
                    config = JSON.parse(config);
                } catch (e) {
                    continue; // JSON corrupto, saltamos a la siguiente liga
                }
            }

            // 🎯 EL FILTRO DIRECTO: Si NO es semanal, saltamos a la siguiente iteración
            if (config?.jornada?.tipo !== 'semanal') {
                continue; 
            }

            console.log(`\n==================================================`);
            console.log(`🏆 Procesando Liga ID: ${league.IDLeague}`);
            console.log(`==================================================`);
            const nJornadas = config.jornada.value || keys.nJornadasDefault;
            try {
                // 🚀 USAMOS AWAIT LIMPIO: Esperamos secuencialmente a que termine la liga actual
                await generarBloqueDeJornadas(league.IDLeague, nJornadas, pool);
                console.log(`✅ Bloque de ${nJornadas} jornadas procesado para liga ID: ${league.IDLeague}.`);
            } catch (err: any) {
                // Si falla una liga, se loguea el error pero el bucle FOR continúa con la siguiente liga activa
                console.error(`❌ Error generando jornadas para liga ID: ${league.IDLeague}:`, err.message);
            }
        }
        console.log('\n⏰ [CRON] Finalizado el proceso de generación por bloques.');

    } catch (error) {
        console.error('❌ Error crítico en el planificador semanal:', error);
    }
});

export async function generarBloqueDeJornadas(idLeague: number | string, nJornadas: number = keys.nJornadasDefault, client: any = pool): Promise<void> {
    console.log(`🎲 Iniciando generación de bloques de jornadas para la liga ID: ${idLeague}...`);

    // Ejecutamos un bucle de 3 iteraciones para generar 3 jornadas consecutivas

    for (let i = 0; i < nJornadas; i++) {

        // 1. Averiguamos cuál es la última jornada creada en tiempo real
        const [lastDayTrip]: any = await client.query(
            "SELECT MAX(DayTrip) as maxDay FROM matches WHERE IDLeague = ?",
            [idLeague]
        );

        // Calculamos la siguiente jornada secuencial
        const nextDayTrip = lastDayTrip[0].maxDay ? lastDayTrip[0].maxDay + 1 : 1;

        // 2. VERIFICACIÓN DE SEGURIDAD: Comprobamos si ya existe esta jornada
        const [existingMatches]: any = await client.query(
            "SELECT COUNT(*) as count FROM matches WHERE IDLeague = ? AND DayTrip = ?",
            [idLeague, nextDayTrip]
        );
        if (existingMatches[0].count === 0) {

            console.log(` └─> [Iteración ${i + 1}/${nJornadas}] -> Generando Jornada ${nextDayTrip}...`);
            // Simulamos los objetos req y res de Express para el controlador transaccional
            const mockReq: any = {
                body: { idLeague, dayTrip: nextDayTrip }
            };

            await new Promise<void>(async (resolve, reject) => {
                const mockRes: any = {
                    status: (code: number) => ({
                        json: (msg: any) => {
                            if (code >= 400) {
                                reject(new Error(msg.message));
                            } else {
                                console.log(`     ✅ Algoritmo completado (Jornada ${nextDayTrip}):`, msg.message);
                                resolve();
                            }
                        }
                    })
                };

                try {
                    // Invocamos tu algoritmo transaccional original con un await riguroso
                    await matchController.generateBalancedPairsMatches(mockReq, mockRes);
                } catch (controllerError) {
                    reject(controllerError);
                }
            });

        } else {
            console.log(` └─> [Iteración ${i + 1}/3] -> La jornada ${nextDayTrip} ya existe, saltando...`);
        }
    }
}