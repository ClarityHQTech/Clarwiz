'use client'

import AppLayout from '@/components/layout/AppLayout'
import BrandLockup from '@/components/brand/BrandLockup'
import { BRAND, ui } from '@/lib/brandUi'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import {
  FaEnvelope,
  FaLinkedin,
  FaPhone,
  FaWhatsapp,
} from 'react-icons/fa6'
import { HiArrowRight } from 'react-icons/hi2'

const channels = [
  {
    icon: FaEnvelope,
    title: 'Email',
    description:
      'Multi-step sequences with unified brand context at every touchpoint.',
  },
  {
    icon: FaLinkedin,
    title: 'LinkedIn',
    description:
      'Connect and nurture prospects with human-led, intelligence-backed outreach.',
  },
  {
    icon: FaWhatsapp,
    title: 'WhatsApp',
    description:
      'Reach decision-makers on the channel they actually use—with approval at every gate.',
  },
  {
    icon: FaPhone,
    title: 'AI Calling',
    description:
      'Human Agent calls that qualify leads and book meetings—not set-and-forget automation.',
  },
]

const steps = [
  {
    step: '01',
    title: 'Define your ICP',
    description:
      'Industry, roles, geography, and tone—stored as unified brand context for your workspace.',
  },
  {
    step: '02',
    title: 'Import enriched prospects',
    description:
      'Upload your account book with email, phone, LinkedIn, and WhatsApp data.',
  },
  {
    step: '03',
    title: 'Launch growth execution',
    description:
      'Configure stages, channels, and templates—then run campaigns with intelligence cohesion.',
  },
]

const values = [
  'Intelligence over intuition',
  'Human-led, AI-powered',
  'Execution accountability',
]

const faqs = [
  {
    q: `What is ${BRAND.productName}?`,
    a: `${BRAND.lockup} is a human-first outreach engine for ambitious D2C brands and agencies—powered by a living Brand Intelligence Layer. Run qualified lead campaigns across email, LinkedIn, WhatsApp, and AI calling from one source of truth.`,
  },
  {
    q: 'Who is it for?',
    a: 'CMOs, founders, and modern marketing agencies who need structured, multi-channel outreach with enriched prospect data—powered by a living Brand Intelligence Layer, not fragmented tools.',
  },
  {
    q: 'How do I get started?',
    a: 'Sign in with Google, set up your ICP and prospect list, then create your first campaign from the dashboard.',
  },
]

const Page = () => {
  const handleGetStarted = () => {
    signIn('google', { callbackUrl: '/dashboard' })
  }

  return (
    <main className="text-brand-ink bg-brand-bg">
      {/* Mobile header brand — fixed so it sits above hero content; hidden lg+ (desktop uses Header) */}
      <div className="fixed top-6 left-4 z-40 max-w-[calc(100%-5.5rem)] lg:hidden">
        <Link href="/" className="flex items-center gap-2 min-w-0">
          <img className="h-8 w-8 shrink-0" src="/logo.svg" alt={BRAND.lockup} />
          <BrandLockup
            productClassName="font-serif font-semibold text-base text-brand-ink leading-tight"
            parentClassName="block text-[10px] text-brand-stone font-sans leading-tight"
          />
        </Link>
      </div>

      {/* Hero */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden bg-brand-bg pt-14 lg:pt-28">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-brand-sage/25 blur-3xl" />
          <div className="absolute bottom-0 -left-24 h-80 w-80 rounded-full bg-brand-terracotta/20 blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 py-16 lg:py-24 w-full">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-secondary/40 bg-brand-surface/90 text-brand-stone px-4 py-1.5 text-sm font-medium mb-6">
              Human-led · AI-enabled growth execution
            </span>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-brand-ink leading-[1.1]">
              Turn brand intelligence into{' '}
              <span className="text-brand-gold">qualified pipeline</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-brand-stone max-w-2xl leading-relaxed">
              {BRAND.lockup} builds living Brand Intelligence Layers from your
              assets and signals—then powers campaigns, creative, and growth execution
              for ambitious D2C brands and agencies.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {values.map((v) => (
                <li
                  key={v}
                  className="text-xs font-medium text-brand-ink bg-brand-sage/20 border border-brand-sage/30 rounded-full px-3 py-1"
                >
                  {v}
                </li>
              ))}
            </ul>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleGetStarted}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-dark px-8 py-3.5 text-white font-semibold hover:bg-brand-ink transition-colors shadow-sm"
              >
                Get started
                <HiArrowRight className="h-5 w-5" />
              </button>
              <Link
                href="/dashboard"
                className={`${ui.btnSecondarySurface} px-8 py-3.5 font-semibold`}
              >
                View dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Channels */}
      <section className="py-20 bg-brand-surface border-y border-brand-secondary/20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-brand-ink">
              One engine, every channel
            </h2>
            <p className="mt-4 text-brand-stone">
              Orchestrate outreach where your buyers are—with intelligence cohesion
              across email, social, and voice.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {channels.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="rounded-xl border border-brand-secondary/30 bg-brand-bg/60 p-6 hover:border-brand-sage/50 hover:shadow-md transition-all"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-dark text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-brand-ink">{title}</h3>
                <p className="mt-2 text-sm text-brand-stone leading-relaxed">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-brand-bg">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-brand-ink">
              How it works
            </h2>
            <p className="mt-4 text-brand-stone">
              From ICP to live campaigns in three steps—with execution accountability
              at every stage.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map(({ step, title, description }) => (
              <div key={step} className="relative">
                <span className="font-serif text-5xl font-semibold text-brand-sage/50">
                  {step}
                </span>
                <h3 className="mt-2 text-xl font-semibold text-brand-ink">{title}</h3>
                <p className="mt-3 text-brand-stone leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="rounded-2xl bg-brand-dark px-8 py-14 sm:px-14 text-center text-white border border-brand-ink/20">
            <p className="text-brand-gold text-sm font-medium tracking-wide uppercase mb-3">
              Premium growth execution
            </p>
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold">
              Ready to run your next campaign?
            </h2>
            <p className="mt-4 text-brand-secondary max-w-xl mx-auto">
              Sign in, upload your prospect book, and launch coordinated outreach
              designed to improve operational throughput—not generic promises.
            </p>
            <button
              onClick={handleGetStarted}
              className="mt-8 inline-flex items-center gap-2 rounded-lg bg-brand-bg text-brand-ink px-8 py-3.5 font-semibold hover:bg-brand-surface transition-colors"
            >
              Start with Google
              <HiArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 bg-brand-surface border-t border-brand-secondary/20 scroll-mt-24">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-brand-ink text-center mb-12">
            Frequently asked questions
          </h2>
          <div className="space-y-6">
            {faqs.map(({ q, a }) => (
              <div
                key={q}
                className="rounded-xl bg-brand-bg/70 border border-brand-secondary/30 p-6"
              >
                <h3 className="text-lg font-semibold text-brand-ink">{q}</h3>
                <p className="mt-3 text-brand-stone leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}

export default AppLayout()(Page)
