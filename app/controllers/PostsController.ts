import { HttpContext } from '@adonisjs/core/http'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import env from '#start/env'

const prisma = new PrismaClient()

export default class PostsController {
  // Feed general: posts del usuario + de los que sigue
  public async index({ request, response }: HttpContext) {
    const token = request.header('Authorization')?.replace('Bearer ', '')

    if (!token) {
      return response.unauthorized({ message: 'Token no proporcionado' })
    }

    try {
      const decoded = jwt.verify(token, env.get('APP_KEY')) as { userId: string }
      const { page = 1, limit = 10 } = request.qs()

      // Ajusta el nombre del campo de relación según tu esquema Prisma
      const user = await prisma.usuario.findUnique({
        where: { id: decoded.userId },
        select: { followingIds: true } // followingIds debe ser un array de strings (IDs)
      })

      const followingIds = user?.followingIds || []

      const posts = await prisma.publicaciones.findMany({
        where: {
          privacidad: { not: 'PRIVADO' },
          OR: [
            { autorId: decoded.userId },
            { autorId: { in: followingIds } }
          ]
        },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          autor: {
            select: {
              id: true,
              username: true,
              profilePic: true
            }
          },
          reacciones: {
            select: {
              id: true,
              tipoReaccion: true,
              user: {
                select: {
                  id: true,
                  username: true
                }
              }
            }
          },
          comentarios: {
            take: 2,
            orderBy: { createdAt: 'desc' },
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  profilePic: true
                }
              }
            }
          }
        }
      })

      return response.ok(posts)
    } catch (error) {
      console.error('Error al obtener publicaciones:', error)
      return response.internalServerError({
        message: 'Error al obtener las publicaciones',
        error: error.message
      })
    }
  }

  // Crear post
  public async store({ request, response }: HttpContext) {
    const token = request.header('Authorization')?.replace('Bearer ', '')

    if (!token) {
      return response.unauthorized({ message: 'Token no proporcionado' })
    }

    let decoded
    try {
      decoded = jwt.verify(token, env.get('APP_KEY')) as { userId: string }
    } catch (err) {
      return response.unauthorized({ message: 'Token inválido' })
    }

    const content = request.input('content')
    const privacidad = request.input('privacidad', 'PUBLICO')
    const imagenes = request.input('imagenes', [])
    const videos = request.input('videos', [])
    const hashtags = request.input('hashtags', [])
    const rawMenciones = request.input('menciones', [])

    if (!content) {
      return response.badRequest({ message: 'El campo "content" es obligatorio' })
    }

    const menciones = rawMenciones.map((m: any) =>
      typeof m === 'string' ? JSON.parse(m) : m
    )

    const extractedHashtags = content.match(/#\w+/g) || []

    try {
      const post = await prisma.publicaciones.create({
        data: {
          content,
          imagenes,
          videos,
          privacidad,
          autorId: decoded.userId,
          hashtags: [...new Set([...extractedHashtags, ...hashtags])],
          menciones: menciones.map((m: any) => m.id),
          mencionesUsernames: menciones.map((m: any) => m.username)
        },
        include: {
          autor: {
            select: {
              id: true,
              username: true,
              profilePic: true
            }
          }
        }
      })

      return response.created(post)
    } catch (error) {
      console.error('Error al crear publicación:', error)
      return response.internalServerError({
        message: 'Error al crear la publicación',
        error: error.message
      })
    }
  }

  // Feed del usuario autenticado: solo sus posts
  public async userPosts({ request, response }: HttpContext) {
    const token = request.header('Authorization')?.replace('Bearer ', '')

    if (!token) {
      return response.unauthorized({ message: 'Token no proporcionado' })
    }

    try {
      const decoded = jwt.verify(token, env.get('APP_KEY')) as { userId: string }
      const { page = 1, limit = 10 } = request.qs()

      const posts = await prisma.publicaciones.findMany({
        where: {
          autorId: decoded.userId
        },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          autor: {
            select: {
              id: true,
              username: true,
              profilePic: true
            }
          },
          reacciones: {
            select: {
              id: true,
              tipoReaccion: true,
              user: {
                select: {
                  id: true,
                  username: true
                }
              }
            }
          },
          comentarios: {
            take: 2,
            orderBy: { createdAt: 'desc' },
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  profilePic: true
                }
              }
            }
          }
        }
      })

      return response.ok(posts)
    } catch (error) {
      console.error('Error al obtener publicaciones del usuario:', error)
      return response.internalServerError({
        message: 'Error al obtener publicaciones del usuario',
        error: error.message
      })
    }
  }
}
