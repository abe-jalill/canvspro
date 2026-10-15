import * as React from 'react'
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

type Kind = 'trial' | 'renewal' | 'grace'

interface BillingReminderProps {
  kind?: Kind
  /** "Oct 28" */
  date?: string
  /** "$5.00/month" */
  price?: string
  appUrl?: string
}

const SUBJECTS: Record<Kind, string> = {
  trial: 'Your CoursePro free trial ends in 7 days',
  renewal: 'Your CoursePro yearly plan renews soon',
  grace: 'Your free CoursePro access ends in 3 days',
}

const BillingReminderEmail = ({
  kind = 'trial',
  date = '',
  price = '',
  appUrl = 'https://canvaspro.app',
}: BillingReminderProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{SUBJECTS[kind]}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>CoursePro</Text>
        {kind === 'trial' && (
          <>
            <Heading style={h1}>Your free trial ends {date}</Heading>
            <Text style={text}>
              On {date} your card will be charged {price} plus applicable tax, and your
              subscription will renew automatically until you cancel.
            </Text>
            <Text style={text}>
              Don't want to continue? Cancel before {date} in Settings → Billing and you won't be
              charged.
            </Text>
          </>
        )}
        {kind === 'renewal' && (
          <>
            <Heading style={h1}>Your yearly plan renews {date}</Heading>
            <Text style={text}>
              On {date} your card will be charged {price} plus applicable tax for another year of
              CoursePro.
            </Text>
            <Text style={text}>
              To stop it from renewing, cancel before {date} in Settings → Billing. You keep
              CoursePro until then.
            </Text>
          </>
        )}
        {kind === 'grace' && (
          <>
            <Heading style={h1}>Your free access ends {date}</Heading>
            <Text style={text}>
              CoursePro is now a paid app ({price}). Subscribe before {date} to keep your
              dashboard, reminders and widgets. Your first charge waits until your free days end.
            </Text>
          </>
        )}
        <Button style={button} href={`${appUrl}/settings/billing`}>
          {kind === 'grace' ? 'Subscribe' : 'Manage billing'}
        </Button>
        <Hr style={hr} />
        <Text style={muted}>
          You're receiving this because of your CoursePro subscription. Our order process is
          conducted by our online reseller Paddle.com, the Merchant of Record for all our orders.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BillingReminderEmail,
  subject: (data: Record<string, any>) => SUBJECTS[(data.kind as Kind) ?? 'trial'] ?? SUBJECTS.trial,
  displayName: 'Billing reminder',
  previewData: { kind: 'trial', date: 'Oct 28', price: '$5.00/month', appUrl: 'https://canvaspro.app' },
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
const button = {
  backgroundColor: '#0b0b0c',
  color: '#ffffff',
  borderRadius: '12px',
  fontSize: '15px',
  fontWeight: 600,
  padding: '12px 20px',
  textDecoration: 'none',
}
const hr = { borderColor: '#e5e7eb', margin: '28px 0 16px' }
const muted = { fontSize: '12px', lineHeight: '18px', color: '#6b7280', margin: 0 }
