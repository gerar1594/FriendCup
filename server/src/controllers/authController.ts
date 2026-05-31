import { Request, Response } from 'express';
import pool from '../database';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

class AuthController {

    // 1. REGISTRO DE USUARIOS
    public async register(req: Request, res: Response): Promise<void> {
        const { Nombre, Email, Password } = req.body;

        try {
            // Encriptar la contraseña (sal de 10 rondas)
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(Password, salt);

            // Iniciar transacción para crear Usuario y su perfil de Jugador a la vez
            const connection = await pool.getConnection();
            await connection.beginTransaction();

            try {
                // Guardar en la tabla usuarios
                const [userResult]: any = await connection.query(
                    "INSERT INTO players (NamePlayer, Email, Password) VALUES (?, ?, ?)",
                    [Nombre, Email, hashedPassword]
                );
                const newUserId = userResult.insertId;


                await connection.commit();
                res.status(201).json({ message: "Jugador creado con éxito." });
            } catch (err) {
                await connection.rollback();
                throw err; // Lanza el error al catch externo
            } finally {
                connection.release();
            }

        } catch (error: any) {
            res.status(500).json({ message: "El email ya existe o hubo un problema en el servidor." });
        }
    }

    // 2. INICIO DE SESIÓN (LOGIN)
    public async login(req: Request, res: Response): Promise<any> {
        const { Email, Password } = req.body;
        if(!Email || !Password) {
            return res.status(400).json({ message: "Email y contraseña son requeridos." });
        }
        try {
            // Buscar el usuario por Email y obtener también su IDPlayer
            const [rows]: any = await pool.query(
                `SELECT *
                FROM players p
                WHERE p.Email = ?`,
                [Email]
            );

            if (rows.length === 0) {
                return res.status(401).json({ message: "El correo electrónico no existe." });
            }

            const user = rows[0];

            // Comprobar si la contraseña coincide con el Hash de la BBDD
            const validPassword = await bcrypt.compare(Password, user.Password);
            if (!validPassword) {
                return res.status(401).json({ message: "Contraseña incorrecta." });
            }

            // Generar Token JWT (Válido por 24 horas)
            const token = jwt.sign(
                { idPlayer: user.IDPlayer, nombre: user.NamePlayer },
                'FIRMA_SECRETA_FRIENDCUP_2026',
                { expiresIn: '24h' }
            );

            // Devolver token y datos limpios al cliente
            res.json({
                token,
                user: {
                    idPlayer: user.IDPlayer,
                    nombre: user.NamePlayer,
                    email: user.Email
                }
            });

        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }
}

export const authController = new AuthController();