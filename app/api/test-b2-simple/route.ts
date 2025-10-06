import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    // Credenciales limpias
    const keyId = "005c2b526be0baa0000000015"
    const key = "K005CI7AI3w7Zb6tEgLwluNmqYP0PUc"
    
    console.log('Testing B2 auth with clean credentials:', {
      keyId: keyId,
      key: key.substring(0, 10) + '...',
      keyIdLength: keyId.length,
      keyLength: key.length
    })

    // Autenticación simple
    const authString = `${keyId}:${key}`
    const authBase64 = Buffer.from(authString).toString('base64')
    
    console.log('Auth string:', authString)
    console.log('Auth base64:', authBase64.substring(0, 20) + '...')

    const response = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authBase64}`
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('B2 auth failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      })
      return NextResponse.json({ 
        error: `B2 auth failed: ${response.status} ${response.statusText}`,
        details: errorText
      }, { status: 500 })
    }

    const authData = await response.json()
    console.log('B2 auth successful:', authData)

    return NextResponse.json({
      success: true,
      message: 'B2 authentication successful',
      data: {
        apiUrl: authData.apiUrl,
        accountId: authData.accountId,
        authorizationToken: authData.authorizationToken ? 'present' : 'missing'
      }
    })

  } catch (error) {
    console.error('B2 test error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
