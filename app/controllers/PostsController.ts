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
      const { page = 1, limit = 100 } = request.qs()

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
                  username: true,
                  profilePic: true
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

      // Función mejorada para manejar imágenes (base64, URLs o nombres de archivo)
      const processImage = (image: string | null) => {
        if (!image) return null
        
        // Si ya es un base64 con prefijo
        if (image.startsWith('data:image')) {
          return image
        }
        
        // Si es una URL válida
        if (image.startsWith('http')) {
          return image
        }
        
        // Si es un string base64 sin prefijo (validamos con regex)
        if (/^[A-Za-z0-9+/]+={0,2}$/.test(image)) {
          // Asumimos JPEG (ajusta según necesites)
          return `data:image/jpeg;base64,${image}`
        }
        
        // Si no coincide con nada anterior, asumimos que es nombre de archivo
        const appUrl = env.get('APP_URL')
        return `${appUrl}/uploads/${image}`
      }

      // Procesamos todas las imágenes en la respuesta
      const processedPosts = posts.map(post => ({
        ...post,
        imagenes: Array.isArray(post.imagenes) 
          ? post.imagenes.map(processImage).filter(img => img !== null)
          : [],
        autor: {
          ...post.autor,
          profilePic: processImage(post.autor.profilePic)
        },
        reacciones: post.reacciones.map(reaction => ({
          ...reaction,
          user: {
            ...reaction.user,
            // No hay profilePic en el select actual, pero por si lo añades después
            ...(reaction.user.profilePic ? { 
              profilePic: processImage(reaction.user.profilePic) 
            } : {})
          }
        })),
        comentarios: post.comentarios.map(comment => ({
          ...comment,
          user: {
            ...comment.user,
            profilePic: processImage(comment.user.profilePic)
          }
        }))
      }))

      return response.ok(processedPosts)
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

    // Validar que la solicitud sea JSON
    if (!request.hasBody()) {
      return response.badRequest({ message: 'La solicitud debe contener un cuerpo JSON' })
    }

    const { content, images } = request.only(['content', 'images'])

    // Validación de contenido
    if (!content && (!images || images.length === 0)) {
      return response.badRequest({ 
        message: 'Se requiere contenido o al menos una imagen' 
      })
    }

    // Procesar imágenes base64
    const imagenesUrls: string[] = []

    if (images && images.length > 0) {
      for (const base64String of images) {
        try {
          // Validar el formato base64
          if (!base64String.startsWith('data:image/')) {
            throw new Error('Formato base64 no válido')
          }

          // Extraer metadata y datos
          const matches = base64String.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/)
          if (!matches || matches.length !== 3) {
            throw new Error('Formato base64 incorrecto')
          }

          const imageType = matches[1]
          const base64Data = matches[2]

          // Validar tipo de imagen
          const allowedTypes = ['jpeg', 'png', 'gif', 'webp', 'jpg']
          if (!allowedTypes.includes(imageType.toLowerCase())) {
            throw new Error(`Formato de imagen no soportado: ${imageType}`)
          }

          // Convertir base64 a buffer para validar tamaño
          const buffer = Buffer.from(base64Data, 'base64')
          if (buffer.length > 5 * 1024 * 1024) {
            throw new Error(`Imagen demasiado grande: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB`)
          }

          // Guardar la imagen como base64 en la base de datos
          imagenesUrls.push(base64String)
        } catch (error) {
          console.error('Error procesando imagen base64:', error)
          return response.badRequest({ 
            message: 'Error al procesar imagen',
            error: error.message
          })
        }
      }
    }

    // Procesar menciones y hashtags (si existen en el request)
    const privacidad = request.input('privacidad', 'PUBLICO')
    const hashtags = request.input('hashtags', [])
    const rawMenciones = request.input('menciones', [])

    // Procesar menciones
    const menciones = Array.isArray(rawMenciones) 
      ? rawMenciones.map(m => typeof m === 'string' ? JSON.parse(m) : m)
      : []

    // Extraer hashtags del contenido
    const extractedHashtags = (content as string)?.match(/#\w+/g) || []

    // Crear la publicación en transacción
    try {
      const post = await prisma.$transaction(async (trx) => {
        const postData = {
          content,
          imagenes: imagenesUrls, // Ahora guardamos los strings base64 directamente
          videos: [],
          privacidad,
          autorId: decoded.userId,
          hashtags: [...new Set([
            ...extractedHashtags, 
            ...(Array.isArray(hashtags) ? hashtags : [])
          ])],
          menciones: menciones.map((m: any) => m.id),
          mencionesUsernames: menciones.map((m: any) => m.username)
        }

        return await trx.publicaciones.create({ data: postData })
      })

      return response.created({
        success: true,
        data: post,
        imagenes: imagenesUrls.length
      })
    } catch (error) {
      console.error('Error al crear publicación:', error)
      return response.internalServerError({
        message: 'Error al crear la publicación',
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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