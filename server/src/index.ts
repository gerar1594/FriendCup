import 'dotenv/config';
import express,{ Application} from 'express';
import morgan from 'morgan';
import cors from 'cors';
import playersRoutes from './routes/playersRoutes';
import leaguesRoutes from './routes/leaguesRoutes';
import authRoutes from './routes/authRoutes';

import './tasks/cronTasks';
import matchRoutes from './routes/matchRoutes';
import sportRoutes from './routes/sportRoutes';
import betsRoutes from './routes/betsRoutes';


class Server{

    public app: Application;

    constructor(){
        this.app = express();
        this.config();
        this.routes();
    }


    config(): void{
        this.app.set("port", process.env.PORT || 3000);
        this.app.use(morgan('dev'));
        this.app.use(cors({
            origin: '*', // Permitir cualquier origen (ideal para asegurarte de que móvil/tablet entran)
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // 👈 Añade OPTIONS aquí
            allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id']
        }));
        this.app.use(express.json());
        this.app.use(express.urlencoded({extended:false}));
    }

    routes(): void{
        this.app.use('/api/match', matchRoutes);
        this.app.use('/api/auth', authRoutes);
        this.app.use('/api/player', playersRoutes);
        this.app.use('/api/league', leaguesRoutes);
        this.app.use('/api/sport', sportRoutes);
        this.app.use('/api/bets', betsRoutes);


    }

    start(): void{
        this.app.listen(this.app.get('port'), () => {
            console.log("Server on port ", this.app.get('port'));
        });
    }

}

const server = new Server();
server.start();