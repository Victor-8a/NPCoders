import { HttpContext } from '@adonisjs/core/http'
import { PrismaClient } from '@prisma/client'
import hash from '@adonisjs/core/services/hash'
import jwt from 'jsonwebtoken'
import env from '#start/env'

const prisma = new PrismaClient()

export default class UsersController {
  /**
   * Crear nuevo usuario
   */
  public async crearUsuario({ request, response }: HttpContext) {
    const { username, email, password } = request.only(['username', 'email', 'password'])
    const hashedPassword = await hash.make(password)

    // 1. Verificar si el usuario ya existe
    const usuarioExistente = await prisma.usuario.findFirst({
      where: {
        OR: [
          { email: email },
          { username: username }
        ]
      }
    })

    if (usuarioExistente) {
      if (usuarioExistente.email === email) {
        return response.status(400).json({ 
          message: 'El correo electrónico ya está registrado' 
        })
      }
      if (usuarioExistente.username === username) {
        return response.status(400).json({ 
          message: 'El nombre de usuario ya está en uso' 
        })
      }
    }

    const usuario = await prisma.usuario.create({
      data: {
        username,
        email,
        password: hashedPassword,
        bio: '',
        profilePic: 'default.jpg',
        privacidad: 'PUBLICO'
      }
    })

    const token = jwt.sign(
      { userId: usuario.id, email: usuario.email },
      env.get('APP_KEY'),
      { expiresIn: '24h' }
    )

    return response.created({
      message: 'Usuario creado correctamente',
      data: {
        user: {
          id: usuario.id,
          username: usuario.username,
          email: usuario.email,
          bio: usuario.bio,
          privacidad: usuario.privacidad,
          profilePic: usuario.profilePic
        },
        token
      }
    })
  }

  /**
   * Iniciar sesión
   */
  public async login({ request, response }: HttpContext) {
    const { email, password } = request.only(['email', 'password'])

    const usuario = await prisma.usuario.findUnique({ 
      where: { email } 
    })

    if (!usuario) {
      return response.status(404).json({ message: 'Usuario no encontrado' })
    }

    const validPassword = await hash.verify(usuario.password, password)

    if (!validPassword) {
      return response.status(401).json({ message: 'Contraseña incorrecta' })
    }

    const token = jwt.sign(
      { userId: usuario.id, email: usuario.email },
      env.get('APP_KEY'),
      { expiresIn: '24h' }
    )

    return response.ok({
      message: 'Inicio de sesión exitoso',
      data: {
        user: {
          id: usuario.id,
          username: usuario.username,
          email: usuario.email,
          profilePic: usuario.profilePic
        },
        token
      }
    })
  }

  /**
   * Obtener perfil del usuario autenticado (detallado)
   */
  public async profile({ request, response }: HttpContext) {
    try {
      // Obtener el token del header
      const token = request.header('Authorization')?.replace('Bearer ', '')
      
      if (!token) {
        return response.unauthorized({ message: 'Token no proporcionado' })
      }

      // Verificar el token manualmente
      const decoded = jwt.verify(token, env.get('APP_KEY')) as { userId: string }
      
      const usuario = await prisma.usuario.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          username: true,
          email: true,
          bio: true,
          profilePic: true,
          followersIds: true,
          followingIds: true,
          privacidad: true,
          createdAt: true
        }
      })

      if (!usuario) {
        return response.notFound({ message: 'Usuario no encontrado' })
      }

      return response.ok(usuario)
    } catch (error) {
      return response.unauthorized({ message: 'Token inválido o expirado' })
    }
  }
  
  /**
   * Obtener información resumida del usuario autenticado
   */
  public async me({ request, response }: HttpContext) {
    const token = request.header('Authorization')?.replace('Bearer ', '')

    if (!token) {
      return response.unauthorized({ message: 'Token no proporcionado' })
    }

    try {
      const decoded = jwt.verify(token, env.get('APP_KEY')) as { userId: string }
      
      const user = await prisma.usuario.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          username: true,
          email: true,
          bio: true,
          profilePic: true,
          privacidad: true,
          followersIds: true,
          followingIds: true
        }
      })

      if (!user) {
        return response.notFound({ message: 'Usuario no encontrado' })
      }

      // Contar publicaciones
      const postCount = await prisma.publicaciones.count({
        where: { autorId: decoded.userId }
      })

      // Formatear la respuesta
      const responseData = {
        id: user.id,
        username: user.username,
        email: user.email,
        bio: user.bio,
        profilePic: user.profilePic,
        privacidad: user.privacidad,
        _count: {
          publicaciones: postCount,
          followers: user.followersIds.length,
          following: user.followingIds.length
        }
      }

      return response.ok(responseData)

    } catch (error) {
      return response.unauthorized({ 
        message: 'Token inválido o expirado',
        error: error.message 
      })
    }
  }

  /**
   * Obtener perfil público de un usuario
   */
  public async showProfile({ params, request, response }: HttpContext) {
    const { username } = params
    const token = request.header('Authorization')?.replace('Bearer ', '')

    try {
      // Buscar el usuario por username
      const user = await prisma.usuario.findUnique({
        where: { username },
        select: {
          id: true,
          username: true,
          bio: true,
          profilePic: true,
          privacidad: true,
          followersIds: true,
          followingIds: true,
          createdAt: true
        }
      })

      if (!user) {
        return response.notFound({ message: 'Usuario no encontrado' })
      }

      // Verificar privacidad del perfil
      let isAuthorized = false
      let isFollowing = false

      if (token) {
        try {
          const decoded = jwt.verify(token, env.get('APP_KEY')) as { userId: string }
          
          // Si es el propio usuario, mostrar todo
          if (decoded.userId === user.id) {
            isAuthorized = true
          } else {
            // Verificar si el usuario actual sigue al perfil visitado
            isFollowing = user.followersIds.includes(decoded.userId)
            
            // Reglas de privacidad
            if (user.privacidad === 'PUBLICO') {
              isAuthorized = true
            } else if (user.privacidad === 'SOLO_AMIGOS' && isFollowing) {
              isAuthorized = true
            }
          }
        } catch (error) {
          // Token inválido, tratar como usuario no autenticado
          if (user.privacidad !== 'PUBLICO') {
            return response.unauthorized({ 
              message: 'Este perfil es privado. Debes iniciar sesión y seguir al usuario para ver su contenido.'
            })
          }
          isAuthorized = true
        }
      } else {
        // No hay token - solo mostrar si es público
        if (user.privacidad !== 'PUBLICO') {
          return response.unauthorized({ 
            message: 'Este perfil es privado. Inicia sesión para ver si puedes acceder.'
          })
        }
        isAuthorized = true
      }

      if (!isAuthorized) {
        return response.forbidden({ 
          message: 'No tienes permiso para ver este perfil'
        })
      }

      // Obtener estadísticas
      const postCount = await prisma.publicaciones.count({
        where: { 
          autorId: user.id,
          privacidad: isAuthorized ? undefined : 'PUBLICO'
        }
      })

      const responseData = {
        id: user.id,
        username: user.username,
        bio: user.bio,
        profilePic: user.profilePic,
        privacidad: user.privacidad,
        createdAt: user.createdAt,
        stats: {
          posts: postCount,
          followers: user.followersIds.length,
          following: user.followingIds.length
        },
        isFollowing: token ? isFollowing : undefined
      }

      return response.ok(responseData)

    } catch (error) {
      return response.internalServerError({ 
        message: 'Error al obtener el perfil',
        error: error.message 
      })
    }
  }

  /**
   * Obtener publicaciones de un usuario (considerando privacidad)


  /**
   * Buscar usuarios públicos
   */
  public async searchUsers({ request, response }: HttpContext) {
    const { query } = request.only(['query'])
    const page = request.input('page', 1)
    const limit = request.input('limit', 10)

    if (!query || query.length < 3) {
      return response.badRequest({ 
        message: 'La búsqueda debe tener al menos 3 caracteres' 
      })
    }

    try {
      const users = await prisma.usuario.findMany({
        where: {
          OR: [
            { username: { contains: query, mode: 'insensitive' } },
            { bio: { contains: query, mode: 'insensitive' } }
          ],
          privacidad: 'PUBLICO'
        },
        select: {
          id: true,
          username: true,
          bio: true,
          profilePic: true,
          followersIds: true,
          followingIds: true
        },
        orderBy: {
          followersIds: 'desc'
        },
        skip: (page - 1) * limit,
        take: limit
      })

      const total = await prisma.usuario.count({
        where: {
          OR: [
            { username: { contains: query, mode: 'insensitive' } },
            { bio: { contains: query, mode: 'insensitive' } }
          ],
          privacidad: 'PUBLICO'
        }
      })

      const responseData = users.map(user => ({
        id: user.id,
        username: user.username,
        bio: user.bio,
        profilePic: user.profilePic,
        stats: {
          followers: user.followersIds.length,
          following: user.followingIds.length
        }
      }))

      return response.ok({
        results: responseData,
        pagination: {
          page,
          limit,
          total
        }
      })

    } catch (error) {
      return response.internalServerError({ 
        message: 'Error en la búsqueda',
        error: error.message 
      })
    }
  }



  // Añade estos métodos en tu UsersController


}