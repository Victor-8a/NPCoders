import UsersController from '#controllers/users_controller'
import router from '@adonisjs/core/services/router'
import { HttpContext } from '@adonisjs/core/http'

declare module '@adonisjs/core/http' {
  interface HttpContext {
    auth: {
      authenticate: () => Promise<void>
      user: any
    }
  }
}
import { middleware } from './kernel.js'

// Ruta principal
router.get('/', async () => {
  return {
    hello: 'Hola NPCs',
  }
})


// Grupo de rutas de API
router.group(() => {
  // Grupo de rutas de autenticación (sin protección)
  router.group(() => {
    router.post('/register', [UsersController, 'crearUsuario'])
    router.post('/login', [UsersController, 'login'])
  }).prefix('/auth')})

  router.get('/profile', async ({ auth, response }: HttpContext) => {
    await auth.authenticate()
    return response.json(auth.user!) 
  }).middleware([middleware.auth])



  