import {Router} from 'express';
import { leaguesController } from '../controllers/leaguesControllers';


class LeaguesRoutes{
    public router: Router = Router();

    constructor(){
        this.config();
    }

    config(): void{
        this.router.get('/:idleague', leaguesController.get);
        this.router.post('/create', leaguesController.create);
        this.router.post('/join', leaguesController.join);
        this.router.post('/leave', leaguesController.leave);
        this.router.get('/:idleague/players', leaguesController.listPlayers);
        this.router.get('/user/:idplayer', leaguesController.getLeaguesByUser);
        this.router.get('/all/:idplayer', leaguesController.getLeaguesByUserOrAdmin);
        this.router.get('/check-access/:idLeague/:idPlayer', leaguesController.checkLeagueAccess);
        this.router.post('/state/:idleague', leaguesController.updateState);
        this.router.post('/config/:idleague', leaguesController.updateConfiguration);
        this.router.post('/:idleague/reset', leaguesController.resetLeague);
        this.router.post('/update-name-player-league', leaguesController.updateNamePlayerLeague);

    }


}

const leaguesRoutes = new LeaguesRoutes();
export default leaguesRoutes.router;