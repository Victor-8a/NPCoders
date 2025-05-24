// middleware/auth_middleware.ts
import { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class AuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    try {
      await ctx.auth.authenticate()
      return await next()
    } catch {
      return ctx.response.unauthorized({ error: 'Acceso no autorizado' })
    }
  }
}