import { HttpContext } from '@adonisjs/core/http'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default class HashtagsController {
  public async processPost({ request, response }: HttpContext) {
    const { content } = request.only(['content'])
    
    const hashtags = extractHashtags(content)
    const mentions = extractMentions(content)

    // Buscar usuarios mencionados
    const mentionedUsers = await prisma.usuario.findMany({
      where: { username: { in: mentions } },
      select: { id: true }
    })

    // Procesar hashtags
    const hashtagRecords = await Promise.all(
      hashtags.map(async (tag) => {
        return prisma.hashtag.upsert({
          where: { tag },
          create: { tag, count: 1 },
          update: { count: { increment: 1 } }
        })
      })
    )

    return response.json({
      hashtags: hashtagRecords,
      mentions: mentionedUsers
    })
  }

  public async trending({ response }: HttpContext) {
    const trendingHashtags = await prisma.hashtag.findMany({
      orderBy: { count: 'desc' },
      take: 10
    })

    return response.json(trendingHashtags)
  }
    public async search({ request, response }: HttpContext) {
        const { query } = request.only(['query'])
    
        const hashtags = await prisma.hashtag.findMany({
        where: {
            tag: {
            contains: query,
            mode: 'insensitive'
            }
        },
        orderBy: { count: 'desc' },
        take: 10
        })
    
        return response.json(hashtags)
    }
    public async getHashtagPosts({ params, response }: HttpContext) {
        const { hashtag } = params

        const posts = await prisma.publicaciones.findMany({
            where: {
                hashtags: {
                    has: hashtag
                }
            },
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
                }
            },
            orderBy: { createdAt: 'desc' }
        })

        return response.json(posts)
    }

    public async getHashtagMentions({ params, response }: HttpContext) {
        const { hashtag } = params

        const posts = await prisma.publicaciones.findMany({
            where: {
                content: {
                    contains: `#${hashtag}`
                }
            },
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
                }
            },
            orderBy: { createdAt: 'desc' }

        })
        return response.json(posts)
}
}

function extractHashtags(content: any): string[] {
    if (typeof content !== 'string') return [];
    // Extract hashtags using regex: words starting with #
    return (content.match(/#(\w+)/g) || []).map(tag => tag.slice(1));
}
function extractMentions(content: any): string[] {
    if (typeof content !== 'string') return [];
    // Extract mentions using regex: words starting with @
    return (content.match(/@(\w+)/g) || []).map(mention => mention.slice(1));
}





