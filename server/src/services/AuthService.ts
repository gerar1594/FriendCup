import jwt from 'jsonwebtoken';

class AuthService {
    private secretKey = 'plani-key-app-angular-test-prueba';

    public generateToken(payload: any): string {
        return jwt.sign(payload, this.secretKey, { expiresIn: '7d' });
    }

    public verifyToken(token: string = ""): any {
        try {
            return jwt.verify(token, this.secretKey); 
        } catch (error) {
            throw new Error('Token is not valid');
        }
    }
}

export default new AuthService();
