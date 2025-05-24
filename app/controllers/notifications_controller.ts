import { HttpContext } from '@adonisjs/core/http'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default class NotificationsController {
  public async index({ auth, response }: HttpContext) {
    const notifications = await prisma.notificaciones.findMany({
      where: { userId: auth.user.id },
      include: { from: { select: { username: true, profilePic: true } } }
    })

    return response.json(notifications)
  }

    public async delete({ params, response }: HttpContext) {
        const notification = await prisma.notificaciones.delete({
            where: { id: params.id }
        })

        return response.json(notification)
    } 
    
    public async store({ request, response }: HttpContext) {
        const { userId, fromId } = request.only(['userId', 'fromId', 'type'])
    
        const notification = await prisma.notificaciones.create({
          data: {
            userId,
            fromId,
            
          }
        })
    
        return response.json(notification)
      }


}