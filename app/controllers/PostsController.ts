import { HttpContext } from '@adonisjs/core/http'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import env from '#start/env'

const prisma = new PrismaClient()

export default class PostsController {
    
  public async index({ request, response }: HttpContext) {
    const token = request.header('Authorization')?.replace('Bearer ', '')
    
    if (!token) {
      return response.unauthorized({ message: 'Token no proporcionado' })
    }

    try {
      const decoded = jwt.verify(token, env.get('APP_KEY')) as { userId: string }
      const { page = 1, limit = 10 } = request.qs()

      const posts = await prisma.publicaciones.findMany({
        where: {
          OR: [
            { autorId: decoded.userId },
            { autor: { followersIds: { has: decoded.userId } } }
          ],
          privacidad: { not: 'PRIVADO' }
        },
        skip: (page - 1) * limit,
        take: limit,
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

    // Obtener inputs uno por uno (request.only no sirve bien con form-data)
    const content = request.input('content')
    const privacidad = request.input('privacidad', 'PUBLICO')
    const imagenes = request.input('imagenes', []) // asume que son strings
    const videos = request.input('videos', [])
    const hashtags = request.input('hashtags', [])
    const rawMenciones = request.input('menciones', [])

    if (!content) {
      return response.badRequest({ message: 'El campo "content" es obligatorio' })
    }

    // Parsear menciones si vienen como strings JSON
    const menciones = rawMenciones.map((m: any) =>
      typeof m === 'string' ? JSON.parse(m) : m
    )

    // Extraer hashtags del contenido
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

  public async userPosts({ params, request, response }: HttpContext) {
    try {
      const { page = 1, limit = 10 } = request.qs()

      const posts = await prisma.publicaciones.findMany({
        where: { autor: { username: params.username } },
        skip: (page - 1) * limit,
        take: limit,
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
      return response.internalServerError({ 
        message: 'Error al obtener las publicaciones del usuario',
        error: error.message 
      })
    }
  }

  public async delete({ params, response }: HttpContext) {
    try {
      const post = await prisma.publicaciones.delete({
        where: { id: params.id }
      })

      return response.ok({ message: 'Publicación eliminada', post })
    } catch (error) {
      return response.internalServerError({ 
        message: 'Error al eliminar la publicación',
        error: error.message 
      })
    }
  }

  public async update({ params, request, response }: HttpContext) {
    try {
      const { content, imagenes, videos, hashtags, menciones, privacidad } = request.only([
        'content', 'imagenes', 'videos', 'hashtags', 'menciones', 'privacidad'
      ])

      const post = await prisma.publicaciones.update({
        where: { id: params.id },
        data: {
          content,
          imagenes,
          videos,
          hashtags,
          menciones,
          privacidad
        }
      })

      return response.ok({ message: 'Publicación actualizada', post })
    } catch (error) {
      return response.internalServerError({ 
        message: 'Error al actualizar la publicación',
        error: error.message 
      })
    }
  }








}