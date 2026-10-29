import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ version: "0.2.1", commit: "90c8301", service: "prop-admin" });
}