import { NextResponse } from "next/server";

export async function GET() {
  try {
    /*
     * Phase 9 Supabase integration should be used here.
     *
     * Keep blockchain security state on-chain.
     * Supabase is only used for dashboard metadata,
     * analytics and audit information.
     */

    return NextResponse.json({
      providers: [],
    });
  } catch (error) {
    console.error(
      "Failed to load providers:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to load providers",
      },
      {
        status: 500,
      }
    );
  }
}