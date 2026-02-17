// app/api/otp/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import twilio from "twilio";
import { z } from "zod";
import { redis, rateLimit } from "@/lib/redis"; 
import crypto from "crypto";

const prisma = new PrismaClient();
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!,
);

// ────────────────────────────────────────────────
// Validation
// ────────────────────────────────────────────────
const requestSchema = z.object({
  phoneNumber: z
    .string()
    .regex(
      /^\+[1-9]\d{1,14}$/,
      "Phone number must be in E.164 format (e.g. +12025550123)",
    ),
});

// ────────────────────────────────────────────────
// Config – tune these values based on your risk & cost tolerance
// ────────────────────────────────────────────────
const OTP_LENGTH = 6;
const OTP_TTL_SECONDS = 120; // 2 minutes – modern standard
const RATE_LIMIT_PER_IP = { count: 5, windowSeconds: 600 }; // 5 / 10 min
const RATE_LIMIT_PER_PHONE = { count: 2, windowSeconds: 600 }; // 2 / 10 min
const DAILY_PHONE_CAP = { count: 12, windowSeconds: 86400 }; // 12 / day

export async function POST(request: Request) {
  try {
    // ── Parse & validate ───────────────────────────────────────
    const body = await request.json();
    const { phoneNumber } = requestSchema.parse(body);

    // Normalize phone for rate-limit keys (remove non-digits except +)
    const phoneKey = phoneNumber.replace(/[^0-9+]/g, "");

    // Get client IP (works behind most proxies/load balancers)
    const ip = (request.headers.get("x-forwarded-for") ?? "127.0.0.1")
      .split(",")[0]
      .trim();

    // ── Rate limiting (parallel checks) ─────────────────────────
    const rateLimitKeys = [
      `otp:ip:${ip}`,
      `otp:phone:${phoneKey}`,
      `otp:phone:day:${phoneKey}`,
    ];

    const limits = await Promise.all(
      rateLimitKeys.map((key, i) => {
        if (i === 0)
          return rateLimit(
            key,
            RATE_LIMIT_PER_IP.count,
            RATE_LIMIT_PER_IP.windowSeconds,
          );
        if (i === 1)
          return rateLimit(
            key,
            RATE_LIMIT_PER_PHONE.count,
            RATE_LIMIT_PER_PHONE.windowSeconds,
          );
        return rateLimit(
          key,
          DAILY_PHONE_CAP.count,
          DAILY_PHONE_CAP.windowSeconds,
        );
      }),
    );

    const failedLimit = limits.find((l) => !l.success);
    if (failedLimit) {
      return NextResponse.json(
        {
          error: "Too many requests. Please try again later.",
          retryAfter: failedLimit.retryAfterSeconds
            ? Math.ceil(failedLimit.retryAfterSeconds)
            : undefined,
        },
        { status: 429 },
      );
    }

    // ── Generate secure OTP ─────────────────────────────────────

    const otp = crypto
      .randomInt(10 ** (OTP_LENGTH - 1), 10 ** OTP_LENGTH)
      .toString();

    const hashedOtp = crypto
      .createHmac("sha256", process.env.OTP_SECRET!)
      .update(otp)
      .digest("hex");
    const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

    // ── Store (upsert – keep only latest OTP per phone) ─────────
    await prisma.otpRequest.upsert({
      where: { phoneNumber },
      update: {
        hashedOtp,
        expiresAt,
        attemptCount: 0, // reset failed attempts counter
        lastRequestedAt: new Date(),
      },
      create: {
        phoneNumber,
        hashedOtp,
        expiresAt,
        attemptCount: 0,
        lastRequestedAt: new Date(),
      },
    });

    // ── Send SMS (or log in dev) ────────────────────────────────
    if (process.env.NODE_ENV === "production") {
      await twilioClient.messages.create({
        body: `Your verification code is ${otp}. It expires in ${Math.round(OTP_TTL_SECONDS / 60)} minutes. Do not share it.`,
        to: phoneNumber,
        from: process.env.TWILIO_PHONE_NUMBER!,
        // messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID, // ← recommended
      });
    } else {
      console.log(
        `[DEV] OTP for ${phoneNumber}: ${otp} (expires in ${OTP_TTL_SECONDS}s)`,
      );
    }

    return NextResponse.json(
      { message: "Verification code sent" },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid phone number format", issues: err.issues },
        { status: 400 },
      );
    }

    console.error("OTP request failed:", err);
    return NextResponse.json(
      { error: "Unable to send code. Please try again later." },
      { status: 500 },
    );
  }
}
