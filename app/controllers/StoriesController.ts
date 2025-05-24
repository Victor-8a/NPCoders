import { HttpContext } from '@adonisjs/core/http'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import env from '#start/env'
import { DateTime } from 'luxon'

const prisma = new PrismaClient()

export default class StoriesController {
  /**
   * Crear nueva story
   */
  public async store({ request, response }: HttpContext) {
    const token = request.header('Authorization')?.replace('Bearer ', '')
    if (!token) return response.unauthorized({ message: 'Token no proporcionado' })

    try {
      const decoded = jwt.verify(token, env.get('APP_KEY')) as { userId: string }
      const { content, type, backgroundColor, duration = 5 } = request.only([
        'content', 'type', 'backgroundColor', 'duration'
      ])

      // Validación de tipos permitidos
      if (!['IMAGE', 'VIDEO', 'TEXT'].includes(type)) {
        return response.badRequest({ message: 'Tipo de story no válido' })
      }

      const expiresAt = DateTime.now().plus({ hours: 24 }).toJSDate()

      const story = await prisma.story.create({
        data: {
          content,
          type,
          backgroundColor: type === 'TEXT' ? backgroundColor : null,
          duration,
          expiresAt,
          userId: decoded.userId
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              profilePic: true
            }
          }
        }
      });

      return response.created(story)
    } catch (error) {
      return response.internalServerError({
        message: 'Error al crear la story',
        error: error.message
      })
    } finally {
      await prisma.$disconnect()
    }
  }

  /**
   * Obtener stories activas (no expiradas)
   */
  public async index({ request, response }: HttpContext) {
    const token = request.header('Authorization')?.replace('Bearer ', '')
    if (!token) return response.unauthorized({ message: 'Token no proporcionado' })

    try {
      const decoded = jwt.verify(token, env.get('APP_KEY')) as { userId: string }
      const now = new Date()

      const stories = await prisma.story.findMany({
          where: {
              user: {
                  followersIds: {
                      has: decoded.userId
                  }
              },
              expiresAt: { gt: now }
          },
          include: {
              user: {
                  select: {
                      id: true,
                      username: true,
                      profilePic: true
                  }
              },
              view: {
                  where: {
                      userId: decoded.userId
                  },
                  take: 1
              }
          },
          orderBy: {
              createdAt: 'desc'
          }
      }) as unknown as Array<{
        id: string
        content: string
        type: string
        backgroundColor: string | null
        duration: number
        expiresAt: Date
        userId: string
        createdAt: Date
        updatedAt: Date
        user: {
          id: string
          username: string
          profilePic: string | null
        }
        views: Array<{}>
      }>

      const storiesByUser = stories.reduce((acc: {
        [key: string]: {
          user: {
            id: string
            username: string
            profilePic: string | null
          }
          stories: typeof stories
          viewed: boolean
        }
      }, story) => {
        const userId = story.user.id
        if (!acc[userId]) {
          acc[userId] = {
            user: story.user,
            stories: [],
            viewed: story.views.length > 0
          }
        }
        acc[userId].stories.push(story)
        return acc
      }, {} as {
        [key: string]: {
          user: {
            id: string
            username: string
            profilePic: string | null
          }
          stories: typeof stories
          viewed: boolean
        }
      })

      return response.ok(Object.values(storiesByUser))
    } catch (error) {
      return response.internalServerError({
        message: 'Error al obtener stories',
        error: error.message
      })
    } finally {
      await prisma.$disconnect()
    }
  }

  /**
   * Registrar visualización de story
   */
  public async view({ params, response, request }: HttpContext) {
    const token = request.header('Authorization')?.replace('Bearer ', '')
    if (!token) return response.unauthorized({ message: 'Token no proporcionado' })

    try {
      const decoded = jwt.verify(token, env.get('APP_KEY')) as { userId: string }
      const { storyId } = params

      const story = await prisma.story.findFirst({
        where: {
          id: storyId,
          expiresAt: { gt: new Date() }
        }
      })

      if (!story) {
        return response.notFound({ message: 'Story no encontrada o expirada' })
      }

      await prisma.view.upsert({
        where: {
          storyId_userId: {
            storyId,
            userId: decoded.userId
          }
        },
        create: {
          storyId,
          userId: decoded.userId
        },
        update: {}
      })

      return response.ok({ message: 'Visualización registrada' })
    } catch (error) {
      return response.internalServerError({
        message: 'Error al registrar visualización',
        error: error.message
      })
    } finally {
      await prisma.$disconnect()
    }
  }
}