import { Router } from 'express';
import { sportController } from '../controllers/sportController';

class SportRoutes {
    public router: Router = Router();

    constructor() {
        this.config();
    }

    config(): void {
        this.router.get('/format/:idsport', sportController.format);
        this.router.get('/get', sportController.get);

    }
}

const sportRoutes = new SportRoutes();
export default sportRoutes.router;