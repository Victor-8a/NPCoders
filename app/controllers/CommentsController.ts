import { HttpContext } from '@adonisjs/core/http'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import env from '#start/env'

const prisma = new PrismaClient()

export default class CommentsController {
    
  public async store({ params, request, response }: HttpContext) {
    const token = request.header('Authorization')?.replace('Bearer ', '')
    
    if (!token) {
      return response.unauthorized({ message: 'Token no proporcionado' })
    }

    try {
      const decoded = jwt.verify(token, env.get('APP_KEY')) as { userId: string }
      const { text } = request.only(['text'])

      const comment = await prisma.publicacionesComments.create({
        data: {
          text,
          userId: decoded.userId,
          publicacionId: params.postId
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
      })

      return response.created(comment)
    } catch (error) {
      return response.internalServerError({ 
        message: 'Error al agregar el comentario',
        error: error.message 
      })
    }
  }

  public async like({ params, request, response }: HttpContext) {
    const token = request.header('Authorization')?.replace('Bearer ', '')
    
    if (!token) {
      return response.unauthorized({ message: 'Token no proporcionado' })
    }

    try {
      const decoded = jwt.verify(token, env.get('APP_KEY')) as { userId: string }
      const { tipoReaccion = 'ME_GUSTA' } = request.only(['tipoReaccion'])

      const existingLike = await prisma.like.findFirst({
        where: {
          userId: decoded.userId,
          commentId: params.commentId
        }
      })

      if (existingLike) {
        await prisma.like.delete({ where: { id: existingLike.id } })
        return response.ok({ message: 'Reacción eliminada' })
      }

      const like = await prisma.like.create({
        data: {
          tipoReaccion,
          userId: decoded.userId,
          commentId: params.commentId
        }
      })

      return response.created(like)
    } catch (error) {
      return response.internalServerError({ 
        message: 'Error al reaccionar al comentario',
        error: error.message 
      })
    }
  }

// Métodos adicionales para el CommentsController
public async reactions({ params, response }: HttpContext) {
  const reactions = await prisma.like.groupBy({
    by: ['tipoReaccion'],
    where: { commentId: params.commentId },
    _count: { _all: true }
  })

  return response.json(reactions)
}
  public async delete({ params, response }: HttpContext) {
    try {
      const comment = await prisma.publicacionesComments.delete({
        where: { id: params.commentId }
      })
      return response.json(comment)
    } catch (error) {
      return response.internalServerError({ 
        message: 'Error al eliminar el comentario',
        error: error.message 
      })
    }
  }

  public async index({ params, response }: HttpContext) {
    try {
      const comments = await prisma.publicacionesComments.findMany({
        where: { publicacionId: params.postId },
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              profilePic: true
            }
          },
          likes: {
            select: {
              tipoReaccion: true,
              userId: true
            }
          }
        }
      })

      return response.json(comments)
    } catch (error) {
      return response.internalServerError({ 
        message: 'Error al obtener los comentarios',
        error: error.message 
      })
    }
  }

  public async getComment({ params, response }: HttpContext) {
    try {
      const comment = await prisma.publicacionesComments.findUnique({
        where: { id: params.commentId },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              profilePic: true
            }
          },
          likes: {
            select: {
              tipoReaccion: true,
              userId: true
            }
          }
        }
      })

      if (!comment) {
        return response.notFound({ message: 'Comentario no encontrado' })
      }

      return response.json(comment)
    } catch (error) {
      return response.internalServerError({ 
        message: 'Error al obtener el comentario',
        error: error.message 
      })
    }
  }
  public async getCommentLikes({ params, response }: HttpContext) {
    try {
      const likes = await prisma.like.findMany({
        where: { commentId: params.commentId },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              profilePic: true
            }
          }
        }
      })

      return response.json(likes)
    } catch (error) {
      return response.internalServerError({ 
        message: 'Error al obtener las reacciones del comentario',
        error: error.message 
      })
    }
  }

  public async getCommentReplies({ params, response }: HttpContext) {
    try {
      const replies = await prisma.publicacionesComments.findMany({
        where: { id: params.commentId },
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              profilePic: true
            }
          },
          likes: {
            select: {
              tipoReaccion: true,
              userId: true
            }
          }
        }
      })

      return response.json(replies)
    } catch (error) {
      return response.internalServerError({ 
        message: 'Error al obtener las respuestas del comentario',
        error: error.message 
      })
    }
  }
  public async getCommentRepliesCount({ params, response }: HttpContext) {
    try {
      const count = await prisma.publicacionesComments.count({
        where: { id: params.commentId }
      })

      return response.json({ count })
    } catch (error) {
      return response.internalServerError({ 
        message: 'Error al contar las respuestas del comentario',
        error: error.message 
      })
    }
  }
  public async getCommentRepliesLikes({ params, response }: HttpContext) {
    try {
      const likes = await prisma.like.findMany({
        where: { commentId: params.commentId },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              profilePic: true
            }
          }
        }
      })

      return response.json(likes)
    } catch (error) {
      return response.internalServerError({ 
        message: 'Error al obtener las reacciones de las respuestas del comentario',
        error: error.message 
      })
    }
  }

  public async getCommentRepliesCountByUser({ params, response }: HttpContext) {
    try {
      const count = await prisma.publicacionesComments.count({
        where: { id: params.commentId }
      })

      return response.json({ count })
    } catch (error) {
      return response.internalServerError({ 
        message: 'Error al contar las respuestas del comentario',
        error: error.message 
      })
    }
  }

  public async getCommentRepliesByUser({ params, response }: HttpContext) {
    try {
      const replies = await prisma.publicacionesComments.findMany({
        where: { id: params.commentId },
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              profilePic: true
            }
          },
          likes: {
            select: {
              tipoReaccion: true,
              userId: true
            }
          }
        }
      })

      return response.json(replies)
    } catch (error) {
      return response.internalServerError({ 
        message: 'Error al obtener las respuestas del comentario',
        error: error.message 
      })
    }
  }
}