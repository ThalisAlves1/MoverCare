<<<<<<< HEAD
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
=======
// @ts-nocheck
>>>>>>> 437ef73afeb0fe058c7b6523e68a4e3e147f3df4

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

<<<<<<< HEAD
=======
function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Erro inesperado ao gerenciar funcionários.'
}

>>>>>>> 437ef73afeb0fe058c7b6523e68a4e3e147f3df4
function requireUuid(value: unknown, field = 'id') {
  const id = cleanText(value)
  if (!id) throw new Error(`Campo obrigatório: ${field}`)
  return id
}

function requirePassword(value: unknown) {
  const password = cleanText(value)
<<<<<<< HEAD
  if (password.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.')
  return password
}

=======
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

>>>>>>> 437ef73afeb0fe058c7b6523e68a4e3e147f3df4
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

<<<<<<< HEAD
async function findUserByEmail(serviceClient: ReturnType<typeof createClient>, email: string) {
  let page = 1

  while (page <= 20) {
    const { data, error } = await serviceClient.auth.admin.listUsers({
      page,
      perPage: 1000
    })

    if (error) throw error

    const found = data?.users?.find((user) => user.email?.toLowerCase() === email.toLowerCase())
    if (found) return found

    if (!data?.users || data.users.length < 1000) return null
    page += 1
  }

  return null
}

Deno.serve(async (req) => {
=======
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
>>>>>>> 437ef73afeb0fe058c7b6523e68a4e3e147f3df4
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
<<<<<<< HEAD
      return jsonResponse({ error: 'Variáveis SUPABASE_URL, SUPABASE_ANON_KEY ou SUPABASE_SERVICE_ROLE_KEY não configuradas.' }, 500)
=======
      return jsonResponse(
        {
          error:
            'Variáveis SUPABASE_URL, SUPABASE_ANON_KEY ou SUPABASE_SERVICE_ROLE_KEY não configuradas.'
        },
        500
      )
>>>>>>> 437ef73afeb0fe058c7b6523e68a4e3e147f3df4
    }

    const authorization = req.headers.get('Authorization') || ''

    if (!authorization) {
      return jsonResponse({ error: 'Usuário não autenticado.' }, 401)
    }

<<<<<<< HEAD
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false }
    })

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })

    const { data: authData, error: userError } = await userClient.auth.getUser()

    if (userError || !authData?.user) {
      return jsonResponse({ error: 'Sessão inválida. Faça login novamente.' }, 401)
    }

    const { data: coordinatorProfile, error: coordinatorError } = await serviceClient
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle()

    if (coordinatorError) throw coordinatorError

    if (!coordinatorProfile?.active || !adminRoles.includes(coordinatorProfile.role)) {
      return jsonResponse({ error: 'Apenas COORDENADOR ou ADMIN pode gerenciar funcionários.' }, 403)
    }

    const body = await req.json().catch(() => ({})) as AdminRequest
=======
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
>>>>>>> 437ef73afeb0fe058c7b6523e68a4e3e147f3df4
    const action = body.action || 'list'
    const payload = body.payload || {}

    if (action === 'list') {
<<<<<<< HEAD
      const { data: profiles, error } = await serviceClient
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true, nullsFirst: false })

      if (error) throw error

      return jsonResponse({ employees: profiles || [] })
=======
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
>>>>>>> 437ef73afeb0fe058c7b6523e68a4e3e147f3df4
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

<<<<<<< HEAD
      const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
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

      if (createError) {
        const message = String(createError.message || '').toLowerCase()

        if (message.includes('already') || message.includes('registered') || message.includes('exists')) {
          const existingUser = await findUserByEmail(serviceClient, email)
          if (!existingUser?.id) throw createError
=======
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
>>>>>>> 437ef73afeb0fe058c7b6523e68a4e3e147f3df4

          userAlreadyExisted = true
          userId = existingUser.id

<<<<<<< HEAD
          const { error: updateAuthError } = await serviceClient.auth.admin.updateUserById(userId, {
=======
          await updateAuthUser(supabaseUrl, serviceRoleKey, userId, {
>>>>>>> 437ef73afeb0fe058c7b6523e68a4e3e147f3df4
            password,
            email_confirm: true,
            user_metadata: {
              full_name: fullName,
              name: fullName,
              phone,
              role
            }
          })
<<<<<<< HEAD

          if (updateAuthError) throw updateAuthError
        } else {
          throw createError
        }
      } else {
        userId = created.user.id
=======
        } else {
          throw createError
        }
>>>>>>> 437ef73afeb0fe058c7b6523e68a4e3e147f3df4
      }

      const profilePayload = buildProfilePayload(userId, payload)

<<<<<<< HEAD
      const { error: profileError } = await serviceClient
        .from('profiles')
        .upsert(profilePayload, { onConflict: 'id' })

      if (profileError) throw profileError

      return jsonResponse({ ok: true, id: userId, existed: userAlreadyExisted })
=======
      await upsertProfile(supabaseUrl, serviceRoleKey, profilePayload)

      return jsonResponse({
        ok: true,
        id: userId,
        existed: userAlreadyExisted
      })
>>>>>>> 437ef73afeb0fe058c7b6523e68a4e3e147f3df4
    }

    if (action === 'update') {
      const userId = requireUuid(payload.id)
      const profilePayload = buildProfilePayload(userId, payload)

<<<<<<< HEAD
      const { error: authError } = await serviceClient.auth.admin.updateUserById(userId, {
        email: profilePayload.email,
        user_metadata: {
          full_name: profilePayload.full_name,
          name: profilePayload.full_name,
=======
      await updateAuthUser(supabaseUrl, serviceRoleKey, userId, {
        email: profilePayload.email,
        user_metadata: {
          full_name: profilePayload.full_name,
          name: profilePayload.name,
>>>>>>> 437ef73afeb0fe058c7b6523e68a4e3e147f3df4
          phone: profilePayload.phone,
          role: profilePayload.role
        }
      })

<<<<<<< HEAD
      if (authError) throw authError

      const { error: profileError } = await serviceClient
        .from('profiles')
        .upsert(profilePayload, { onConflict: 'id' })

      if (profileError) throw profileError

      return jsonResponse({ ok: true, id: userId })
=======
      await upsertProfile(supabaseUrl, serviceRoleKey, profilePayload)

      return jsonResponse({
        ok: true,
        id: userId
      })
>>>>>>> 437ef73afeb0fe058c7b6523e68a4e3e147f3df4
    }

    if (action === 'reset-password') {
      const userId = requireUuid(payload.id)
      const password = requirePassword(payload.password)

<<<<<<< HEAD
      const { error } = await serviceClient.auth.admin.updateUserById(userId, {
        password
      })

      if (error) throw error

      return jsonResponse({ ok: true, id: userId })
=======
      await updateAuthUser(supabaseUrl, serviceRoleKey, userId, {
        password
      })

      return jsonResponse({
        ok: true,
        id: userId
      })
>>>>>>> 437ef73afeb0fe058c7b6523e68a4e3e147f3df4
    }

    if (action === 'set-active') {
      const userId = requireUuid(payload.id)
      const active = Boolean(payload.active)

<<<<<<< HEAD
      if (userId === authData.user.id && !active) {
        throw new Error('Você não pode desativar seu próprio usuário logado.')
      }

      const { error: profileError } = await serviceClient
        .from('profiles')
        .update({
          active,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (profileError) throw profileError

      const { error: authError } = await serviceClient.auth.admin.updateUserById(userId, {
        ban_duration: active ? 'none' : '876000h'
      })

      if (authError) {
        // Mantém o perfil alterado mesmo se a versão do Supabase não aceitar ban_duration.
        console.warn('Não foi possível alterar ban_duration no Auth:', authError.message)
      }

      return jsonResponse({ ok: true, id: userId, active })
    }

    return jsonResponse({ error: `Ação inválida: ${action}` }, 400)
  } catch (error) {
    console.error(error)
    return jsonResponse({ error: error?.message || 'Erro inesperado ao gerenciar funcionários.' }, 400)
  }
})
=======
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
>>>>>>> 437ef73afeb0fe058c7b6523e68a4e3e147f3df4
