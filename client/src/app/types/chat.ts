interface ChatMessage {
    id?: string;
    matchId: string;
    userId: string;
    userName: string;
    text: string;               // Si es texto: el mensaje. Si es propuesta: un texto descriptivo (ej: "Propuesta de fecha")
    type: 'text' | 'proposal'; // 👈 Diferencia el tipo de mensaje
    proposalDate?: Date;       // 👈 Solo si type === 'proposal'
    votes?: string[];          // 👈 Array de userIds que han votado "Sí" a esta fecha
    timestamp: Date;
}