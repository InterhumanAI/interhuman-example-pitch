import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles } from "lucide-react";
import { APP_NAME } from "@/lib/brand";

export const metadata = {
  title: `Privacy Policy - ${APP_NAME}`,
  description: `How ${APP_NAME} handles your data and protects your privacy.`,
};

export default function PrivacyPolicyPage() {
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
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: September 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-3">Overview</h2>
            <p className="text-muted-foreground leading-relaxed">
              This policy explains what data
              we collect, how it&apos;s processed, who we share it with, and your rights.
              It should be read together with the consent screen shown before you record.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">How Your Recording Is Processed</h2>
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-4">
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                We never retain your video or audio on our servers after analysis.
              </p>
            </div>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Your recording is always saved locally in your browser using IndexedDB, so you can review or delete it any time from the Saved Videos tab</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Your recording streams live to Interhuman AI for analysis — our servers never receive a copy of it at all</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>If live analysis isn&apos;t available (e.g. some browsers, or re-analyzing a saved video), we instead upload the recording to our storage, send it to Interhuman AI for analysis, and delete our copy immediately once analysis finishes — whether it succeeds or fails</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>When your pitch is transcribed, the text transcript (not your audio or video) is separately sent to OpenAI to score the content of what you said</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">What Is Stored</h2>
            <div className="bg-secondary/50 rounded-lg p-4 space-y-3">
              <div>
                <h4 className="font-medium text-sm mb-1">Stored Locally (Your Browser)</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Video recordings and thumbnails</li>
                  <li>• Analysis scores and feedback</li>
                  <li>• Badges earned</li>
                  <li>• Your recording consent record (which version you agreed to, and when)</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-sm mb-1">Stored on Our Servers (If Configured)</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Pitch scores and metrics — no video or audio</li>
                  <li>• The text transcript of your pitch and the content analysis derived from it, when available</li>
                  <li>• Leaderboard entries (display name and score) for challenge mode</li>
                  <li>• A randomly generated identifier for each pitch (not linked across visits or to any account)</li>
                  <li>• A server-side record of your recording consent (version and timestamp), as proof consent was given</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Retention</h2>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span><strong className="text-foreground">Video/audio on our servers:</strong> deleted immediately after analysis completes — we don&apos;t keep a copy afterward</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span><strong className="text-foreground">Video on your device:</strong> kept until you delete it or clear your browser data — entirely under your control</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span><strong className="text-foreground">Scores, transcripts, and analysis on our servers:</strong> retained until you request deletion (see Your Rights below)</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span><strong className="text-foreground">Interhuman&apos;s training corpus:</strong> up to 18 months — see Model Improvement Program below</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Third-Party Services</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We use the following third-party services to provide this app:
            </p>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-primary font-bold">•</span>
                <div>
                  <strong className="text-foreground">Interhuman AI</strong> — Analyzes
                  your video and audio for behavioral signals (confidence, clarity, energy,
                  and similar). Also trains its own models on your recording under the
                  Model Improvement Program described below.
                  See{" "}
                  <a
                    href="https://interhuman.ai/privacy"
                    className="text-primary hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Interhuman&apos;s Privacy Policy
                  </a>.
                </div>
              </li>
              <li className="flex gap-2">
                <span className="text-primary font-bold">•</span>
                <div>
                  <strong className="text-foreground">OpenAI</strong> — Scores the content
                  of your pitch (what you said, not how you said it) from the text
                  transcript of your recording. See{" "}
                  <a
                    href="https://openai.com/policies/privacy-policy"
                    className="text-primary hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    OpenAI&apos;s Privacy Policy
                  </a>.
                </div>
              </li>
              <li className="flex gap-2">
                <span className="text-primary font-bold">•</span>
                <div>
                  <strong className="text-foreground">Vercel</strong> — Hosts this app and,
                  when a recording is uploaded (the fallback path above), briefly stores the
                  video/audio in Vercel Blob until analysis deletes it. See{" "}
                  <a
                    href="https://vercel.com/legal/privacy-policy"
                    className="text-primary hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Vercel&apos;s Privacy Policy
                  </a>.
                </div>
              </li>
              <li className="flex gap-2">
                <span className="text-primary font-bold">•</span>
                <div>
                  <strong className="text-foreground">Supabase</strong> — Stores pitch
                  scores, transcripts, leaderboard entries, and consent records. See{" "}
                  <a
                    href="https://supabase.com/privacy"
                    className="text-primary hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Supabase&apos;s Privacy Policy
                  </a>.
                </div>
              </li>
            </ul>
          </section>

  

          <section>
            <h2 className="text-xl font-semibold mb-3">Model Improvement Program</h2>
            <div className="bg-secondary/50 rounded-lg p-4 space-y-3">
              <p className="text-muted-foreground leading-relaxed">
                This app participates in Interhuman AI&apos;s{" "}
                <a
                  href="https://docs.interhuman.ai/explanations/model-improvement-program"
                  className="text-primary hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Model Improvement Partnership Program (MIP)
                </a>
                . There is no per-recording or per-account opt-out available to you —
                every recording processed through this app is eligible to be used by
                Interhuman AI to train and evaluate its own models (e.g. to improve
                accuracy across accents, cultures, and interaction styles).
              </p>
              <p className="text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Pseudonymized:</strong> Interhuman
                applies automated redaction to transcripts and metadata before training,
                but the recording itself still contains your face and voice — it is
                not pseudonymized. Interhuman never resells this data, uses it
                for advertising, or shares it with other third parties.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Retention:</strong> your
                recording is retained by Interhuman for up to{" "}
                <strong className="text-foreground">18 months</strong> for
                this purpose, with source data minimized after preprocessing.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                We ask for your explicit consent before recording, covering
                this use of your data. The legal basis for this processing is
                your explicit, informed consent (GDPR Art. 6(1)(a) and, where
                facial/voice signals are treated as biometric data, Art.
                9(2)(a)). You may withdraw consent at any time going forward
                — see <strong className="text-foreground">Your Rights</strong>{" "}
                below — though this cannot undo processing that already
                occurred under a prior, validly given consent.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Legal Bases for Processing</h2>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span><strong className="text-foreground">Recording, analysis, and Model Improvement Program use:</strong> your explicit, informed consent (Art. 6(1)(a), and Art. 9(2)(a) where facial/voice signals are treated as biometric data)</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span><strong className="text-foreground">Leaderboard and abuse prevention:</strong> our legitimate interest in operating the challenge feature and keeping the service secure</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Automated Scoring</h2>
            <p className="text-muted-foreground leading-relaxed">
              The scores and feedback you receive are generated automatically from the
              Interhuman and OpenAI analysis described above. They are informational only
              — intended to help you practice — and are not used to make any decision
              about you.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Recording Other People</h2>
            <p className="text-muted-foreground leading-relaxed">
              Please record only yourself. If anyone else is visible or audible in your
              recording, make sure you have their permission before recording — the
              consent you give us covers your own participation, not theirs.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Minors</h2>
            <p className="text-muted-foreground leading-relaxed">
              This app is not intended for use by anyone under 18, and we ask you to
              confirm you are 18 or older before recording. We set the bar at 18 rather
              than the lower digital-consent age some countries allow (13 in Denmark, for
              example) because recording a pitch involves explicit consent to processing
              your face and voice — treated as biometric data under Art. 9 — and use of
              that recording to train a third party&apos;s models. We are not willing to
              rely on a minor&apos;s consent for that, and we do not offer a parental or
              guardian consent route. Please don&apos;t record a pitch if you&apos;re
              under 18.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Leaderboard</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you enter the 1-Minute Challenge, the display name you type and your
              score are shown publicly on the leaderboard. Use a pseudonym if you&apos;d
              rather not share your real name. Contact us if you&apos;d like a leaderboard
              entry removed.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Cookies & Local Storage</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use browser local storage and IndexedDB to store your videos, preferences,
              and recording consent locally. We may use cookies for authentication if you
              create an account. We do not use tracking cookies or third-party analytics.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              Depending on your location, you may have the right to access, correct,
              delete, restrict, or object to our processing of your personal data, and to
              receive a copy of it in a portable format. In practice:
            </p>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span><strong className="text-foreground">Withdraw consent:</strong> Clear this site&apos;s data in your browser (or contact us) to withdraw your recording consent; you&apos;ll be asked to consent again before recording in the future. This doesn&apos;t undo processing that already happened under a prior, validly given consent</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span><strong className="text-foreground">Delete local data:</strong> Clear your browser data or use the delete button in Saved Videos</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span><strong className="text-foreground">Delete or access server-stored data:</strong> Contact us to request deletion of, or a copy of, any scores, transcripts, or leaderboard entries we hold about you</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span><strong className="text-foreground">Export data:</strong> Your local videos can be downloaded directly from your browser</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span><strong className="text-foreground">Complain to a regulator:</strong> If you&apos;re in the EEA/UK, you have the right to lodge a complaint with your local data protection supervisory authority</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Data Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              Video and audio are transmitted over HTTPS/WSS. Server-stored data is
              protected by Supabase&apos;s security infrastructure including encryption at
              rest and in transit. Local data is stored in your browser&apos;s sandboxed
              storage.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              If we materially change what we disclose here, we bump the version of the
              consent shown before recording, which re-prompts every user for fresh
              consent before their next recording — regardless of when they last agreed.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              For privacy questions or data deletion requests, contact us at{" "}
              <a href="mailto:contact@interhuman.ai" className="text-primary hover:underline">
                contact@interhuman.ai
              </a>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
