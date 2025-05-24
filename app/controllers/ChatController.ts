import { HttpContext } from '@adonisjs/core/http'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default class ChatsController {
  public async index({ auth, response }: HttpContext) {
    const chats = await prisma.chats.findMany({
      where: { participantIds: { has: auth.user.id } },
      include: {
        mensajes: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    })

    return response.json(chats)
  }

  public async storeMessage({ params, request, auth, response }: HttpContext) {
    const { content } = request.only(['content'])

    const message = await prisma.mensajes.create({
      data: {
        content,
        chatId: params.chatId,
        senderId: auth.user.id
      }
    })

    // Socket.io emitiría aquí
    return response.created(message)
  }
}