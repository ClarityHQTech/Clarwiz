'use client'

import AppLayout from '@/components/layout/AppLayout'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import {
  FaEnvelope,
  FaLinkedin,
  FaPhone,
  FaWhatsapp,
} from 'react-icons/fa6'
import { HiArrowRight, HiSparkles } from 'react-icons/hi2'

const channels = [
  {
    icon: FaEnvelope,
    title: 'Email',
    description: 'Multi-step sequences with Smartlead and Maildoso integration.',
  },
  {
    icon: FaLinkedin,
    title: 'LinkedIn',
    description: 'Connect and nurture prospects on LinkedIn at scale.',
  },
  {
    icon: FaWhatsapp,
    title: 'WhatsApp',
    description: 'Reach decision-makers on the channel they actually use.',
  },
  {
    icon: FaPhone,
    title: 'AI Calling',
    description: 'AI SDR calls that qualify leads and book meetings.',
  },
]

const steps = [
  {
    step: '01',
    title: 'Define your ICP',
    description: 'Industry, roles, geography, pain points, and tone — stored per tenant.',
  },
  {
    step: '02',
    title: 'Import enriched prospects',
    description: 'Upload your account book with email, phone, LinkedIn, and WhatsApp data.',
  },
  {
    step: '03',
    title: 'Launch campaigns',
    description: 'Configure stages, channels, and templates — then let ClarWiz run outreach.',
  },
]

const faqs = [
  {
    q: 'What is ClarWiz?',
    a: 'ClarWiz is an intelligent B2B outreach engine. It helps you run qualified lead campaigns across email, LinkedIn, WhatsApp, and AI calling from one place.',
  },
  {
    q: 'Who is it for?',
    a: 'Sales and GTM teams that need structured, multi-channel outreach with enriched prospect data and campaign templates.',
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
    <main className="text-gray-800">
      {/* Hero */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden bg-gradient-to-br from-sky-50 via-white to-cyan-50 pt-24 lg:pt-28">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-sky-200/40 blur-3xl" />
          <div className="absolute bottom-0 -left-24 h-80 w-80 rounded-full bg-cyan-200/40 blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 py-16 lg:py-24 w-full">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-sky-100 text-sky-800 px-4 py-1.5 text-sm font-medium mb-6">
              <HiSparkles className="h-4 w-4" />
              Intelligent B2B outreach
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 leading-[1.1]">
              Turn enriched prospects into{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-700 to-cyan-600">
                qualified pipeline
              </span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl leading-relaxed">
              ClarWiz runs multi-channel GTM campaigns — email, LinkedIn, WhatsApp, and AI calls — so your team spends less time on tooling and more time closing.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleGetStarted}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-sky-700 to-cyan-600 px-8 py-3.5 text-white font-semibold shadow-lg shadow-sky-500/25 hover:from-sky-800 hover:to-cyan-700 transition-all"
              >
                Get started free
                <HiArrowRight className="h-5 w-5" />
              </button>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-8 py-3.5 font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                View dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Channels */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              One engine, every channel
            </h2>
            <p className="mt-4 text-gray-600">
              Orchestrate outreach where your buyers are — without juggling separate tools.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {channels.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="rounded-2xl border border-gray-100 bg-gray-50/50 p-6 hover:border-sky-200 hover:shadow-md transition-all"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-600 to-cyan-500 text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">{title}</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">How it works</h2>
            <p className="mt-4 text-gray-600">
              From ICP to live campaigns in three steps.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map(({ step, title, description }) => (
              <div key={step} className="relative">
                <span className="text-5xl font-bold text-sky-100">{step}</span>
                <h3 className="mt-2 text-xl font-semibold text-gray-900">{title}</h3>
                <p className="mt-3 text-gray-600 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="rounded-3xl bg-gradient-to-r from-sky-800 to-cyan-700 px-8 py-14 sm:px-14 text-center text-white">
            <h2 className="text-2xl sm:text-3xl font-bold">Ready to run your next campaign?</h2>
            <p className="mt-4 text-sky-100 max-w-xl mx-auto">
              Sign in, upload your prospect book, and launch coordinated outreach across every channel.
            </p>
            <button
              onClick={handleGetStarted}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-white text-sky-800 px-8 py-3.5 font-semibold hover:bg-sky-50 transition-colors"
            >
              Start with Google
              <HiArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 bg-gray-50 scroll-mt-24">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 text-center mb-12">
            Frequently asked questions
          </h2>
          <div className="space-y-6">
            {faqs.map(({ q, a }) => (
              <div
                key={q}
                className="rounded-2xl bg-white border border-gray-100 p-6 shadow-sm"
              >
                <h3 className="text-lg font-semibold text-gray-900">{q}</h3>
                <p className="mt-3 text-gray-600 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}

export default AppLayout()(Page)
