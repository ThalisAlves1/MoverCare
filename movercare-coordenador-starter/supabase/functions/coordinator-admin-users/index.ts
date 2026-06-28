// @ts-nocheck

type AdminAction = 'list' | 'create' | 'update' | 'reset-password' | 'set-active'

type AdminRequest = {
  action?: AdminAction
  payload?: Record<string, unknown>
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const allowedRoles = ['MAQUEIRO', 'ENFERMEIRA', 'COORDENADOR', 'ADMIN']
const adminRoles = ['COORDENADOR', 'ADMIN']

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  })
}

function cleanText(value: unknown) {
  return String(value || '').trim()
}

function cleanEmail(value: unknown) {
  return cleanText(value).toLowerCase()
}

function cleanRole(value: unknown) {
  return cleanText(value).toUpperCase()
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Erro inesperado ao gerenciar funcionários.'
}

function requireUuid(value: unknown, field = 'id') {
  const id = cleanText(value)
  if (!id) throw new Error(`Campo obrigatório: ${field}`)
  return id
}

function requirePassword(value: unknown) {
  const password = cleanText(value)
  if (password.length < 6) {
    throw new Error('A senha precisa ter pelo menos 6 caracteres.')
  }
  return password
}

async function readJsonSafe(response: Response) {
  const text = await response.text()

  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function serviceFetch(
  supabaseUrl: string,
  serviceRoleKey: string,
  path: string,
  options: RequestInit = {}
) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  })

  const data = await readJsonSafe(response)

  if (!response.ok) {
    const message =
      data?.message ||
      data?.msg ||
      data?.error_description ||
      data?.error ||
      data?.details ||
      data?.hint ||
      (typeof data === 'string' ? data : '') ||
      `Erro Supabase HTTP ${response.status}`

    throw new Error(String(message))
  }

  return data
}

async function getLoggedUser(
  supabaseUrl: string,
  anonKey: string,
  authorization: string
) {
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: 'GET',
    headers: {
      apikey: anonKey,
      Authorization: authorization
    }
  })

  const data = await readJsonSafe(response)

  if (!response.ok || !data?.id) {
    throw new Error('Sessão inválida. Faça login novamente.')
  }

  return data
}

async function getProfileById(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string
) {
  const profiles = await serviceFetch(
    supabaseUrl,
    serviceRoleKey,
    `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=*&limit=1`,
    {
      method: 'GET'
    }
  )

  if (!Array.isArray(profiles) || profiles.length === 0) {
    return null
  }

  return profiles[0]
}

async function listUsersByEmail(
  supabaseUrl: string,
  serviceRoleKey: string,
  email: string
) {
  let page = 1

  while (page <= 20) {
    const data = await serviceFetch(
      supabaseUrl,
      serviceRoleKey,
      `/auth/v1/admin/users?page=${page}&per_page=1000`,
      {
        method: 'GET'
      }
    )

    const users = data?.users || []

    const found = users.find((user: { email?: string }) => {
      return user.email?.toLowerCase() === email.toLowerCase()
    })

    if (found) return found

    if (users.length < 1000) return null

    page += 1
  }

  return null
}

function buildProfilePayload(userId: string, payload: Record<string, unknown>) {
  const fullName = cleanText(payload.full_name || payload.name)
  const email = cleanEmail(payload.email)
  const phone = cleanText(payload.phone)
  const role = cleanRole(payload.role || 'MAQUEIRO')
  const active = payload.active === undefined ? true : Boolean(payload.active)

  if (!fullName) throw new Error('Informe o nome completo.')
  if (!email || !email.includes('@')) throw new Error('Informe um e-mail válido.')
  if (!allowedRoles.includes(role)) throw new Error(`Cargo inválido: ${role}`)

  return {
    id: userId,
    full_name: fullName,
    name: fullName,
    email,
    phone,
    role,
    active,
    updated_at: new Date().toISOString()
  }
}

async function upsertProfile(
  supabaseUrl: string,
  serviceRoleKey: string,
  profilePayload: Record<string, unknown>
) {
  return await serviceFetch(
    supabaseUrl,
    serviceRoleKey,
    '/rest/v1/profiles?on_conflict=id',
    {
      method: 'POST',
      headers: {
        Prefer: 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify(profilePayload)
    }
  )
}

async function patchProfile(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  patch: Record<string, unknown>
) {
  return await serviceFetch(
    supabaseUrl,
    serviceRoleKey,
    `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      headers: {
        Prefer: 'return=representation'
      },
      body: JSON.stringify(patch)
    }
  )
}

async function createAuthUser(
  supabaseUrl: string,
  serviceRoleKey: string,
  payload: Record<string, unknown>
) {
  return await serviceFetch(
    supabaseUrl,
    serviceRoleKey,
    '/auth/v1/admin/users',
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  )
}

async function updateAuthUser(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  payload: Record<string, unknown>
) {
  return await serviceFetch(
    supabaseUrl,
    serviceRoleKey,
    `/auth/v1/admin/users/${encodeURIComponent(userId)}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload)
    }
  )
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Método não permitido.' }, 405)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return jsonResponse(
        {
          error:
            'Variáveis SUPABASE_URL, SUPABASE_ANON_KEY ou SUPABASE_SERVICE_ROLE_KEY não configuradas.'
        },
        500
      )
    }

    const authorization = req.headers.get('Authorization') || ''

    if (!authorization) {
      return jsonResponse({ error: 'Usuário não autenticado.' }, 401)
    }

    const loggedUser = await getLoggedUser(supabaseUrl, supabaseAnonKey, authorization)

    const coordinatorProfile = await getProfileById(
      supabaseUrl,
      serviceRoleKey,
      loggedUser.id
    )

    if (!coordinatorProfile?.active || !adminRoles.includes(coordinatorProfile.role)) {
      return jsonResponse(
        {
          error: 'Apenas COORDENADOR ou ADMIN pode gerenciar funcionários.'
        },
        403
      )
    }

    const body = (await req.json().catch(() => ({}))) as AdminRequest
    const action = body.action || 'list'
    const payload = body.payload || {}

    if (action === 'list') {
      const profiles = await serviceFetch(
        supabaseUrl,
        serviceRoleKey,
        '/rest/v1/profiles?select=*&order=name.asc.nullslast',
        {
          method: 'GET'
        }
      )

      const employees = Array.isArray(profiles)
        ? profiles.map((profile: Record<string, unknown>) => ({
            ...profile,
            full_name: profile.full_name || profile.name || ''
          }))
        : []

      return jsonResponse({ employees })
    }

    if (action === 'create') {
      const email = cleanEmail(payload.email)
      const password = requirePassword(payload.password)
      const fullName = cleanText(payload.full_name || payload.name)
      const phone = cleanText(payload.phone)
      const role = cleanRole(payload.role || 'MAQUEIRO')

      if (!fullName) throw new Error('Informe o nome completo.')
      if (!email || !email.includes('@')) throw new Error('Informe um e-mail válido.')
      if (!allowedRoles.includes(role)) throw new Error(`Cargo inválido: ${role}`)

      let userId = ''
      let userAlreadyExisted = false

      try {
        const created = await createAuthUser(supabaseUrl, serviceRoleKey, {
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: fullName,
            name: fullName,
            phone,
            role
          }
        })

        userId = created?.id || created?.user?.id

        if (!userId) {
          throw new Error('Usuário criado, mas o Auth não retornou o ID.')
        }
      } catch (createError) {
        const message = getErrorMessage(createError).toLowerCase()

        if (
          message.includes('already') ||
          message.includes('registered') ||
          message.includes('exists') ||
          message.includes('user already') ||
          message.includes('email address has already') ||
          message.includes('already been registered') ||
          message.includes('422')
        ) {
          const existingUser = await listUsersByEmail(
            supabaseUrl,
            serviceRoleKey,
            email
          )

          if (!existingUser?.id) {
            throw createError
          }

          userAlreadyExisted = true
          userId = existingUser.id

          await updateAuthUser(supabaseUrl, serviceRoleKey, userId, {
            password,
            email_confirm: true,
            user_metadata: {
              full_name: fullName,
              name: fullName,
              phone,
              role
            }
          })
        } else {
          throw createError
        }
      }

      const profilePayload = buildProfilePayload(userId, payload)

      await upsertProfile(supabaseUrl, serviceRoleKey, profilePayload)

      return jsonResponse({
        ok: true,
        id: userId,
        existed: userAlreadyExisted
      })
    }

    if (action === 'update') {
      const userId = requireUuid(payload.id)
      const profilePayload = buildProfilePayload(userId, payload)

      await updateAuthUser(supabaseUrl, serviceRoleKey, userId, {
        email: profilePayload.email,
        user_metadata: {
          full_name: profilePayload.full_name,
          name: profilePayload.name,
          phone: profilePayload.phone,
          role: profilePayload.role
        }
      })

      await upsertProfile(supabaseUrl, serviceRoleKey, profilePayload)

      return jsonResponse({
        ok: true,
        id: userId
      })
    }

    if (action === 'reset-password') {
      const userId = requireUuid(payload.id)
      const password = requirePassword(payload.password)

      await updateAuthUser(supabaseUrl, serviceRoleKey, userId, {
        password
      })

      return jsonResponse({
        ok: true,
        id: userId
      })
    }

    if (action === 'set-active') {
      const userId = requireUuid(payload.id)
      const active = Boolean(payload.active)

      if (userId === loggedUser.id && !active) {
        throw new Error('Você não pode desativar seu próprio usuário logado.')
      }

      await patchProfile(supabaseUrl, serviceRoleKey, userId, {
        active,
        updated_at: new Date().toISOString()
      })

      try {
        await updateAuthUser(supabaseUrl, serviceRoleKey, userId, {
          ban_duration: active ? 'none' : '876000h'
        })
      } catch (authError) {
        console.warn(
          'Não foi possível alterar ban_duration no Auth:',
          getErrorMessage(authError)
        )
      }

      return jsonResponse({
        ok: true,
        id: userId,
        active
      })
    }

    return jsonResponse(
      {
        error: `Ação inválida: ${action}`
      },
      400
    )
  } catch (error: unknown) {
    console.error(error)

    return jsonResponse(
      {
        error: getErrorMessage(error)
      },
      400
    )
  }
})