

import { Router } from 'express';
import { messageController } from '../controllers/messageController';

class MessageRoutes {
    public router: Router = Router();

    constructor() {
        this.config();
    }

    config(): void {

        this.router.get('/:id', messageController.getMatchMessages);
        this.router.post('/:id', messageController.saveMatchMessage);
        this.router.post('/vote/:messageId', messageController.toggleMessageVote);

    }
}

const messageRoutes = new MessageRoutes();
export default messageRoutes.router;