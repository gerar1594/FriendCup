import { Request, Response } from 'express';
import pool from '../database';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

class AuthController {

    // 1. REGISTRO DE USUARIOS
    public async register(req: Request, res: Response): Promise<void> {
        const { Nombre, Email, Password } = req.body;

        try {
            // 1. Comprobación previa de duplicados
            const [existing]: any = await pool.query(
                "SELECT NamePlayer, Email FROM players WHERE NamePlayer = ? OR Email = ?",
                [Nombre, Email]
            );

            if (existing.length > 0) {
                const isNameTaken = existing.some((p: any) => p.NamePlayer === Nombre);
                const isEmailTaken = existing.some((p: any) => p.Email === Email);

                if (isNameTaken && isEmailTaken) {
                    res.status(400).json({ message: "El nombre de jugador y el email ya están en uso." });
                } else if (isNameTaken) {
                    res.status(400).json({ message: "El nombre de jugador ya está en uso." });
                } else {
                    res.status(400).json({ message: "El correo electrónico ya está registrado." });
                }
            }

            // 2. Encriptar la contraseña
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(Password, salt);

            // 3. Iniciar transacción
            const connection = await pool.getConnection();
            await connection.beginTransaction();

            try {
                const [userResult]: any = await connection.query(
                    "INSERT INTO players (NamePlayer, Email, Password) VALUES (?, ?, ?)",
                    [Nombre, Email, hashedPassword]
                );

                await connection.commit();
                res.status(201).json({ 
                    message: "Jugador creado con éxito.",
                    idPlayer: userResult.insertId 
                });
            } catch (err) {
                await connection.rollback();
                throw err; 
            } finally {
                connection.release();
            }

        } catch (error: any) {
            console.error("Error en el registro:", error);
            res.status(500).json({ message: "Hubo un problema en el servidor al procesar el registro." });
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

    public async loginUserPass(req: Request, res: Response): Promise<any> {
        const { Email, Password } = req.body;

        // 1. Validar que vengan ambos valores en la petición
        if (!Email || !Password) {
            return res.status(400).json({ message: "El identificador (email/usuario) y la contraseña son requeridos." });
        }

        try {
            // 2. Buscar en la BBDD pasando 'Email' tanto para comparar con la columna Email como con NamePlayer
            const [rows]: any = await pool.query(
                `SELECT *
                FROM players p
                WHERE Email = ? OR NamePlayer = ?;`,
                [Email, Email] // ✨ Pasamos el mismo valor a ambas incógnitas de la query
            );

            // 3. Si el array viene vacío, significa que ese texto no corresponde a ningún email ni a ningún usuario
            if (rows.length === 0) {
                return res.status(401).json({ message: "El usuario o correo electrónico introducido no existe." });
            }

            const user = rows[0];

            // 4. Comprobar si la contraseña coincide con el Hash de la BBDD
            const validPassword = await bcrypt.compare(Password, user.Password);
            if (!validPassword) {
                return res.status(401).json({ message: "Contraseña incorrecta." });
            }

            // 5. Generar Token JWT (Válido por 24 horas)
            const token = jwt.sign(
                { idPlayer: user.IDPlayer, nombre: user.NamePlayer },
                'FIRMA_SECRETA_FRIENDCUP_2026',
                { expiresIn: '24h' }
            );

            // 6. Devolver token y datos limpios al cliente
            return res.json({
                token,
                user: {
                    idPlayer: user.IDPlayer,
                    nombre: user.NamePlayer,
                    email: user.Email
                }
            });

        } catch (error: any) {
            return res.status(500).json({ message: error.message }); 
        }
    }
}

export const authController = new AuthController();