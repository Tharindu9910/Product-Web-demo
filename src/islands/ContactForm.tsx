import { useState, type FormEvent } from "react";
import { withBase } from "@/lib/base";

/**
 * Fields reconciled against legacy/contact.html (step 7 mistake log): name,
 * email and message are required; company, phone and topic are optional —
 * not the name/company/email/phone/business_type/locations set this
 * component shipped with before reconciliation. Submit label is legacy's
 * "Send message", not "Book a demo".
 *
 * Web3Forms. The access key is public by design — anyone can read it in
 * page source and POST to it — so the honeypot is not optional.
 *
 * Set PUBLIC_WEB3FORMS_KEY in .env
 * Free tier: 250 submissions/month, email only, deleted after 30 days.
 */

const ENDPOINT = "https://api.web3forms.com/submit";
const ACCESS_KEY = import.meta.env.PUBLIC_WEB3FORMS_KEY;

type Status = "idle" | "sending" | "error";

export default function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setError("");

    const data = new FormData(e.currentTarget);
    data.append("access_key", ACCESS_KEY);
    data.append("subject", "New contact form message — nexone.com");
    data.append("from_name", "NexOne Website");

    try {
      const res = await fetch(ENDPOINT, { method: "POST", body: data });
      const json = await res.json();

      if (json.success) {
        // Real URL, not a JS state — GA4 needs a pageview to count a conversion.
        window.location.href = withBase("/thank-you");
        return;
      }
      throw new Error(json.message ?? "Submission failed");
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please email us directly."
      );
    }
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit}>
      {/* Honeypot — hidden from users, filled by bots */}
      <input
        type="checkbox"
        name="botcheck"
        tabIndex={-1}
        autoComplete="off"
        style={{ display: "none" }}
        aria-hidden="true"
      />

      <div className="form-row">
        <div className="form-field">
          <label htmlFor="name">
            Full name<span className="req" aria-hidden="true">*</span>
          </label>
          <input type="text" id="name" name="name" placeholder="Your name" autoComplete="name" required />
        </div>
        <div className="form-field">
          <label htmlFor="company">Company</label>
          <input type="text" id="company" name="company" placeholder="Your business" autoComplete="organization" />
        </div>
      </div>

      <div className="form-row">
        <div className="form-field">
          <label htmlFor="email">
            Email<span className="req" aria-hidden="true">*</span>
          </label>
          <input type="email" id="email" name="email" placeholder="you@company.com" autoComplete="email" required />
        </div>
        <div className="form-field">
          <label htmlFor="phone">Phone</label>
          <input type="tel" id="phone" name="phone" placeholder="+94 ..." autoComplete="tel" />
        </div>
      </div>

      <div className="form-field">
        <label htmlFor="topic">What are you running today?</label>
        <select id="topic" name="topic" defaultValue="">
          <option value="">Select one</option>
          <option value="spreadsheets">Spreadsheets / manual process</option>
          <option value="pos">A POS system only</option>
          <option value="other-erp">Another ERP</option>
          <option value="none">Nothing centralised yet</option>
        </select>
      </div>

      <div className="form-field">
        <label htmlFor="message">
          Message<span className="req" aria-hidden="true">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          placeholder="What's the biggest bottleneck in your operation right now?"
          required
        />
      </div>

      <div className="form-actions">
        <button className="btn-orange" type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Send message"}
          <svg className="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 12h15M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>

      {status === "error" && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </form>
  );
}
