import {Router} from 'express';
import {  playersController } from '../controllers/playersController';
import { matchController } from '../controllers/matchController';


class MatchesRoutes{
    public router: Router = Router();

    constructor(){
        this.config();
    }

    config(): void{
        //this.router.post('match/generate-balanced', matchController.generateBalancedPairsMatches);

        // Obtener partidos de un usuario concreto
        this.router.get('/user/:idPlayer', matchController.getMatchesByUser);
        this.router.get('/league/extra/:idleague', matchController.getMatchesExtraByLeague);
        this.router.get('/league/:idleague', matchController.getMatchesByLeague);


        // Guardar/modificar marcador JSON de un partido
        this.router.put('/:idMatch/result', matchController.updateMatchResult);
        this.router.put('/:idMatch/validate', matchController.validateMatchResult);
        this.router.put('/:idMatch/admin', matchController.adminForceUpdateAndValidate);
        this.router.delete('/', matchController.deleteMatch);
        this.router.post('/create', matchController.createMatch);


        this.router.post('/test', matchController.generateBalancedPairsMatches); // Nueva ruta para obtener partidos por liga
    }


}

const matchesRoutes = new MatchesRoutes();
export default matchesRoutes.router;