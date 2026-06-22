import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { to, subject, html } = body

    // 1. Get API Key and Sender Email from environment variables
    const apiKey = process.env.EMAIL_API_KEY
    const senderEmail = process.env.SENDER_EMAIL // e.g., "onboarding@resend.dev"

    if (!apiKey || !senderEmail) {
      return NextResponse.json(
        { error: "EMAIL_API_KEY and SENDER_EMAIL are not set in .env.local" },
        { status: 500 }
      )
    }

    // 2. Use native fetch to call the Resend API (Zero installations required)
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `BritLedger AI <${senderEmail}>`,
        to: [to],
        subject: subject,
        html: html
      })
    })

    const data = await response.json()

    if (!response.ok) {
      console.error("Email send error:", data)
      return NextResponse.json({ error: data.message || 'Failed to send' }, { status: response.status })
    }

    return NextResponse.json({ success: true, id: data.id })
  } catch (error: any) {
    console.error("Email send exception:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
