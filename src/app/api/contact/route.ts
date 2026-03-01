import { NextRequest, NextResponse } from "next/server";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase";
import { Resend } from "resend";

// Lazy initialize resend to avoid build errors when API key is missing
let resend: Resend | null = null;
const getResend = () => {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
};
const NOTIFICATION_EMAILS = ["liprobakin2@gmail.com"];
const DEFAULT_FROM = "LIPROBAKIN <onboarding@resend.dev>";
const FALLBACK_FROM = "LIPROBAKIN <onboarding@resend.dev>";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firstName, lastName, email, phone, message, language } = body;

    // Validation
    if (!firstName || !lastName || !email || !message) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Save to Firestore
    const contactRef = collection(firebaseDB, "contactMessages");
    const docRef = await addDoc(contactRef, {
      firstName,
      lastName,
      email,
      phone: phone || null,
      message,
      language: language || "fr",
      status: "new",
      createdAt: serverTimestamp(),
    });

    // Send email notification
    let emailDelivered = false;
    let emailStatus: "sent" | "fallback_sent" | "failed" | "skipped_no_api_key" = "failed";
    let emailErrorMessage: string | null = null;
    let providerMessageId: string | null = null;
    const deliveredRecipients: string[] = [];
    const failedRecipients: Array<{ email: string; reason: string }> = [];

    const resendClient = getResend();
    if (resendClient) {
      const emailPayload = {
        replyTo: email,
        subject: `Nouveau message de ${firstName} ${lastName}`,
        html: `
            <h2>Nouveau message de contact</h2>
            <p><strong>De:</strong> ${firstName} ${lastName}</p>
            <p><strong>Email:</strong> ${email}</p>
            ${phone ? `<p><strong>Téléphone:</strong> ${phone}</p>` : ""}
            <hr />
            <p><strong>Message:</strong></p>
            <p>${message.replace(/\n/g, "<br />")}</p>
            <hr />
            <p style="color: #666; font-size: 12px;">ID: ${docRef.id}</p>
          `,
      };

      const sendAndValidate = async (to: string, from: string) => {
        const result = await resendClient.emails.send({
          to: [to],
          from,
          ...emailPayload,
        });

        if (result?.error) {
          throw new Error(result.error.message || "Resend returned an error");
        }

        return result?.data?.id ?? null;
      };

      for (const recipient of NOTIFICATION_EMAILS) {
          try {
            const messageId = await sendAndValidate(recipient, process.env.RESEND_FROM_EMAIL || DEFAULT_FROM);
            if (!providerMessageId && messageId) {
              providerMessageId = messageId;
            }
            deliveredRecipients.push(recipient);
          } catch (emailError) {
            console.error(`Failed for ${recipient} with primary sender, trying fallback:`, emailError);
            try {
              const fallbackMessageId = await sendAndValidate(recipient, FALLBACK_FROM);
              if (!providerMessageId && fallbackMessageId) {
                providerMessageId = fallbackMessageId;
              }
              deliveredRecipients.push(recipient);
              emailStatus = "fallback_sent";
            } catch (fallbackError) {
              console.error(`Failed to send email notification to ${recipient}:`, fallbackError);
              failedRecipients.push({
                email: recipient,
                reason: fallbackError instanceof Error ? fallbackError.message : "Email delivery failed",
              });
            }
          }
      }

      emailDelivered = deliveredRecipients.length > 0;
      if (emailDelivered && emailStatus !== "fallback_sent") {
        emailStatus = "sent";
      }
      if (!emailDelivered) {
        emailStatus = "failed";
        emailErrorMessage = failedRecipients[0]?.reason ?? "Email delivery failed";
      } else if (failedRecipients.length > 0) {
        emailErrorMessage = `Some recipients failed: ${failedRecipients.map((entry) => entry.email).join(", ")}`;
      }
    } else {
      console.log("RESEND_API_KEY not configured - skipping email notification");
      emailStatus = "skipped_no_api_key";
      emailErrorMessage = "RESEND_API_KEY not configured";
    }

    return NextResponse.json({
      success: true,
      id: docRef.id,
      emailDelivered,
      emailStatus,
      emailErrorMessage,
      providerMessageId,
      notificationRecipients: NOTIFICATION_EMAILS,
      deliveredRecipients,
      failedRecipients,
    });
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "Failed to submit message" },
      { status: 500 }
    );
  }
}
