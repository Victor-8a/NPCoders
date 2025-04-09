import { HttpContext } from '@adonisjs/core/http'
import { PrismaClient } from '@prisma/client'
import hash from '@adonisjs/core/services/hash'
import jwt from 'jsonwebtoken'
import env from '#start/env'

const Usuarios = new PrismaClient().usuarios

export default class UsersController {
  public async crearUsuario({ request, response }: HttpContext) {
    const { username, email, password } = request.only(['username', 'email', 'password'])
    const hashedPassword = await hash.make(password)

    const usuario = await Usuarios.create({
      data: {
        username,
        email,
        password: hashedPassword,
        bio: '',
        profilePic: 'default.jpg',
        privacy: 'public',
        followers: [],
        following: [],
        blockedUsers: [],
        createdAt: new Date()
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
          email: usuario.email
        },
        token
      }
    })
  }

  public async login({ request, response }: HttpContext) {
    const { email, password } = request.only(['email', 'password'])

    const usuario = await Usuarios.findUnique({ where: { email } })

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

  // Método actualizado para usar auth correctamente
  public async profile({ request, response }: HttpContext) {
    try {
      // Obtener el token del header
      const token = request.header('Authorization')?.replace('Bearer ', '')
      
      if (!token) {
        return response.unauthorized({ message: 'Token no proporcionado' })
      }

      // Verificar el token manualmente
      const decoded = jwt.verify(token, env.get('APP_KEY')) as { userId: string }
      
      const usuario = await Usuarios.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          username: true,
          email: true,
          bio: true,
          profilePic: true,
          followers: true,
          following: true
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
}