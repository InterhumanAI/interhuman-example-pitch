import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles } from "lucide-react";
import { APP_NAME } from "@/lib/brand";

export const metadata = {
  title: `Terms of Service - ${APP_NAME}`,
  description: `Terms and conditions for using ${APP_NAME}.`,
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
          </Button>
          <div className="ml-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="font-semibold">{APP_NAME}</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: April 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using {APP_NAME}, you agree to be bound by these Terms of Service. 
              If you do not agree to these terms, please do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              {APP_NAME} is a pitch practice tool that uses AI-powered video analysis to provide 
              feedback on your presentation delivery. The service includes:
            </p>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Video recording and local storage</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>AI-powered behavioral analysis via Interhuman AI</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Scoring, feedback, and badges</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Leaderboard and competitive challenges</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. User Responsibilities</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              You agree to:
            </p>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Use the service only for lawful purposes</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Not upload content that is illegal, harmful, or violates others&apos; rights</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Not attempt to abuse, exploit, or circumvent usage limits</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Not use automated systems to access the service without permission</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Maintain the security of your account credentials</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Content Ownership</h2>
            <p className="text-muted-foreground leading-relaxed">
              You retain all rights to your video recordings and content. By using the service, 
              you grant us a limited license to process your videos through our AI analysis 
              pipeline solely for the purpose of providing feedback. We do not claim ownership 
              of your content and do not retain your videos after analysis.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. AI Analysis Disclaimer</h2>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-4">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                AI-generated feedback is for practice purposes only and should not be considered 
                professional advice.
              </p>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              The behavioral analysis and scores provided by {APP_NAME} are generated by AI 
              and are intended as practice feedback only. Results may vary and should not be 
              relied upon as definitive assessments of your presentation skills. We make no 
              guarantees about the accuracy of the analysis or its correlation with real-world 
              investor reactions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Leaderboard & Public Display</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you participate in challenges and submit scores to the leaderboard, your 
              display name and score will be publicly visible. You can choose any display 
              name—it does not need to be your real name. We reserve the right to remove 
              leaderboard entries that appear fraudulent or violate these terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Usage Limits</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may impose limits on the number of video analyses or other features to ensure 
              fair usage and service availability. These limits may vary based on whether you 
              have a free or paid account. Abuse of the service may result in temporary or 
              permanent restrictions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Service Availability</h2>
            <p className="text-muted-foreground leading-relaxed">
              We strive to maintain service availability but do not guarantee uninterrupted 
              access. The service may be temporarily unavailable for maintenance, updates, 
              or due to factors beyond our control. We are not liable for any loss resulting 
              from service interruptions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              To the maximum extent permitted by law, {APP_NAME} and its operators shall not 
              be liable for any indirect, incidental, special, consequential, or punitive damages, 
              including loss of profits, data, or business opportunities, arising from your use 
              of the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update these terms from time to time. Continued use of the service after 
              changes constitutes acceptance of the new terms. We will make reasonable efforts 
              to notify users of significant changes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to suspend or terminate your access to the service at any 
              time for violation of these terms or for any other reason at our discretion. 
              You may stop using the service at any time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              For questions about these terms, contact us at{" "}
              <a href="mailto:youremail@yourdomain.com" className="text-primary hover:underline">
                youremail@yourdomain.com
              </a>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
