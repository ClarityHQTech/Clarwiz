"use client";

import AppLayout from "@/components/layout/AppLayout";
import LegalDocument, { LegalSection } from "@/components/legal/LegalDocument";
import { ui } from "@/lib/brandUi";

const LAST_UPDATED = "June 11, 2026";

const PrivacyPage = () => (
  <LegalDocument title="Privacy Policy" lastUpdated={LAST_UPDATED}>
    <LegalSection title="1. Introduction">
      <p>
        This Privacy Policy governs the data collection and usage practices of Clarwiz, an
        application owned and operated by ClarityHQ (&quot;we,&quot; &quot;us,&quot; or
        &quot;our&quot;), accessible via clarwiz.clarityhq.ai and clarityhq.ai (collectively,
        the &quot;Services&quot;). It explains how we collect, use, disclose, and protect
        information when you access or use the Services, including when you sign in,
        configure campaigns, connect integrations, or interact with prospects through the
        platform.
      </p>
      <p>
        By using the Services, you agree to the collection and use of information in
        accordance with this policy. If you do not agree, please do not use the Services.
      </p>
    </LegalSection>

    <LegalSection title="2. Information We Collect">
      <p>
        <strong className="text-brand-ink">Account and profile information.</strong> When you
        create an account or sign in (for example, via Google OAuth), we collect your name,
        email address, profile image, and workspace or tenant affiliation.
      </p>
      <p>
        <strong className="text-brand-ink">Business and campaign data.</strong> You and your
        team may upload or sync prospect lists, company records, ideal customer profile
        (ICP) settings, campaign configurations, message templates, communication logs,
        deal data, and other content needed to run outreach and sales workflows.
      </p>
      <p>
        <strong className="text-brand-ink">Integration data.</strong> If you connect third-party
        services such as HubSpot, Gmail, LinkedIn, WhatsApp providers, email delivery
        platforms, or calendar tools, we receive and store data authorized by you through
        those integrations, including contacts, deals, emails, meeting activity, and
        engagement signals.
      </p>
      <p>
        <strong className="text-brand-ink">Usage and technical data.</strong> We automatically
        collect information about how you use the Services, including log data, device and
        browser type, IP address, pages viewed, feature usage, timestamps, and error
        reports.
      </p>
      <p>
        <strong className="text-brand-ink">Communications.</strong> If you contact us for
        support, sales, or other inquiries, we collect the information you provide in
        those communications.
      </p>
    </LegalSection>

    <LegalSection title="3. How We Use Information">
      <p>We use the information we collect to:</p>
      <ul className="list-disc pl-5 space-y-2">
        <li>Provide, operate, maintain, and improve the Services;</li>
        <li>Authenticate users and manage workspaces, roles, and permissions;</li>
        <li>Execute outreach campaigns and sync data with connected CRM and messaging tools;</li>
        <li>Generate insights, scoring, recommendations, and AI-assisted content within your workspace;</li>
        <li>Monitor performance, troubleshoot issues, and protect against fraud or abuse;</li>
        <li>Communicate with you about the Services, including updates, security notices, and support;</li>
        <li>Comply with legal obligations and enforce our Terms of Service.</li>
      </ul>
    </LegalSection>

    <LegalSection title="4. Legal Bases for Processing (EEA/UK)">
      <p>
        Where applicable, we process personal data on the basis of: (a) performance of a
        contract with you or your organization; (b) legitimate interests in operating and
        improving the Services, provided those interests are not overridden by your rights;
        (c) your consent, where required; and (d) compliance with legal obligations.
      </p>
    </LegalSection>

    <LegalSection title="5. How We Share Information">
      <p>We do not sell your personal information. We may share information:</p>
      <ul className="list-disc pl-5 space-y-2">
        <li>
          <strong className="text-brand-ink">With service providers</strong> who help us
          host infrastructure, deliver email or messages, provide analytics, process
          payments, or support integrations—subject to contractual confidentiality and
          security obligations;
        </li>
        <li>
          <strong className="text-brand-ink">With connected platforms</strong> at your
          direction when you enable integrations or send communications through the
          Services;
        </li>
        <li>
          <strong className="text-brand-ink">Within your organization</strong> according to
          workspace permissions you or your administrators configure;
        </li>
        <li>
          <strong className="text-brand-ink">For legal reasons</strong> if required by law,
          regulation, legal process, or governmental request, or to protect the rights,
          property, or safety of ClarityHQ, our users, or others;
        </li>
        <li>
          <strong className="text-brand-ink">In connection with a business transaction</strong>{" "}
          such as a merger, acquisition, financing, or sale of assets, subject to
          appropriate confidentiality protections.
        </li>
      </ul>
    </LegalSection>

    <LegalSection title="6. Data Retention">
      <p>
        We retain information for as long as necessary to provide the Services, fulfill the
        purposes described in this policy, comply with legal obligations, resolve disputes,
        and enforce agreements. Retention periods may vary based on data type, workspace
        settings, and applicable law. You may request deletion of certain data as described
        below, subject to legitimate business or legal retention needs.
      </p>
    </LegalSection>

    <LegalSection title="7. Security">
      <p>
        We implement administrative, technical, and organizational measures designed to
        protect information against unauthorized access, loss, misuse, or alteration.
        However, no method of transmission or storage is completely secure, and we cannot
        guarantee absolute security.
      </p>
    </LegalSection>

    <LegalSection title="8. Your Rights and Choices">
      <p>
        Depending on your location, you may have rights to access, correct, delete, restrict,
        or port your personal data, and to object to or withdraw consent for certain
        processing. You may also have the right to lodge a complaint with a supervisory
        authority.
      </p>
      <p>
        To exercise these rights, contact us at{" "}
        <a href="mailto:support@clarityhq.ai" className={ui.link}>
          support@clarityhq.ai
        </a>
        . We may need to verify your identity before responding. If you are an end
        prospect contacted through a customer&apos;s campaign, please contact that customer
        directly; ClarityHQ typically processes such data on behalf of our business
        customers.
      </p>
    </LegalSection>

    <LegalSection title="9. International Transfers">
      <p>
        ClarityHQ may process and store information in countries other than where you are
        located. Where required, we use appropriate safeguards for cross-border transfers
        of personal data.
      </p>
    </LegalSection>

    <LegalSection title="10. Children">
      <p>
        The Services are intended for business use and are not directed to individuals under
        16. We do not knowingly collect personal information from children.
      </p>
    </LegalSection>

    <LegalSection title="11. Changes to This Policy">
      <p>
        We may update this Privacy Policy from time to time. We will post the revised policy
        on this page and update the &quot;Last updated&quot; date. Material changes may be
        communicated through the Services or by email where appropriate. Continued use after
        changes become effective constitutes acceptance of the updated policy.
      </p>
    </LegalSection>

    <LegalSection title="12. Contact Us">
      <p>
        Questions about this Privacy Policy or our data practices may be sent to:
      </p>
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

export default AppLayout()(PrivacyPage);
