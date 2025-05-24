import { HttpContext } from '@adonisjs/core/http'
import { MiddlewareFn, ParsedNamedMiddleware } from '@adonisjs/http-server/types'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default class PrivacidadMiddleware {
  static handle: MiddlewareFn | ParsedNamedMiddleware
  public async handle(ctx: HttpContext, next: () => Promise<void>) {
    const user = await prisma.usuario.findUnique({
      where: { id: ctx.params.userId }
    })

    if (!user) return ctx.response.notFound({ message: 'Usuario no encontrado' })

    if (user.privacidad === 'PRIVADO' && user.id !== ctx.auth.user?.id) {
      return ctx.response.forbidden({ message: 'Perfil privado' })
    }

    if (user.privacidad === 'SOLO_AMIGOS') {
      const isFriend = await prisma.usuario.findFirst({
        where: {
          id: user.id,
          followersIds: { has: ctx.auth.user?.id }
        }
      })
      if (!isFriend) return ctx.response.forbidden({ message: 'Solo amigos' })
    }

    await next()
  }
}