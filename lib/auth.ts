import jwt from 'jsonwebtoken'
import { NextRequest, NextResponse } from 'next/server'

const ACCESS_SECRET = process.env.JWT_SECRET!
const ACCESS_EXPIRES = '8h'

export interface AdminJwtPayload {
  sub: string   // 'admin'
  email: string
  role: 'admin'
  iat?: number
  exp?: number
}

export function signAdminToken(email: string): string {
  const payload: Omit<AdminJwtPayload, 'iat' | 'exp'> = {
    sub: 'admin',
    email,
    role: 'admin',
  }
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES })
}

export function verifyAdminToken(token: string): AdminJwtPayload {
  const payload = jwt.verify(token, ACCESS_SECRET) as AdminJwtPayload
  if (payload.role !== 'admin') throw new Error('Not an admin token')
  return payload
}

/** Extract and verify the admin Bearer token from the Authorization header */
export function adminAuthMiddleware(req: NextRequest): AdminJwtPayload | null {
  try {
    const authHeader = req.headers.get('authorization') || ''
    if (!authHeader.startsWith('Bearer ')) return null
    const token = authHeader.slice(7)
    return verifyAdminToken(token)
  } catch {
    return null
  }
}

/** Return 401 JSON response */
export function unauthorized(message = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 })
}
