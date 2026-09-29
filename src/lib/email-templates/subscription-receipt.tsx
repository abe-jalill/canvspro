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
  Row,
  Column,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface ReceiptEmailProps {
  amount?: string
  plan?: string
  renewsOn?: string
  appUrl?: string
}

const ReceiptEmail = ({
  amount = '$2.99',
  plan = 'CanvasPro Monthly',
  renewsOn,
  appUrl = 'https://canvaspro.app',
}: ReceiptEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your CanvasPro subscription is active</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>CanvasPro</Text>
        <Heading style={h1}>Subscription confirmed</Heading>
        <Text style={text}>
          Thanks for subscribing. Every CanvasPro feature is unlocked on your account.
        </Text>
        <Hr style={hr} />
        <Row style={{ marginBottom: '8px' }}>
          <Column style={label}>Plan</Column>
          <Column style={value}>{plan}</Column>
        </Row>
        <Row style={{ marginBottom: '8px' }}>
          <Column style={label}>Amount</Column>
          <Column style={value}>{amount}</Column>
        </Row>
        {renewsOn ? (
          <Row>
            <Column style={label}>Renews</Column>
            <Column style={value}>{renewsOn}</Column>
          </Row>
        ) : null}
        <Hr style={hr} />
        <Button style={button} href={`${appUrl}/billing`}>
          Manage billing
        </Button>
        <Text style={muted}>
          You can cancel any time from the billing page in your account.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ReceiptEmail,
  subject: 'Your CanvasPro subscription is active',
  displayName: 'Subscription receipt',
  previewData: {
    amount: '$2.99',
    plan: 'CanvasPro Monthly',
    renewsOn: 'September 24, 2026',
    appUrl: 'https://canvaspro.app',
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
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
const label = { fontSize: '14px', color: '#6b7280', width: '110px' }
const value = { fontSize: '14px', color: '#0b0b0c', fontWeight: 600 }
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
const hr = { borderColor: '#e5e7eb', margin: '20px 0' }
const muted = { fontSize: '12px', lineHeight: '18px', color: '#6b7280', margin: '16px 0 0' }
