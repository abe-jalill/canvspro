import * as React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface WelcomeEmailProps {
  name?: string
  appUrl?: string
}

const WelcomeEmail = ({ name, appUrl = 'https://canvaspro.app' }: WelcomeEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Canvas dashboard is ready</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>CanvasPro</Text>
        <Heading style={h1}>Welcome{name ? `, ${name}` : ''}</Heading>
        <Text style={text}>
          CanvasPro brings your Canvas classes, grades, assignments, and announcements into one
          calm dashboard.
        </Text>
        <Section style={{ margin: '24px 0' }}>
          <Text style={step}>1. Add your Canvas API key in Settings</Text>
          <Text style={step}>2. Give each class a friendly name</Text>
          <Text style={step}>3. Choose which alerts you want and when</Text>
        </Section>
        <Button style={button} href={`${appUrl}/dashboard`}>
          Open my dashboard
        </Button>
        <Hr style={hr} />
        <Text style={muted}>
          You are receiving this because you created a CanvasPro account.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeEmail,
  subject: 'Welcome to CanvasPro',
  displayName: 'Welcome email',
  previewData: { name: 'Abrahim', appUrl: 'https://canvaspro.app' },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Helvetica, Arial, sans-serif',
}
const container = { padding: '32px 28px', maxWidth: '520px' }
const brand = {
  fontSize: '12px',
  letterSpacing: '0.18em',
  textTransform: 'uppercase' as const,
  color: '#6b7280',
  margin: '0 0 16px',
}
const h1 = { fontSize: '24px', fontWeight: 600, color: '#0b0b0c', margin: '0 0 12px' }
const text = { fontSize: '15px', lineHeight: '24px', color: '#26272b', margin: '0 0 12px' }
const step = { fontSize: '15px', lineHeight: '22px', color: '#26272b', margin: '0 0 8px' }
const button = {
  backgroundColor: '#0b0b0c',
  color: '#ffffff',
  borderRadius: '12px',
  fontSize: '15px',
  fontWeight: 600,
  padding: '12px 20px',
  textDecoration: 'none',
  display: 'inline-block',
}
const hr = { borderColor: '#e5e7eb', margin: '28px 0 16px' }
const muted = { fontSize: '12px', lineHeight: '18px', color: '#6b7280', margin: 0 }
