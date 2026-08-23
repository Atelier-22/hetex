export default function TermsPage() {
  return (
    <div className="h-full overflow-y-auto px-6 py-10 md:px-12">
      <div className="mx-auto max-w-2xl text-sm leading-relaxed text-[var(--text-secondary)]">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
          Hetex AI — Terms and Conditions
        </h1>
        <p className="mt-2 text-xs">Last Updated: August 10, 2026</p>

        <p className="mt-6">
          Welcome to <strong>Hetex AI</strong>. These Terms and Conditions
          ("Terms") govern your access to and use of Hetex AI, including our
          website, applications, AI models, APIs, tools, features, and
          related services (collectively, the "Service").
        </p>
        <p className="mt-4">
          By creating an account, accessing, or using Hetex AI, you agree to
          these Terms. If you do not agree with these Terms, you must not use
          the Service.
        </p>

        <Section title="1. About Hetex AI">
          <p>
            Hetex AI is an artificial intelligence platform designed to help
            users obtain information, generate and analyze content, solve
            problems, write and understand code, conduct research, and
            perform other tasks supported by the Service.
          </p>
          <p className="mt-2">
            Hetex AI may use artificial intelligence models and third-party
            technologies to generate responses.
          </p>
          <p className="mt-2">
            AI-generated responses may contain mistakes, omissions, outdated
            information, or inaccurate conclusions. You are responsible for
            evaluating information before relying on it.
          </p>
        </Section>

        <Section title="2. Eligibility">
          <p>
            You must be legally capable of entering into these Terms to use
            Hetex AI.
          </p>
          <p className="mt-2">
            If you are under the minimum legal age required in your country
            to use an AI service independently, you may only use Hetex AI
            with appropriate parental or guardian involvement where required
            by applicable law.
          </p>
          <p className="mt-2">
            You are responsible for ensuring that your use of Hetex AI
            complies with the laws applicable to you.
          </p>
        </Section>

        <Section title="3. Your Hetex AI Account">
          <p>Certain features may require you to create an account.</p>
          <p className="mt-2">You agree to:</p>
          <List
            items={[
              "Provide accurate and current information.",
              "Keep your login credentials secure.",
              "Not share your account in a manner that violates your subscription or account limitations.",
              "Immediately notify Hetex AI if you believe your account has been compromised.",
              "Accept responsibility for activity occurring through your account unless caused by a security failure attributable to Hetex AI.",
            ]}
          />
          <p className="mt-2">
            You must not create accounts for fraudulent or abusive purposes.
          </p>
        </Section>

        <Section title="4. Using Hetex AI">
          <p>
            You may use Hetex AI only for lawful purposes and in accordance
            with these Terms.
          </p>
          <p className="mt-2">You must not use Hetex AI to:</p>
          <List
            items={[
              "Violate applicable laws or regulations.",
              "Defraud, deceive, impersonate, or harm another person.",
              "Attempt to gain unauthorized access to computer systems, accounts, networks, or data.",
              "Distribute malware, ransomware, viruses, or other malicious software.",
              "Conduct phishing, credential theft, or other cybercrime.",
              "Generate content intended to facilitate serious wrongdoing.",
              "Harass, threaten, or deliberately intimidate others.",
              "Circumvent security, access controls, usage limits, or technical restrictions.",
              "Interfere with or disrupt Hetex AI's infrastructure.",
              "Reverse engineer, decompile, or attempt to extract proprietary components of Hetex AI except where permitted by applicable law.",
              "Use automated systems to abuse, overload, scrape, or excessively access the Service.",
              "Use Hetex AI to create or distribute content that violates applicable law.",
            ]}
          />
          <p className="mt-2">
            Hetex AI may restrict or refuse requests that present significant
            safety, security, legal, or abuse risks.
          </p>
        </Section>

        <Section title="5. AI-Generated Information">
          <p>
            Hetex AI uses artificial intelligence and does not guarantee that
            every response will be correct.
          </p>
          <p className="mt-2">AI responses may:</p>
          <List
            items={[
              "Contain factual errors.",
              "Misinterpret your question.",
              "Provide incomplete information.",
              "Present outdated information.",
              "Incorrectly cite or describe information.",
              "Produce code containing bugs or security vulnerabilities.",
              "Generate recommendations that are unsuitable for your circumstances.",
            ]}
          />
          <p className="mt-2">
            You should independently verify important information.
          </p>
          <p className="mt-2 font-medium text-[var(--text-primary)]">
            Do not rely solely on Hetex AI for medical, legal, financial,
            emergency, safety-critical, or other high-stakes decisions.
          </p>
          <p className="mt-2">
            Where appropriate, consult a qualified professional or
            authoritative source.
          </p>
        </Section>

        <Section title="6. Important Decisions">
          <p>
            Hetex AI is intended to assist users, not replace professional
            judgment.
          </p>
          <p className="mt-2">
            You remain responsible for decisions you make based on
            information generated by the Service.
          </p>
          <p className="mt-2">
            For example, Hetex AI should not be treated as a substitute for:
          </p>
          <List
            items={[
              "A licensed doctor or healthcare professional.",
              "A lawyer or legal professional.",
              "A financial adviser.",
              "A qualified engineer.",
              "An emergency service.",
              "A cybersecurity professional.",
              "Any other appropriately qualified professional.",
            ]}
          />
        </Section>

        <Section title="7. User Content">
          <p>
            You may provide prompts, text, files, images, code, documents, or
            other information to Hetex AI ("User Content").
          </p>
          <p className="mt-2">
            You retain whatever ownership rights you have in your User
            Content.
          </p>
          <p className="mt-2">
            You are responsible for ensuring that you have the necessary
            rights and permissions to submit User Content to Hetex AI.
          </p>
          <p className="mt-2">
            You must not submit content that you are prohibited from sharing
            under law, contract, confidentiality obligations, or other
            applicable restrictions.
          </p>
        </Section>

        <Section title="8. Use of User Content">
          <p>To provide the Service, Hetex AI may need to process User Content.</p>
          <p className="mt-2">
            Depending on the features you use, your content may be processed
            by Hetex AI's infrastructure and by third-party technology
            providers that help operate the Service.
          </p>
          <p className="mt-2">
            Hetex AI will handle personal information according to its
            Privacy Policy.
          </p>
          <p className="mt-2">
            Users should avoid submitting highly sensitive information unless
            the relevant Hetex AI feature specifically supports such
            information.
          </p>
        </Section>

        <Section title="9. Privacy">
          <p>Your privacy is important to us.</p>
          <p className="mt-2">Our Privacy Policy explains:</p>
          <List
            items={[
              "What information we collect.",
              "How we use information.",
              "How information may be stored.",
              "How information may be shared.",
              "How long information may be retained.",
              "Your available privacy rights and controls.",
            ]}
          />
          <p className="mt-2">
            The Privacy Policy forms part of your relationship with Hetex AI.
          </p>
        </Section>

        <Section title="10. Intellectual Property">
          <p>
            The Hetex AI name, logo, website, software, interface, branding,
            underlying technology, and other proprietary components of the
            Service are owned by Hetex AI or its licensors unless otherwise
            stated.
          </p>
          <p className="mt-2">
            You may not copy, reproduce, distribute, modify, sell, or
            commercially exploit Hetex AI's proprietary materials without
            authorization.
          </p>
          <p className="mt-2">
            You retain ownership of content you independently own and submit
            to the Service.
          </p>
          <p className="mt-2">
            To the extent permitted by applicable law and subject to
            third-party rights, you may generally use outputs generated for
            you by Hetex AI.
          </p>
          <p className="mt-2">
            However, because AI-generated content may not be unique, Hetex AI
            does not guarantee that an output is exclusive to you.
          </p>
        </Section>

        <Section title="11. Third-Party Services">
          <p>
            Hetex AI may integrate with or rely on third-party services,
            including cloud providers, AI model providers, payment
            processors, search providers, analytics services, authentication
            services, and other technology providers.
          </p>
          <p className="mt-2">
            Third-party services may have their own terms and privacy
            policies.
          </p>
          <p className="mt-2">
            Hetex AI is not responsible for independent third-party services
            outside its control.
          </p>
        </Section>

        <Section title="12. External Information and Links">
          <p>
            Hetex AI may provide information obtained from external sources
            or direct you to third-party websites.
          </p>
          <p className="mt-2">
            We do not guarantee the accuracy, availability, security, or
            reliability of third-party websites or information.
          </p>
          <p className="mt-2">
            You access third-party services at your own risk.
          </p>
        </Section>

        <Section title="13. Subscriptions and Payments">
          <p>
            Some Hetex AI features may be provided free of charge while
            others may require payment or a subscription.
          </p>
          <p className="mt-2">
            Where applicable, prices, billing periods, usage limits, and
            other subscription conditions will be displayed before purchase.
          </p>
          <p className="mt-2">
            Paid subscriptions may automatically renew if automatic renewal
            is enabled.
          </p>
          <p className="mt-2">
            You authorize Hetex AI or its payment provider to charge the
            applicable payment method for recurring fees where you have
            agreed to recurring billing.
          </p>
          <p className="mt-2">
            We may change prices in the future. Where required by applicable
            law, we will provide appropriate notice before material changes
            take effect.
          </p>
        </Section>

        <Section title="14. Refunds">
          <p>
            Refund eligibility depends on the applicable subscription,
            purchase terms, payment provider requirements, and applicable
            law.
          </p>
          <p className="mt-2">
            Where a refund policy applies, Hetex AI will communicate the
            relevant conditions at the time of purchase or through its
            applicable billing policy.
          </p>
          <p className="mt-2">
            Nothing in these Terms removes rights that cannot legally be
            excluded under applicable consumer-protection laws.
          </p>
        </Section>

        <Section title="15. Service Availability">
          <p>
            We aim to keep Hetex AI available and reliable, but we do not
            guarantee uninterrupted access.
          </p>
          <p className="mt-2">
            The Service may occasionally be unavailable because of:
          </p>
          <List
            items={[
              "Maintenance.",
              "Software updates.",
              "Security incidents.",
              "Infrastructure failures.",
              "Internet or network problems.",
              "Third-party service failures.",
              "Excessive demand.",
              "Events outside our reasonable control.",
            ]}
          />
          <p className="mt-2">
            We may modify, suspend, or discontinue features of Hetex AI when
            reasonably necessary.
          </p>
        </Section>

        <Section title="16. Usage Limits">
          <p>Hetex AI may impose limits on:</p>
          <List
            items={[
              "Messages.",
              "AI generations.",
              "File uploads.",
              "Storage.",
              "API requests.",
              "Processing capacity.",
              "Account activity.",
              "Other features.",
            ]}
          />
          <p className="mt-2">
            Limits may vary according to the user's plan, system capacity,
            technical requirements, or other factors.
          </p>
          <p className="mt-2">
            Attempts to bypass usage restrictions may result in account
            restrictions or termination.
          </p>
        </Section>

        <Section title="17. Security">
          <p>
            We take reasonable measures to protect the Service and
            information processed through it.
          </p>
          <p className="mt-2">
            However, no internet-connected service can be guaranteed to be
            completely secure.
          </p>
          <p className="mt-2">
            You are responsible for maintaining the security of your own
            devices, passwords, accounts, and networks.
          </p>
          <p className="mt-2">
            You must not attempt to compromise Hetex AI's security or assist
            another person in doing so.
          </p>
        </Section>

        <Section title="18. Prohibited Technical Activities">
          <p>You must not use Hetex AI or its infrastructure to:</p>
          <List
            items={[
              "Attack or compromise computer systems without authorization.",
              "Deploy malware.",
              "Conduct denial-of-service attacks.",
              "Steal credentials or authentication tokens.",
              "Circumvent authentication mechanisms.",
              "Exploit Hetex AI vulnerabilities for malicious purposes.",
              "Abuse APIs or automated endpoints.",
              "Attempt unauthorized access to another user's account or data.",
              "Probe or attack Hetex AI infrastructure outside an authorized security-testing program.",
            ]}
          />
          <p className="mt-2">
            Security researchers who discover vulnerabilities should use
            Hetex AI's designated security-reporting channel where one is
            available.
          </p>
        </Section>

        <Section title="19. Account Suspension and Termination">
          <p>
            Hetex AI may suspend or terminate an account if we reasonably
            believe that the user:
          </p>
          <List
            items={[
              "Violated these Terms.",
              "Abused the Service.",
              "Engaged in fraudulent activity.",
              "Created a security risk.",
              "Violated applicable law.",
              "Attempted to circumvent restrictions.",
              "Used the Service in a manner that could harm Hetex AI, its users, or third parties.",
            ]}
          />
          <p className="mt-2">
            Where appropriate and legally permitted, we may provide notice
            before taking action.
          </p>
          <p className="mt-2">You may stop using Hetex AI at any time.</p>
        </Section>

        <Section title="20. Changes to Hetex AI">
          <p>We may modify, update, add, or remove features from Hetex AI.</p>
          <p className="mt-2">
            We may also update these Terms when necessary because of changes
            to the Service, technology, business operations, security
            requirements, or applicable law.
          </p>
          <p className="mt-2">
            When changes are material, we will provide reasonable notice
            where required.
          </p>
          <p className="mt-2">
            Your continued use of Hetex AI after updated Terms become
            effective constitutes acceptance of the updated Terms, where
            permitted by law.
          </p>
        </Section>

        <Section title="21. Disclaimer of Warranties">
          <p>
            To the maximum extent permitted by applicable law, Hetex AI is
            provided on an "as available" and "as is" basis.
          </p>
          <p className="mt-2">We do not guarantee that:</p>
          <List
            items={[
              "The Service will always be available.",
              "AI responses will always be accurate.",
              "Outputs will always be suitable for your purpose.",
              "The Service will always be free from errors.",
              "The Service will meet every user's specific requirements.",
              "Information provided by the Service will always be current.",
            ]}
          />
        </Section>

        <Section title="22. Limitation of Liability">
          <p>
            To the maximum extent permitted by applicable law, Hetex AI and
            its owners, employees, contractors, affiliates, and service
            providers will not be liable for indirect, incidental,
            consequential, special, or punitive damages arising from your use
            of or inability to use the Service.
          </p>
          <p className="mt-2">This may include losses relating to:</p>
          <List
            items={[
              "Data.",
              "Profits.",
              "Business opportunities.",
              "Reputation.",
              "Revenue.",
              "Business interruption.",
            ]}
          />
          <p className="mt-2">
            Nothing in these Terms excludes or limits liability that cannot
            legally be excluded or limited under applicable law.
          </p>
        </Section>

        <Section title="23. Indemnification">
          <p>
            To the extent permitted by law, you agree to defend, indemnify,
            and hold harmless Hetex AI and its affiliates, employees,
            contractors, and service providers from claims, losses,
            liabilities, damages, and expenses arising from:
          </p>
          <List
            items={[
              "Your violation of these Terms.",
              "Your misuse of the Service.",
              "Your User Content.",
              "Your violation of another person's rights.",
              "Your violation of applicable law.",
            ]}
          />
        </Section>

        <Section title="24. Governing Law">
          <p>
            These Terms will be governed by the laws applicable to Hetex AI
            and its operating entity, except where mandatory
            consumer-protection laws provide otherwise.
          </p>
          <p className="mt-2">
            Any dispute will be handled through the dispute-resolution
            process applicable to the user's jurisdiction and the Hetex AI
            operating entity.
          </p>
        </Section>

        <Section title="25. Contact">
          <p>
            If you have questions about these Terms, account issues, legal
            matters, security concerns, or the Service, you may contact Hetex
            AI through its official support channels.
          </p>
          <p className="mt-2 font-medium text-[var(--text-primary)]">
            Hetex AI
          </p>
          <p>
            Website:{" "}
            <a
              href="https://www.hetexai.org"
              className="underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              www.hetexai.org
            </a>
          </p>
          <p>
            Email:{" "}
            <a href="mailto:muhweziperos@gmail.com" className="underline">
              muhweziperos@gmail.com
            </a>
          </p>
        </Section>

        <Section title="26. Acceptance">
          <p>By accessing or using Hetex AI, you acknowledge that:</p>
          <List
            items={[
              "You have read these Terms.",
              "You understand these Terms.",
              "You agree to be bound by these Terms.",
              "You will use Hetex AI responsibly and lawfully.",
            ]}
          />
          <p className="mt-2">
            If you do not agree with these Terms, you must stop using Hetex
            AI.
          </p>
        </Section>

        <p className="mt-8 text-xs">© 2026 Hetex AI. All rights reserved.</p>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6">
      <h2 className="text-sm font-medium text-[var(--text-primary)]">
        {title}
      </h2>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="mt-1 list-disc space-y-1 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
