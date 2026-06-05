import { Router } from 'express';
import { betsController } from '../controllers/betsController';

class BetsRoutes {
    public router: Router = Router();

    constructor() {
        this.config();
    }

    config(): void {
        this.router.post('/save-match', betsController.saveBet);
        this.router.post('/save-league', betsController.saveLeagueBet);

    }
}

const betsRoutes = new BetsRoutes();
export default betsRoutes.router;