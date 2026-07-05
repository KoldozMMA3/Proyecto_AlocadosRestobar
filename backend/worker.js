const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function procesarEventosOutbox() {
    console.log('[Worker] Escaneando la tabla Outbox por eventos pendientes...');

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const queryOutbox = `
            SELECT id, tipo_evento, payload 
            FROM outbox 
            WHERE estado = 'PENDIENTE' 
            ORDER BY creado_en ASC 
            LIMIT 5 
            FOR UPDATE SKIP LOCKED
        `;
        const res = await client.query(queryOutbox);
        const eventos = res.rows;

        if (eventos.length === 0) {
            await client.query('COMMIT');
            return;
        }

        for (const evento of eventos) {
            console.log(`\n[Worker] >>> Procesando Evento ID: ${evento.id} | Tipo: ${evento.tipo_evento}`);
            
            const payload = evento.payload;

            // Simulación del envío de la notificación (Email/SMS)
            console.log(`[Worker] [NOTIFICACIÓN] Enviando correo electrónico a: ${payload.email}`);
            console.log(`[Worker] [NOTIFICACIÓN] Detalles: Su pedido #${payload.pedidoId} por un total de S/ ${payload.montoTotal} ha sido confirmado.`);
            
            await new Promise(resolve => setTimeout(resolve, 1500));

            const queryUpdate = "UPDATE outbox SET estado = 'PROCESADO' WHERE id = $1";
            await client.query(queryUpdate, [evento.id]);

            console.log(`[Worker] <<< Evento ID: ${evento.id} completado y actualizado a PROCESADO.`);
        }

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[Worker] Error procesando los eventos del Outbox:', error);
    } finally {
        client.release();
    }
}

const INTERVALO_MS = 8000;
console.log(`[Worker] Iniciado correctamente. Sondeo configurado cada ${INTERVALO_MS / 1000} segundos.`);

setInterval(procesarEventosOutbox, INTERVALO_MS);
procesarEventosOutbox();