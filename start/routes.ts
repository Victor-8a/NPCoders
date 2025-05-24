import ChatsController from '#controllers/ChatController'
import CommentsController from '#controllers/CommentsController'
import FollowersController from '#controllers/FollowersController'
import HashtagsController from '#controllers/hashtags_controller'
import NotificationsController from '#controllers/notifications_controller'
import PostsController from '#controllers/PostsController'
import UsersController from '#controllers/users_controller'
import PrivacidadMiddleware from '#middleware/privacidad'
import router from '@adonisjs/core/services/router'
// import { HttpContext } from '@adonisjs/core/http'
// import { middleware } from './kernel.js'

declare module '@adonisjs/core/http' {
  interface HttpContext {
    auth: {
      authenticate: () => Promise<void>
      user: any
    }
  }
}


// Ruta principal
router.get('/', async () => {
  return {
    hello: 'Hola NPCs',
  }
})


// Grupo de rutas de API
router.group(() => {
  router.group(() => {
    router.post('/register', [UsersController, 'crearUsuario'])
    router.post('/login', [UsersController, 'login'])
    router.get('/me', [UsersController, 'me'])
  }).prefix('/auth')
    .use([PrivacidadMiddleware.handle])
})


  router.group(() => {
    router.get('/getFollowing/:userId', [FollowersController, 'getFollowing'])
    router.get('/getSuggestions/:userId', [FollowersController, 'getSuggestions'])
    router.post('/followUser', [FollowersController, 'followUser'])
    router.get('/followers', [FollowersController, 'followers'])
    router.get('/following', [FollowersController, 'following'])
    router.post('/follow/:usuario', [FollowersController, 'follow'])
    router.post('/deleteFollower/:usuario', [FollowersController, 'deleteFollower'])
    router.post('/unfollow/:userId', [FollowersController, 'unfollow'])
    router.get('/counts/:userId', [FollowersController, 'counts'])
    router.get('/getFollowers/:userId', [FollowersController, 'getFollowers'])
  }).prefix('/followers')


  router.group(() => {
    router.get('/posts', [PostsController, 'index'])
    router.post('/posts', [PostsController, 'store'])
    router.get('/userPosts', [PostsController, 'userPosts'])
    router.post('/postear', [PostsController, 'store'])
  })
  .prefix('/posts')
  
router.group(() => {
  router.group(() => {

  }).prefix('/followers')
})


router.group(() => {
  router.post('/process-content', [HashtagsController, 'processPost'])
  router.get('/trending', [HashtagsController, 'trending'])
  router.get('/search', [HashtagsController, 'search'])
  router.get('/:hashtag/posts', [HashtagsController, 'getHashtagPosts'])
  router.get('/:hashtag/mentions', [HashtagsController, 'getHashtagMentions'])
}).prefix('/hashtags')

router.group(() => {
  router.get('/:commentId/reactions', [CommentsController, 'reactions'])
  router.post('/', [CommentsController, 'store'])
  router.get('/:postId', [CommentsController, 'index'])
  router.delete('/:commentId', [CommentsController, 'delete'])
  router.get('/:commentId/replies', [CommentsController, 'getCommentRepliesCountByUser'])

}).prefix('/comments')


router.group(() => {
  router.get('/', [NotificationsController, 'index'])
}).prefix('/notifications')


router.group(() => {
  router.get('/', [ChatsController, 'index'])
  router.post('/:chatId/messages', [ChatsController, 'storeMessage'])
}).prefix('/chats')