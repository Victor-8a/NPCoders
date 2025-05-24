import { HttpContext,  } from '@adonisjs/core/http'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import env from '#start/env'



const prisma = new PrismaClient()

export default class FollowersController {
  /**
   * Obtener conteo de seguidores y seguidos
   */
  public async counts({ params, response }: HttpContext) {
    try {
      const user = await prisma.usuario.findUnique({
        where: { id: params.userId},
        select: {
              followersIds: true,
              followingIds: true
        }
      })

      if (!user) {
        return response.notFound({ message: 'Usuario no encontrado' })
      }



      return response.ok({
        followersCount: user.followersIds.length,
        followingCount: user.followingIds.length

      })
    } catch (error) {
      return response.internalServerError({ 
        message: 'Error al obtener estadísticas',
        error: error.message 
      })
    }
  }

  /**
   * Seguir a un usuario
   */
  public async follow({ params, request, response }: HttpContext) {
    try {
      const currentUserId = params.usuario; // ID del usuario autenticado
  
      if (!currentUserId) {
        return response.badRequest({ message: 'Falta el parámetro usuario en la URL' });
      }
  
      const { userToFollowId } = request.only(['userToFollowId']);
  
      if (!userToFollowId) {
        return response.badRequest({ message: 'Se requiere userToFollowId en el body' });
      }
  
      // Obtener datos del usuario actual
      const currentUser = await prisma.usuario.findUnique({
        where: { id: currentUserId },
        select: { id: true, username: true, followingIds: true }
      });
  
      if (!currentUser) {
        return response.notFound({ message: 'Usuario actual no encontrado' });
      }
  
      // Prevenir seguirse a sí mismo
      if (currentUserId === userToFollowId) {
        return response.badRequest({ message: 'No puedes seguirte a ti mismo' });
      }
  
      // Obtener datos del usuario a seguir
      const userToFollow = await prisma.usuario.findUnique({
        where: { id: userToFollowId },
        select: { id: true, username: true, followersIds: true }
      });
  
      if (!userToFollow) {
        return response.notFound({ message: 'Usuario a seguir no encontrado' });
      }
  
      // Verificar si ya lo sigue
      if (currentUser.followingIds.includes(userToFollowId)) {
        return response.badRequest({ message: 'Ya sigues a este usuario' });
      }
  
      // Transacción para actualizar ambas relaciones
      await prisma.$transaction([
        prisma.usuario.update({
          where: { id: currentUserId },
          data: {
            followingIds: [...currentUser.followingIds, userToFollow.id]
          }
        }),
        prisma.usuario.update({
          where: { id: userToFollow.id },
          data: {
            followersIds: [...userToFollow.followersIds, currentUser.id]
          }
        })
      ]);
  
      return response.created({
        success: true,
        message: `Ahora sigues a ${userToFollow.username}`
      });
    } catch (error) {
      console.error(error);
      return response.internalServerError({
        message: 'Error al seguir usuario',
        error: error.message
      });
    }
  }
  
  

  /**
   * Dejar de seguir a un usuario
   */
  public async deleteFollower({ params, request, response }: HttpContext) {
    try {
      const currentUserId = params.usuario;
  
      if (!currentUserId) {
        return response.badRequest({ message: 'Falta el parámetro usuario en la URL' });
      }
  
      const { userToDelete } = request.only(['userToDelete']);
  
      if (!userToDelete) {
        return response.badRequest({ message: 'Se requiere userToDelete en el body' });
      }
  
      // Obtener al usuario que me sigue (de quien me quiero deshacer como seguidor)
      const userThatFollowsMe = await prisma.usuario.findUnique({
        where: { id: userToDelete },
        select: { followingIds: true },
      });
  
      if (!userThatFollowsMe || !userThatFollowsMe.followingIds.includes(currentUserId)) {
        return response.badRequest({ message: 'Este usuario no te está siguiendo' });
      }
  
      // Obtener mi lista de seguidores
      const me = await prisma.usuario.findUnique({
        where: { id: currentUserId },
        select: { followersIds: true },
      });
  
      // Transacción para eliminar la relación de seguimiento
      await prisma.$transaction([
        // Eliminarme de la lista de seguidos de ese usuario
        prisma.usuario.update({
          where: { id: userToDelete },
          data: {
            followingIds: userThatFollowsMe.followingIds.filter(id => id !== currentUserId),
          },
        }),
        // Eliminar al usuario de mi lista de seguidores
        prisma.usuario.update({
          where: { id: currentUserId },
          data: {
            followersIds: me!.followersIds.filter(id => id !== userToDelete),
          },
        }),
      ]);
  
      return response.ok({
        success: true,
        message: 'Has eliminado al usuario de tus seguidores',
      });
    } catch (error) {
      console.log(error);
      return response.internalServerError({
        message: 'Error al eliminar el seguidor',
        error: error.message,
      });
    }
  }
  
  
  

  /**
   * Obtener lista de seguidores con paginación
   */
  public async followers({ params, request, response }: HttpContext) {
    try {
      const { page = 1, limit = 10 } = request.qs()

      const user = await prisma.usuario.findUnique({
        where: { username: params.username },
        select: { followersIds: true }
      })

      if (!user) {
        return response.notFound({ message: 'Usuario no encontrado' })
      }

      const followers = await prisma.usuario.findMany({
        where: { id: { in: user.followersIds } },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          username: true,
          profilePic: true,
          bio: true
        }
      })

      return response.ok({
        meta: {
          total: user.followersIds.length,
          page,
          perPage: limit,
          lastPage: Math.ceil(user.followersIds.length / limit)
        },
        data: followers
      })
    } catch (error) {
      return response.internalServerError({ 
        message: 'Error al obtener seguidores',
        error: error.message 
      })
    }
  }

  /**
   * Obtener lista de seguidos con paginación
   */
  public async following({ params, request, response }: HttpContext) {
    try {
      const { page = 1, limit = 10 } = request.qs()

      const user = await prisma.usuario.findUnique({
        where: { username: params.username },
        select: { followingIds: true }
      })

      if (!user) {
        return response.notFound({ message: 'Usuario no encontrado' })
      }

      const following = await prisma.usuario.findMany({
        where: { id: { in: user.followingIds } },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          username: true,
          profilePic: true,
          bio: true,

        }
      })

      return response.ok({
        meta: {
          total: user.followingIds.length,
          page,
          perPage: limit,
          lastPage: Math.ceil(user.followingIds.length / limit)
        },
        data: following
      })
    } catch (error) {
      return response.internalServerError({ 
        message: 'Error al obtener seguidos',
        error: error.message 
      })
    }
  }


  
/**
 * Obtener lista de seguidos
 */
public async getFollowing({ params, response }: HttpContext) {
  const { userId } = params;

  try {
    const user = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { followingIds: true },
    });


    if (!user) {
      return response.notFound({ message: 'Usuario no encontrado' });
    }

    const following = await prisma.usuario.findMany({
      where: { id: { in: user.followingIds } },
      select: {
        id: true,
        username: true,
        profilePic: true,
        followersIds: true,
        followingIds: true,
      },
    });

    const formattedFollowing = following.map((user) => ({
      id: user.id,
      name: user.username,
      username: user.username,
      avatar: user.profilePic,
      isFollowing: true,
      followersCount: user.followersIds.length,
    }));

    console.log(formattedFollowing);

    // Devuelve un objeto con la propiedad "following"
    return response.ok({ following: formattedFollowing });
  } catch (error) {
    return response.internalServerError({
      message: 'Error al obtener seguidos',
      error: error.message,
    });
  }
}


public async getFollowers({ params, response }: HttpContext) {
  const { userId } = params;

  try {
    const user = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { followersIds: true },
    });

    if (!user) {
      return response.notFound({ message: 'Usuario no encontrado' });
    }

    const followers = await prisma.usuario.findMany({
      where: { id: { in: user.followersIds } },
      select: {
        id: true,
        username: true,
        profilePic: true,
        followersIds: true,
        followingIds: true,
      },
    });

    const formattedFollowers = followers.map((user) => ({
      id: user.id,
      name: user.username,
      username: user.username,
      avatar: user.profilePic,
      isFollowing: true,
      followersCount: user.followersIds.length,
    }));

    // Devuelve un objeto con la propiedad "followers"
    return response.ok({ followers: formattedFollowers });
  } catch (error) {
    return response.internalServerError({
      message: 'Error al obtener seguidores',
      error: error.message,
    });
  }
    }

/**
 * Obtener sugerencias de usuarios
 */

public async getSuggestions({ params, response }: HttpContext) {
  const userId = params.userId

  try {
    const users = await prisma.usuario.findMany({
      where: {
        privacidad: 'PUBLICO',
        id: { not: userId } // Excluir a uno mismo
      },
      select: {
        id: true,
        username: true,
        profilePic: true,
        followersIds: true,
        followingIds: true
      },
      take: 50
    })

    function shuffleArray<T>(array: T[]): T[] {
      return [...array].sort(() => Math.random() - 0.5)
    }

    const shuffled = shuffleArray(users)
    const formatted = shuffled.map(user => ({
      id: user.id,
      name: user.username,
      username: user.username,
      avatar: user.profilePic,
      isFollowing: false,
      followersCount: user.followersIds.length
    }))

    return response.ok(formatted)
  } catch (error) {
    return response.internalServerError({
      message: 'Error al obtener sugerencias',
      error: error.message
    })
  }
}



/**
 * Seguir a un usuario
 */
public async followUser({ request, response }: HttpContext) {
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

  const { targetUserId } = request.body()

  if (!targetUserId) {
    return response.badRequest({ message: 'Target user ID no proporcionado' })
  }

  try {
    // Verificar que el usuario autenticado existe
    const user = await prisma.usuario.findUnique({
      where: { id: decoded.userId },
      select: { id: true, followingIds: true }
    })

    if (!user) {
      return response.notFound({ message: 'Usuario autenticado no encontrado' })
    }

    // Verificar que el usuario objetivo existe
    const targetUser = await prisma.usuario.findUnique({
      where: { id: targetUserId }
    })

    if (!targetUser) {
      return response.notFound({ message: 'Usuario objetivo no encontrado' })
    }

    if (user.followingIds.includes(targetUserId)) {
      return response.badRequest({ message: 'Ya sigues a este usuario' })
    }

    // Actualizar la lista de seguidores y seguidos
    await prisma.usuario.update({
      where: { id: user.id },
      data: { followingIds: { push: targetUserId } }
    })

    await prisma.usuario.update({
      where: { id: targetUserId },
      data: { followersIds: { push: user.id } }
    })

    return response.ok({
      success: true,
      message: 'Usuario seguido correctamente'
    })
  } catch (error) {
    console.error('Error al seguir usuario:', error)
    return response.internalServerError({
      message: 'Error al seguir usuario',
      error: error.message
    })
  }
}


/***  Nuevo seguidor */
public async newFollower({ request, response, auth }: HttpContext) {
  const { targetUserId } = request.body()

  try {
    const authUser = await auth.user('api').authenticate()

    // Obtener el usuario autenticado desde la base de datos
    const user = await prisma.usuario.findUnique({
      where: { id: authUser?.id },
      select: { id: true, followingIds: true, followersIds: true }
    })

    if (!user) {
      return response.notFound({ message: 'Usuario autenticado no encontrado' })
    }

    // Verificar si ya sigue al usuario
    if (user.followingIds.includes(targetUserId)) {
      return response.badRequest({ message: 'Ya sigues a este usuario' })
    }

    // Actualizar el usuario que sigue
    await prisma.usuario.update({
      where: { id: user.id },
      data: { followingIds: { push: targetUserId } }
    })

    // Actualizar el usuario seguido
    await prisma.usuario.update({
      where: { id: targetUserId },
      data: { followersIds: { push: user.id } }
    })

    return response.ok({ 
      success: true,
      message: 'Usuario seguido correctamente'
    })

  } catch (error) {
    return response.internalServerError({
      message: 'Error al seguir usuario',
      error: error.message
    })
  }
}


public async unfollow({ params, request, response }: HttpContext) {
  const currentUserId = params.userId; // viene de la URL
  const { targetUserId } = request.only(['targetUserId']); // viene del body

  if (!currentUserId || !targetUserId) {
    return response.badRequest({ message: 'Faltan parámetros' });
  }

  if (currentUserId === targetUserId) {
    return response.badRequest({ message: 'No puedes dejar de seguirte a ti mismo' });
  }

  try {
    const [currentUser, userToUnfollow] = await Promise.all([
      prisma.usuario.findUnique({ where: { id: currentUserId } }),
      prisma.usuario.findUnique({ where: { id: targetUserId } })
    ]);

    if (!currentUser || !userToUnfollow) {
      return response.notFound({ message: 'Usuario no encontrado' });
    }

    const isFollowing = currentUser.followingIds.includes(targetUserId);
    if (!isFollowing) {
      return response.badRequest({ message: 'No estás siguiendo a este usuario' });
    }

    const updatedFollowingIds = currentUser.followingIds.filter(id => id !== targetUserId);
    const updatedFollowersIds = userToUnfollow.followersIds.filter(id => id !== currentUserId);

    await prisma.$transaction([
      prisma.usuario.update({
        where: { id: currentUserId },
        data: { followingIds: updatedFollowingIds }
      }),
      prisma.usuario.update({
        where: { id: targetUserId },
        data: { followersIds: updatedFollowersIds }
      })
    ]);

    const [updatedCurrentUser, updatedUnfollowedUser] = await Promise.all([
      prisma.usuario.findUnique({
        where: { id: currentUserId },
        select: { followingIds: true }
      }),
      prisma.usuario.findUnique({
        where: { id: targetUserId },
        select: { followersIds: true }
      })
    ]);

    return response.ok({
      success: true,
      message: `Has dejado de seguir a ${userToUnfollow.username}`,
      counts: {
        followingCount: updatedCurrentUser?.followingIds.length || 0,
        followersCount: updatedUnfollowedUser?.followersIds.length || 0
      }
    });
  } catch (error) {
    console.log('Error al dejar de seguir usuario:', error);
    return response.internalServerError({
      message: 'Error al dejar de seguir usuario',
      error: error.message
    });
  }
}




/**
 * Dejar de seguir a un usuario
 */
public async unfollowUser({ request, response, auth }: HttpContext) {
  const { targetUserId } = request.body()

  try {
    const authUser = await auth.user('api').authenticate()

    // Obtener el usuario autenticado desde la base de datos
    const user = await prisma.usuario.findUnique({
      where: { id: authUser?.id },
      select: { id: true, followingIds: true }
    })

    if (!user) {
      return response.notFound({ message: 'Usuario autenticado no encontrado' })
    }

    // Verificar si ya sigue al usuario
    if (!user.followingIds.includes(targetUserId)) {
      return response.badRequest({ message: 'No sigues a este usuario' })
    }

    // Actualizar el usuario que deja de seguir
    await prisma.usuario.update({
      where: { id: user.id },
      data: { followingIds: { set: user.followingIds.filter(id => id !== targetUserId) } }
    })

    // Actualizar el usuario seguido
    await prisma.usuario.update({
      where: { id: targetUserId },
      data: { followersIds: { set: (await prisma.usuario.findUnique({ where: { id: targetUserId }, select: { followersIds: true } }))?.followersIds.filter(id => id !== user.id) || [] } }
    })

    return response.ok({ 
      success: true,
      message: 'Has dejado de seguir al usuario'
    })

  } catch (error) {
    return response.internalServerError({
      message: 'Error al dejar de seguir usuario',
      error: error.message
    })
  }

}
    
  }