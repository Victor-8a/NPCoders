import jwt from 'jsonwebtoken'
import env from '#start/env'

export default class JwtService {
  public static generateToken(userId: string, email: string) {
    return jwt.sign(
      { userId, email },
      env.get('APP_KEY'),
      { expiresIn: '24h' }
    )
  }

  public static verifyToken(token: string) {
    try {
      return jwt.verify(token, env.get('APP_KEY'))
    } catch (error) {
      return null
    }
  }
}