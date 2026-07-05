const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// Configuración de la conexión a PostgreSQL usando las variables de tu archivo .env
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

const JWT_SECRET = process.env.JWT_SECRET || 'secreto_por_defecto_restobar';
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '2h';

// Comprobar la conexión inicial con la Base de Datos
pool.connect((err, client, release) => {
    if (err) {
        return console.error('Error adquiriendo cliente de base de datos:', err.stack);
    }
    console.log('Conexión exitosa a la base de datos PostgreSQL');
    release();
});

// 1. REGISTRO DE USUARIO CON ENCRIPTACIÓN DE CONTRASEÑA
app.post('/api/registro', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'El email y la contraseña son requeridos.' });
    }

    try {
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const result = await pool.query(
            'INSERT INTO usuarios (email, password_hash) VALUES ($1, $2) RETURNING id, email, creado_en',
            [email, passwordHash]
        );

        res.status(201).json({
            mensaje: 'Usuario registrado con éxito',
            usuario: result.rows[0]
        });
    } catch (error) {
        console.error('Error durante el registro:', error);
        if (error.code === '23505') {
            return res.status(409).json({ error: 'El correo electrónico ya se encuentra registrado.' });
        }
        res.status(500).json({ error: 'Error interno en el servidor al intentar registrar el usuario.' });
    }
});

// 2. INICIO DE SESIÓN CON GENERACIÓN Y FIRMA DE JWT
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Por favor, ingrese email y contraseña.' });
    }

    try {
        const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        const usuario = result.rows[0];

        if (!usuario) {
            return res.status(401).json({ error: 'Credenciales de acceso incorrectas.' });
        }

        const contraseniaCorrecta = await bcrypt.compare(password, usuario.password_hash);
        if (!contraseniaCorrecta) {
            return res.status(401).json({ error: 'Credenciales de acceso incorrectas.' });
        }

        const token = jwt.sign(
            { id: usuario.id, email: usuario.email },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRATION }
        );

        res.status(200).json({
            mensaje: 'Autenticación exitosa',
            token: token,
            usuario: { email: usuario.email }
        });
    } catch (error) {
        console.error('Error durante el login:', error);
        res.status(500).json({ error: 'Ocurrió un error en el servidor al intentar iniciar sesión.' });
    }
});

// MIDDLEWARE: VALIDACIÓN DEL BEARER TOKEN JWT
const verificarBearerToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ error: 'Acceso denegado. No se encontró cabecera de autorización.' });
    }

    const partes = authHeader.split(' ');
    if (partes.length !== 2 || partes[0] !== 'Bearer') {
        return res.status(401).json({ error: 'Formato de autorización inválido. Use "Bearer <token>".' });
    }

    const token = partes[1];

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'El token de acceso no es válido o ya ha expirado.' });
        }
        req.usuario = decoded;
        next();
    });
};

// 3. REGISTRO DE COMPRA CON PATRÓN TRANSACTIONAL OUTBOX
app.post('/api/comprar', verificarBearerToken, async (req, res) => {
    const { total, items } = req.body;
    const usuarioId = req.usuario.id;

    if (!total || total <= 0) {
        return res.status(400).json({ error: 'Monto total inválido para procesar la transacción.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // INICIO DE TRANSACCIÓN ATÓMICA

        const queryPedido = 'INSERT INTO pedidos (usuario_id, total) VALUES ($1, $2) RETURNING id';
        const resPedido = await client.query(queryPedido, [usuarioId, total]);
        const pedidoId = resPedido.rows[0].id;

        const payloadEvento = {
            pedidoId: pedidoId,
            usuarioId: usuarioId,
            email: req.usuario.email,
            montoTotal: total,
            productos: items || [],
            fecha: new Date().toISOString()
        };

        const queryOutbox = "INSERT INTO outbox (tipo_evento, payload, estado) VALUES ($1, $2, 'PENDIENTE')";
        await client.query(queryOutbox, ['PEDIDO_REGISTRADO', JSON.stringify(payloadEvento)]);

        await client.query('COMMIT'); // CONFIRMACIÓN DE LA TRANSACCIÓN (Ambos o ninguno)

        res.status(201).json({
            mensaje: 'Transacción realizada con éxito. Su pedido y notificación han sido registrados.',
            pedidoId: pedidoId
        });
    } catch (error) {
        await client.query('ROLLBACK'); // REVERSIÓN TOTAL ante cualquier falla
        console.error('Error en transacción de compra:', error);
        res.status(500).json({ error: 'Fallo al procesar la compra.' });
    } finally {
        client.release();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor de API ejecutándose correctamente en http://localhost:${PORT}`);
});