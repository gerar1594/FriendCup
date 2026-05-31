import {Request,Response} from 'express';

import pool from "../database";
import AuthService from '../services/AuthService';


class SportController{


    public async format(req: Request, res: Response): Promise<any>{


        const { idsport } = req.params;

        const [sport] = await pool.query("SELECT ResultadoFormat FROM sports WHERE IDSport = ?",[idsport]);
        res.json(sport);
       

    }

    public async get(req: Request, res: Response): Promise<any>{
        const [sports] = await pool.query("SELECT * FROM sports WHERE activo = 1");
        res.json(sports);
    }
}

export const sportController = new SportController();