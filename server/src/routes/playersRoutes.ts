import {Router} from 'express';
import {  playersController } from '../controllers/playersController';


class PlayersRoutes{
    public router: Router = Router();

    constructor(){
        this.config();
    }

    config(): void{
        this.router.get('/anonimo', playersController.getAnonimo);
        this.router.get('/home', playersController.getHomeData);

        this.router.get('/:idplayer', playersController.get);


    }


}

const playersRoutes = new PlayersRoutes();
export default playersRoutes.router;