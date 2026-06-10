"use client";

import AppLayout from "@/components/layout/AppLayout";
import LegalDocument, { LegalSection } from "@/components/legal/LegalDocument";
import { ui } from "@/lib/brandUi";

const LAST_UPDATED = "June 11, 2026";

const TermsPage = () => (
  <LegalDocument title="Terms of Service" lastUpdated={LAST_UPDATED}>
    <LegalSection title="1. Agreement">
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your access to and use of Clarwiz,
        an application owned and operated by ClarityHQ (&quot;we,&quot; &quot;us,&quot; or
        &quot;our&quot;), accessible via clarwiz.clarityhq.ai and clarityhq.ai (collectively,
        the &quot;Services&quot;). By accessing or using the Services, you agree to be bound
        by these Terms and our Privacy Policy.
      </p>
      <p>
        If you use the Services on behalf of a company or other legal entity, you represent
        that you have authority to bind that entity, and &quot;you&quot; refers to that
        entity.
      </p>
    </LegalSection>

    <LegalSection title="2. The Services">
      <p>
        ClarityHQ provides a business-to-business platform for campaign orchestration,
        prospect engagement, CRM synchronization, deal intelligence, and related growth
        execution workflows. Features may change over time, and we may add, modify, or
        discontinue functionality with reasonable notice where practicable.
      </p>
      <p>
        The Services may include AI-assisted recommendations, content generation, and
        automation. You are responsible for reviewing outputs and ensuring that your use
        complies with applicable law and your own policies.
      </p>
    </LegalSection>

    <LegalSection title="3. Accounts and Access">
      <p>
        You must provide accurate account information and keep your credentials secure. You
        are responsible for all activity under your account and for ensuring that users you
        authorize comply with these Terms.
      </p>
      <p>
        We may suspend or terminate access if we reasonably believe your account has been
        compromised, you have violated these Terms, or continued access poses risk to the
        Services or other users.
      </p>
    </LegalSection>

    <LegalSection title="4. Customer Data and Permissions">
      <p>
        You retain ownership of data, content, and materials you submit to the Services
        (&quot;Customer Data&quot;). You grant ClarityHQ a limited license to host, process,
        transmit, and display Customer Data solely to provide and improve the Services, as
        described in our Privacy Policy.
      </p>
      <p>
        You represent and warrant that you have all rights, consents, and legal bases
        necessary to collect, use, and share Customer Data through the Services, including
        prospect and contact information used in outreach campaigns.
      </p>
    </LegalSection>

    <LegalSection title="5. Acceptable Use">
      <p>You agree not to use the Services to:</p>
      <ul className="list-disc pl-5 space-y-2">
        <li>Violate any applicable law, regulation, or third-party rights;</li>
        <li>Send unlawful, deceptive, harassing, or unsolicited communications in violation of anti-spam, telemarketing, or privacy laws;</li>
        <li>Upload malware, attempt unauthorized access, or interfere with the integrity or performance of the Services;</li>
        <li>Reverse engineer or attempt to extract source code except where permitted by law;</li>
        <li>Use the Services to process sensitive personal data without appropriate safeguards and legal authority;</li>
        <li>Misrepresent your identity or affiliation, or impersonate another person or organization.</li>
      </ul>
      <p>
        You are solely responsible for the content of messages sent through the Services and
        for honoring opt-out, consent, and data subject requests applicable to your outreach.
      </p>
    </LegalSection>

    <LegalSection title="6. Third-Party Services">
      <p>
        The Services may integrate with third-party platforms such as CRMs, email providers,
        messaging channels, and calendar tools. Your use of those services is governed by
        their respective terms and policies. ClarityHQ is not responsible for third-party
        services and does not control their availability, security, or performance.
      </p>
    </LegalSection>

    <LegalSection title="7. Fees and Payment">
      <p>
        Paid plans, if applicable, are billed according to the pricing and order terms
        presented at purchase or in a separate agreement. Fees are non-refundable except
        where required by law or expressly stated otherwise. We may change pricing on
        reasonable notice for renewals or new subscriptions.
      </p>
      <p>
        Failure to pay applicable fees may result in suspension or termination of access to
        paid features.
      </p>
    </LegalSection>

    <LegalSection title="8. Intellectual Property">
      <p>
        ClarityHQ and its licensors own all rights, title, and interest in the Services,
        including software, branding, documentation, and underlying technology, excluding
        Customer Data. No rights are granted except as expressly set out in these Terms.
      </p>
      <p>
        You may provide feedback or suggestions about the Services. ClarityHQ may use such
        feedback without restriction or obligation to you.
      </p>
    </LegalSection>

    <LegalSection title="9. Confidentiality">
      <p>
        Each party may receive non-public information from the other. The receiving party
        will use reasonable care to protect confidential information and use it only for
        purposes related to the Services, except as required by law.
      </p>
    </LegalSection>

    <LegalSection title="10. Disclaimers">
      <p>
        THE SERVICES ARE PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE.&quot; TO THE
        MAXIMUM EXTENT PERMITTED BY LAW, CLARITYHQ DISCLAIMS ALL WARRANTIES, WHETHER
        EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS
        FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE
        SERVICES WILL BE UNINTERRUPTED, ERROR-FREE, OR THAT OUTCOMES SUCH AS LEADS,
        MEETINGS, OR REVENUE WILL BE ACHIEVED.
      </p>
    </LegalSection>

    <LegalSection title="11. Limitation of Liability">
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, CLARITYHQ AND ITS AFFILIATES, OFFICERS,
        EMPLOYEES, AND SUPPLIERS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
        CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR
        GOODWILL, ARISING OUT OF OR RELATED TO THE SERVICES OR THESE TERMS.
      </p>
      <p>
        CLARITYHQ&apos;S TOTAL LIABILITY FOR ALL CLAIMS ARISING OUT OF OR RELATED TO THE
        SERVICES OR THESE TERMS WILL NOT EXCEED THE GREATER OF (A) THE AMOUNTS PAID BY YOU
        TO CLARITYHQ FOR THE SERVICES IN THE TWELVE (12) MONTHS BEFORE THE EVENT GIVING RISE
        TO THE CLAIM, OR (B) ONE HUNDRED U.S. DOLLARS (USD $100).
      </p>
    </LegalSection>

    <LegalSection title="12. Indemnification">
      <p>
        You will defend, indemnify, and hold harmless ClarityHQ and its affiliates,
        officers, employees, and agents from claims, damages, losses, and expenses
        (including reasonable legal fees) arising from your Customer Data, your use of the
        Services, your outreach activities, or your violation of these Terms or applicable
        law.
      </p>
    </LegalSection>

    <LegalSection title="13. Term and Termination">
      <p>
        These Terms remain in effect while you use the Services. You may stop using the
        Services at any time. We may suspend or terminate access for material breach,
        non-payment, legal requirement, or prolonged inactivity, subject to applicable
        notice where reasonable.
      </p>
      <p>
        Upon termination, your right to access the Services ends. Sections that by their
        nature should survive termination will survive, including ownership, disclaimers,
        limitation of liability, and indemnification.
      </p>
    </LegalSection>

    <LegalSection title="14. Governing Law">
      <p>
        These Terms are governed by the laws of the State of Delaware, United States,
        without regard to conflict-of-law principles, except where mandatory local consumer
        protections apply. Exclusive jurisdiction for disputes arising under these Terms
        will lie in the state or federal courts located in Delaware, and you consent to
        personal jurisdiction in those courts.
      </p>
    </LegalSection>

    <LegalSection title="15. Changes to These Terms">
      <p>
        We may update these Terms from time to time. We will post the revised Terms on this
        page and update the &quot;Last updated&quot; date. Material changes may be
        communicated through the Services or by email. Continued use after changes become
        effective constitutes acceptance of the updated Terms.
      </p>
    </LegalSection>

    <LegalSection title="16. Contact">
      <p>Questions about these Terms may be sent to:</p>
      <p>
        <strong className="text-brand-ink">ClarityHQ</strong>
        <br />
        <a href="mailto:support@clarityhq.ai" className={ui.link}>
          support@clarityhq.ai
        </a>
      </p>
    </LegalSection>
  </LegalDocument>
);

export default AppLayout()(TermsPage);
