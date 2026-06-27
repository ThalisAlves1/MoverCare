import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

function requireUuid(value: unknown, field = 'id') {
  const id = cleanText(value)
  if (!id) throw new Error(`Campo obrigatório: ${field}`)
  return id
}

function requirePassword(value: unknown) {
  const password = cleanText(value)
  if (password.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.')
  return password
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
      return jsonResponse({ error: 'Variáveis SUPABASE_URL, SUPABASE_ANON_KEY ou SUPABASE_SERVICE_ROLE_KEY não configuradas.' }, 500)
    }

    const authorization = req.headers.get('Authorization') || ''

    if (!authorization) {
      return jsonResponse({ error: 'Usuário não autenticado.' }, 401)
    }

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
    const action = body.action || 'list'
    const payload = body.payload || {}

    if (action === 'list') {
      const { data: profiles, error } = await serviceClient
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true, nullsFirst: false })

      if (error) throw error

      return jsonResponse({ employees: profiles || [] })
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

          userAlreadyExisted = true
          userId = existingUser.id

          const { error: updateAuthError } = await serviceClient.auth.admin.updateUserById(userId, {
            password,
            email_confirm: true,
            user_metadata: {
              full_name: fullName,
              name: fullName,
              phone,
              role
            }
          })

          if (updateAuthError) throw updateAuthError
        } else {
          throw createError
        }
      } else {
        userId = created.user.id
      }

      const profilePayload = buildProfilePayload(userId, payload)

      const { error: profileError } = await serviceClient
        .from('profiles')
        .upsert(profilePayload, { onConflict: 'id' })

      if (profileError) throw profileError

      return jsonResponse({ ok: true, id: userId, existed: userAlreadyExisted })
    }

    if (action === 'update') {
      const userId = requireUuid(payload.id)
      const profilePayload = buildProfilePayload(userId, payload)

      const { error: authError } = await serviceClient.auth.admin.updateUserById(userId, {
        email: profilePayload.email,
        user_metadata: {
          full_name: profilePayload.full_name,
          name: profilePayload.full_name,
          phone: profilePayload.phone,
          role: profilePayload.role
        }
      })

      if (authError) throw authError

      const { error: profileError } = await serviceClient
        .from('profiles')
        .upsert(profilePayload, { onConflict: 'id' })

      if (profileError) throw profileError

      return jsonResponse({ ok: true, id: userId })
    }

    if (action === 'reset-password') {
      const userId = requireUuid(payload.id)
      const password = requirePassword(payload.password)

      const { error } = await serviceClient.auth.admin.updateUserById(userId, {
        password
      })

      if (error) throw error

      return jsonResponse({ ok: true, id: userId })
    }

    if (action === 'set-active') {
      const userId = requireUuid(payload.id)
      const active = Boolean(payload.active)

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
