import {Request,Response} from 'express';

import pool from "../database";
import AuthService from '../services/AuthService';


class PlayersController{


    public async list(req : Request, res : Response): Promise<void>{
        //let token: string = req.headers["token"] as string;
        const { idplayer } = req.params;
        //let idPlayer: string = req.headers["id"] as string;

        const players = await pool.query("SELECT J.* FROM players J, leagues L WHERE J.IDLeague = L.IDLeague AND J.IDPlayer = ?",[idplayer]);
        if(players.length > 0){
            res.json(players[0]);
        } else {
            res.status(404).json({message: "El jugador no existe"});
        }
    }

    public async get(req: Request, res: Response): Promise<any>{


        const { idplayer } = req.params;

        const players = await pool.query("SELECT J.*, L.* FROM players J, leagues L WHERE J.IDLeague = L.IDLeague AND J.IDPlayer = ?",[idplayer]);
        if(players.length > 0){
            res.json(players[0]);
        } else {
            res.status(404).json({message: "El jugador no existe"});
        }

    }

    public async create(req : Request, res : Response): Promise<void> {
        await pool.query("INSERT INTO players set ?", [req.body]);
        res.json({message: "Create a player"});
    }

    public async delete(req: Request, res: Response): Promise<void>{
        const { id } = req.params;
        await pool.query("DELETE FROM players WHERE ID = ?", [id]);
        res.json({message:"El jugador fue eliminado"});
    }

    public async update (req: Request, res: Response): Promise<void>{
        const { id } = req.params;
        await pool.query("UPDATE players set ? WHERE id = ?",[req.body, id]);
        res.json({message:" El jugador fue actualizado"});


    }
}


export const playersController = new PlayersController();
